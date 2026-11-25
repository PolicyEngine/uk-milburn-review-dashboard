#!/usr/bin/env python3
"""Household net income by income quintile for the Milburn report runs, on
the local build. Staging only: never written to public/.

A quintile is two of the dashboard's household income deciles (1-2, 3-4,
..., 9-10): the same ``household_income_decile`` (HBAI equivalised income,
ranked by people) the distributional calculator uses, read on the baseline.
For each quintile and year it reports, as the dashboard's decile tables do:

- ``avg_change``: the household-weighted mean change in household net
  income, £ a year (``WinnersLosersCalculator``);
- ``pct_change``: the weighted sum of changes over the weighted sum of
  baseline net income, in % (``DistributionalImpactCalculator``).

Households with no decile (below 1) are left out, as there. Each quintile
records the survey households behind it (Microcosm clones count once,
``pipeline.scatter_survey_households``): all of them, and those whose net
income changes. A figure whose change comes from 1 or 2 survey households
is withheld (``disclosure_floor.thin_groups``, SURVEY_HOUSEHOLD_FLOOR).

Before any quintile is written, the decile figures from the same frames,
computed by the dashboard's own calculators, are checked against each
run's published winners_losers.csv and distributional_impact.csv for every
year; a mismatch stops the script.

Runs: the package and its two removals on their own, each against current
law (Microcosm build b891aa69 on policyengine-uk 2.179.2, certified in
policyengine 6.20.3, through ``uk_budget_data.local_build``).

Locally it builds the baseline once and each reform in turn, a heavy job:
it waits for the shared heavy-run lock (/tmp/pe-heavy.lock, "<pid>
<project> <job>"), takes it and releases it.

    unset HUGGING_FACE_TOKEN HF_TOKEN HUGGINGFACE_HUB_TOKEN
    .venv/bin/python scripts/milburn_quintiles.py \\
        --stage ~/milburn-runs/2026-11-19-quintiles

On Modal (``--backend modal``, from a clean checkout of pushed main) it runs
one container per run on the generate runs' image, secret and size
(``modal_generate``), each validating its own deciles before its quintiles:

    uv run --with modal==1.6.2 python scripts/milburn_quintiles.py \\
        --backend modal --stage ~/milburn-runs/2026-11-19-quintiles

``--stage`` gets households.csv.gz (household-level microdata: keep it out
of public/) and quintiles.json. When households.csv.gz already exists it is
read instead of building the simulations, with no lock.
"""

import argparse
import csv
import gzip
import io
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOCK = Path("/tmp/pe-heavy.lock")
LOCK_PROJECT = "uk-milburn"
LOCK_JOB = "quintiles"
TOKEN_VARIABLES = ("HUGGING_FACE_TOKEN", "HF_TOKEN", "HUGGINGFACE_HUB_TOKEN")
REFORM_IDS = (
    "milburn_report_package",
    "milburn_report_pip",
    "milburn_report_uc_health",
)
YEARS = (2029, 2030, 2031)
QUINTILES = {q: (2 * q - 1, 2 * q) for q in range(1, 6)}
PUBLISHED = ROOT / "public" / "data" / "milburn"
# Published values are full floats; this is well inside "to rounding".
ABS_TOLERANCE = {"avg_change": 0.01, "pct_change": 1e-6}


# The lock: one text line, "<pid> <project> <job>", as
# scripts/milburn_neet_breakdown.py and scripts/milburn_rerun_all.sh.


def lock_holder():
    """(pid, text) of the lock's holder, or None when there is no lock."""
    try:
        text = LOCK.read_text().strip()
    except FileNotFoundError:
        return None
    try:
        return int(text.split()[0]), text
    except (IndexError, ValueError):
        return None, text


def is_alive(pid):
    if pid is None:
        return True  # unreadable lock: treat as held, never remove it
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def take_lock():
    while True:
        try:
            handle = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o644)
        except FileExistsError:
            holder = lock_holder()
            if holder is None:
                continue
            pid, text = holder
            if not is_alive(pid):
                print(f"Removing stale lock ({text}): its process is gone.")
                try:
                    LOCK.unlink()
                except FileNotFoundError:
                    pass
                continue
            print(
                f"{time.strftime('%H:%M')} waiting for {LOCK} ({text})",
                flush=True,
            )
            time.sleep(60)
            continue
        with os.fdopen(handle, "w") as stream:
            stream.write(f"{os.getpid()} {LOCK_PROJECT} {LOCK_JOB}\n")
        return


def release_lock():
    holder = lock_holder()
    if holder and holder[0] == os.getpid():
        LOCK.unlink()


def build_frame(reform_ids=REFORM_IDS):
    """One row per household, reform and year."""
    import gc

    import numpy as np
    import pandas as pd

    from uk_budget_data import local_build
    from uk_budget_data.models import DataConfig
    from uk_budget_data.pipeline import (
        build_microsimulation,
        scatter_survey_households,
    )
    from uk_budget_data.reforms import get_reform

    local_build.check_engine()
    local_build.check_dataset()
    config = DataConfig()
    dataset_path = str(config.dataset_path) if config.dataset_path else None
    reforms = [get_reform(i) for i in reform_ids]
    # Each runs against current law, so one baseline serves them.
    if any(r.baseline_scenario_for(config) is not None for r in reforms):
        raise SystemExit("A run has a baseline other than current law.")
    baseline = build_microsimulation(dataset_path, None)
    survey = np.asarray(scatter_survey_households(baseline, dataset_path))
    if not 0 < len(np.unique(survey)) <= len(survey):
        raise SystemExit("No survey households.")

    def household(sim, variable, year):
        return np.asarray(
            sim.calculate(variable, period=year, map_to="household").values,
            dtype=float,
        )

    base = {
        year: {
            "decile": household(baseline, "household_income_decile", year),
            "weight": household(baseline, "household_weight", year),
            "baseline_income": household(
                baseline, "household_net_income", year
            ),
        }
        for year in YEARS
    }
    frames = []
    for reform in reforms:
        print(f"{time.strftime('%H:%M')} building {reform.id}", flush=True)
        reformed = build_microsimulation(dataset_path, reform.to_scenario())
        for year in YEARS:
            frames.append(
                pd.DataFrame(
                    {
                        "reform_id": reform.id,
                        "year": year,
                        **base[year],
                        "reform_income": household(
                            reformed, "household_net_income", year
                        ),
                        "survey_household": survey,
                    }
                )
            )
        del reformed
        gc.collect()
    return pd.concat(frames, ignore_index=True)


def decile_frame(frame):
    from microdf import MicroDataFrame

    frame = frame[frame["decile"] >= 1]
    return MicroDataFrame(
        {
            "household_income_decile": frame["decile"].to_numpy(),
            "baseline_income": frame["baseline_income"].to_numpy(),
            "reform_income": frame["reform_income"].to_numpy(),
            "income_change": (
                frame["reform_income"] - frame["baseline_income"]
            ).to_numpy(),
            "household_weight": frame["weight"].to_numpy(),
            "survey_household": frame["survey_household"].to_numpy(),
        },
        weights="household_weight",
    )


PUBLISHED_FILES = ("winners_losers.csv", "distributional_impact.csv")


def read_published(reform_ids=REFORM_IDS):
    """The published decile CSVs' text, by (reform id, file name), so a
    Modal container, which has no public/, can check against them."""
    return {
        (reform_id, name): (PUBLISHED / reform_id / name).read_text()
        for reform_id in reform_ids
        for name in PUBLISHED_FILES
    }


def validate(frame, published, reform_ids=REFORM_IDS):
    """Every run's and year's deciles, by the dashboard's calculators,
    against the published CSVs."""
    reports = [
        validate_one(frame, reform_id, year, published)
        for reform_id in reform_ids
        for year in YEARS
    ]
    worst = {
        key: max(r["max_abs_diff"][key] for r in reports)
        for key in ABS_TOLERANCE
    }
    ok = all(worst[k] <= ABS_TOLERANCE[k] for k in worst)
    return ok, {
        "max_abs_diff": worst,
        "tolerance": ABS_TOLERANCE,
        "runs": reports,
    }


def validate_one(frame, reform_id, year, texts):
    """One run's deciles in one year against its published CSVs."""
    from uk_budget_data.calculators import (
        DistributionalImpactCalculator,
        WinnersLosersCalculator,
    )

    rows = frame[(frame["reform_id"] == reform_id) & (frame["year"] == year)]
    df = decile_frame(rows)
    ours = {
        ("avg_change", r["decile"]): r["avg_change"]
        for r in WinnersLosersCalculator().calculate_from_dataframe(
            reform_id, "", year, df
        )
    }
    ours.update(
        {
            ("pct_change", r["decile"]): r["value"]
            for r in DistributionalImpactCalculator().calculate_from_dataframe(
                reform_id, "", year, df
            )
        }
    )
    published = {}
    for name, column, key in (
        ("winners_losers.csv", "avg_change", "avg_change"),
        ("distributional_impact.csv", "value", "pct_change"),
    ):
        for row in csv.DictReader(io.StringIO(texts[(reform_id, name)])):
            if int(row["year"]) == year:
                published[(key, row["decile"])] = float(row[column])
    report, worst = [], {}
    for key, value in published.items():
        diff = abs(ours[key] - value)
        worst[key[0]] = max(worst.get(key[0], 0), diff)
        report.append(
            {
                "measure": key[0],
                "decile": key[1],
                "published": value,
                "ours": ours[key],
                "abs_diff": diff,
            }
        )
    if len(report) != 21:
        raise SystemExit(f"{reform_id} {year}: {len(report)} published cells")
    return {
        "year": year,
        "reform_id": reform_id,
        "max_abs_diff": worst,
        "rows": report,
    }


def quintiles(frame):
    import numpy as np

    from uk_budget_data.publication.disclosure_floor import (
        CHANGE_TOLERANCE,
        SURVEY_HOUSEHOLD_FLOOR,
        thin_groups,
    )

    results = []
    for (reform_id, year), rows in frame.groupby(["reform_id", "year"]):
        df = decile_frame(rows)
        deciles = np.asarray(df["household_income_decile"].values)
        change = np.asarray(df["income_change"].values, dtype=float)
        survey = np.asarray(df["survey_household"].values)
        changed = np.abs(change) >= CHANGE_TOLERANCE
        masks = {
            str(q): np.isin(deciles, pair) for q, pair in QUINTILES.items()
        }
        thin = set(thin_groups(masks, changed, survey))
        for q, mask in masks.items():
            group = df[mask]
            withheld = q in thin
            avg = float(group["income_change"].mean())
            pct = float(
                group["income_change"].sum()
                / group["baseline_income"].sum()
                * 100
            )
            results.append(
                {
                    "reform_id": reform_id,
                    "year": int(year),
                    "fiscal_year": f"{year}-{str(year + 1)[2:]}",
                    "quintile": int(q),
                    "deciles": list(QUINTILES[int(q)]),
                    "avg_change": None if withheld else avg,
                    "pct_change": None if withheld else pct,
                    "survey_households": int(len(np.unique(survey[mask]))),
                    "survey_households_changed": int(
                        len(np.unique(survey[mask & changed]))
                    ),
                    "withheld": withheld,
                }
            )
    return results, SURVEY_HOUSEHOLD_FLOOR


def compute(reform_ids, published):
    """Build, validate the deciles and, only if they match, compute the
    quintiles: here or in a Modal container."""
    import warnings

    from uk_budget_data import local_build

    warnings.simplefilter("ignore", UserWarning)
    frame = build_frame(reform_ids)
    ok, validation = validate(frame, published, reform_ids)
    rows = quintiles(frame)[0] if ok else None
    return {
        "frame": gzip.compress(frame.to_csv(index=False).encode()),
        "ok": ok,
        "validation": validation,
        "rows": rows,
        "build": local_build.build_record(reform_ids, YEARS),
    }


def run_modal(published):
    """One container per run, each the size of a generate run's
    (``modal_generate``: its image, secret, CPU, memory and timeout)."""
    import modal

    from uk_budget_data import modal_generate as mg

    app = modal.App("uk-milburn-quintiles", image=mg.IMAGE)
    remote = app.function(
        serialized=True,
        cpu=mg.CPU,
        memory=mg.MEMORY_MB,
        timeout=mg.TIMEOUT_S,
        retries=0,
        max_containers=len(REFORM_IDS),
        secrets=mg.HF,
    )(compute)
    with modal.enable_output(), app.run():
        return list(
            remote.starmap(
                [
                    (
                        (reform_id,),
                        {
                            key: text
                            for key, text in published.items()
                            if key[0] == reform_id
                        },
                    )
                    for reform_id in REFORM_IDS
                ]
            )
        )


def main(argv=None):
    import warnings

    import pandas as pd

    from uk_budget_data import local_build
    from uk_budget_data.publication.disclosure_floor import (
        SURVEY_HOUSEHOLD_FLOOR,
    )

    warnings.simplefilter("ignore", UserWarning)

    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--stage", type=Path, required=True)
    parser.add_argument(
        "--backend",
        choices=("local", "modal"),
        default="local",
        help="local: under the heavy-run lock, with no token; modal: one "
        "container per run, from a clean checkout of pushed main.",
    )
    args = parser.parse_args(argv)
    stage = args.stage.expanduser().resolve()
    if ROOT / "public" in (stage, *stage.parents):
        raise SystemExit("--stage must be outside public/.")
    stage.mkdir(parents=True, exist_ok=True)
    extract = stage / "households.csv.gz"
    published = read_published()
    if extract.exists():
        frame = pd.read_csv(extract)
        ok, validation = validate(frame, published)
        rows = quintiles(frame)[0] if ok else None
        build = local_build.build_record(REFORM_IDS, YEARS)
    else:
        if args.backend == "modal":
            results = run_modal(published)
        else:
            if any(os.environ.get(v) for v in TOKEN_VARIABLES):
                raise SystemExit("Unset the Hugging Face token first.")
            take_lock()
            try:
                results = [compute(REFORM_IDS, published)]
            finally:
                release_lock()
        frame = pd.concat(
            [
                pd.read_csv(io.BytesIO(gzip.decompress(r["frame"])))
                for r in results
            ],
            ignore_index=True,
        )
        frame.to_csv(extract, index=False)
        ok = all(r["ok"] for r in results)
        validation = {
            "max_abs_diff": {
                key: max(r["validation"]["max_abs_diff"][key] for r in results)
                for key in ABS_TOLERANCE
            },
            "tolerance": ABS_TOLERANCE,
            "runs": [run for r in results for run in r["validation"]["runs"]],
        }
        rows = None if not ok else [row for r in results for row in r["rows"]]
        build = results[0]["build"]
        build["measures"] = list(REFORM_IDS)
        build["backend"] = args.backend
    print(
        "Validation (deciles, every run and year):", validation["max_abs_diff"]
    )
    if not ok:
        (stage / "validation_failed.json").write_text(
            json.dumps(validation, indent=2)
        )
        raise SystemExit("Deciles do not match the published files.")
    output = {
        "note": "Staging only, not published. Quintile q = household income "
        "deciles 2q-1 and 2q (baseline household_income_decile).",
        "build": build,
        "survey_household_floor": SURVEY_HOUSEHOLD_FLOOR,
        "validation": validation,
        "rows": rows,
    }
    (stage / "quintiles.json").write_text(json.dumps(output, indent=2))
    for r in rows:
        figures = (
            "withheld"
            if r["withheld"]
            else f"£{r['avg_change']:9.2f} {r['pct_change']:7.3f}%"
        )
        print(
            f"{r['reform_id']:26} {r['fiscal_year']} Q{r['quintile']} "
            f"{figures} survey {r['survey_households']} "
            f"changed {r['survey_households_changed']}"
        )


if __name__ == "__main__":
    main()
