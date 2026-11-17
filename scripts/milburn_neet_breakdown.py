#!/usr/bin/env python3
"""The report package's effect on 16 to 24-year-olds who are approximately
NEET (not in education, employment or training), on the local build.

The data has no NEET flag, so the group is approximated. A person aged 16
to 24 is NEET-approx when, under current law in the year read:

- their employment income and self-employment income for the year are both
  zero, and
- the data's ``is_in_full_time_education`` input is false.

Read with care (see ``DEFINITION_NOTES``, which goes into the output file):
the education input is true for everyone the data records as enrolled at
any stage, so part-time students count as in education; earnings are for
the whole year, so someone out of work now who worked earlier in the year
is not counted; and the few records in approved training, or with hours
worked but no earnings, are counted (the script prints how many). The
ONS figure is a point-in-time Labour Force Survey estimate on its own
definition, so the two counts are not like for like.

For NEET-approx and for the other 16 to 24-year-olds it reports, weighted:

- the population and the survey records behind it;
- the share living in a household that loses, and the average change in
  household net income per person, both exactly as the dashboard's age
  results count them (``AgeImpactCalculator``: each person takes their
  household's change; a household loses when its net income falls by more
  than ``AGE_CHANGE_THRESHOLD`` of its baseline, at least £1; people whose
  household has no income decile are left out);
- the people who personally lose the UC health element or PIP: their own
  PIP falls, or they are the claimant with limited capability for work and
  work-related activity (the measure's own claimant mask) in a benefit unit
  whose UC health (LCWRA) element falls; each person counted once.

Any figure resting on fewer than ``MIN_RECORDS`` survey records is withheld
(null). Before writing, the two groups together are checked against the
published 16-24 row of the package's ``age_impact.csv``; a mismatch stops
the script.

Two national simulations (baseline and the package: Microcosm build
fcfac709 through ``uk_budget_data.local_build``), so the read is a heavy
job. It waits for the shared heavy-run lock (/tmp/pe-heavy.lock, one line:
"<pid> <project> <job>"), takes it, and never removes a live holder's.

Run from the repository root with no Hugging Face token exported:

    unset HUGGING_FACE_TOKEN HF_TOKEN HUGGINGFACE_HUB_TOKEN
    .venv/bin/python scripts/milburn_neet_breakdown.py --extract ~/milburn-runs/neet-2029.csv

``--extract FILE`` keeps the person-level rows for 16 to 24-year-olds
(outside public/: it is microdata); when FILE already exists it is read
instead of building the simulations, so a change to the summary costs
seconds and no lock.
"""

import argparse
import csv
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOCK = Path("/tmp/pe-heavy.lock")
LOCK_PROJECT = "uk-milburn"
LOCK_JOB = "neet-breakdown"
TOKEN_VARIABLES = ("HUGGING_FACE_TOKEN", "HF_TOKEN", "HUGGINGFACE_HUB_TOKEN")
REFORM_ID = "milburn_report_package"
OUTPUT = ROOT / "public" / "data" / "milburn_neet.json"
AGE_IMPACT = ROOT / "public" / "data" / "milburn" / REFORM_ID / "age_impact.csv"
LOWER_AGE, UPPER_AGE = 16, 25  # 16 to 24
MIN_RECORDS = 100
ONS_BENCHMARK_ID = "neet_16_24"  # public/data/milburn_benchmarks.json

DEFINITION = (
    "Aged 16 to 24 with no employment or self-employment income in the "
    "year and not recorded as in full-time education, under current law."
)
DEFINITION_NOTES = [
    "A static estimate: the UC health element and PIP are removed with no "
    "replacement benefit modelled and no one moving into work.",
    "The survey data has no NEET flag, so the group is approximated from "
    "earnings and the data's full-time education input.",
    "The education input is true for everyone the data records as enrolled "
    "at any stage, so part-time students count as in education.",
    "Earnings are for the whole year: someone out of work now who worked "
    "earlier in the year is not counted. A small number of people the "
    "data records as in approved training, or as working some hours with "
    "no earnings, are counted.",
    "The ONS figure is a point-in-time Labour Force Survey estimate (April "
    "to June 2026) on its own definition; ours is a modelled population "
    "for the fiscal year shown. The two are not like for like.",
    "Each person takes their household's change in net income, as in the "
    "dashboard's results by age. A household loses when its net income "
    "falls by more than 0.01% of its baseline.",
    "A person personally loses a benefit when their own PIP falls, or they "
    "are the claimant with limited capability for work and work-related "
    "activity in a benefit unit whose UC health element falls. Each person "
    "is counted once.",
    f"Figures resting on fewer than {MIN_RECORDS} survey records are "
    "withheld.",
]
COLUMNS = (
    "age",
    "weight",
    "decile",
    "baseline_income",
    "reform_income",
    "employment_income",
    "self_employment_income",
    "in_full_time_education",
    "baseline_pip",
    "reform_pip",
    "baseline_lcwra_element",
    "reform_lcwra_element",
    "lcwra_claimant",
    "employment_status",
    "in_approved_training",
    "hours_worked",
)


def parse_arguments(argv=None):
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--year",
        type=int,
        default=2029,
        help="Fiscal year Y for Y-(Y+1) (default: 2029, i.e. 2029-30).",
    )
    parser.add_argument(
        "--extract",
        type=Path,
        metavar="FILE",
        help="Person-level rows for 16 to 24-year-olds (CSV, outside "
        "public/). Read if it exists, else written after the heavy run.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=OUTPUT,
        help=f"The summary file (default: {OUTPUT.relative_to(ROOT)}).",
    )
    return parser.parse_args(argv)


# The lock: one text line, "<pid> <project> <job>" (as
# scripts/milburn_caseload_check.py and scripts/milburn_rerun_all.sh).


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
    """Create the lock for this process, waiting while a live process
    holds it. A lock whose holder is dead is replaced; a live holder's is
    never touched."""
    while True:
        try:
            handle = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o644)
        except FileExistsError:
            holder = lock_holder()
            if holder is None:
                continue  # released between the two calls
            pid, text = holder
            if not is_alive(pid):
                print(f"Removing stale lock ({text}): its process is gone.")
                try:
                    LOCK.unlink()
                except FileNotFoundError:
                    pass
                continue
            print(f"{time.strftime('%H:%M')} waiting for {LOCK} ({text})", flush=True)
            time.sleep(30)
            continue
        with os.fdopen(handle, "w") as stream:
            stream.write(f"{os.getpid()} {LOCK_PROJECT} {LOCK_JOB}\n")
        return


def release_lock():
    """Remove the lock only if it is still this process's."""
    holder = lock_holder()
    if holder and holder[0] == os.getpid():
        LOCK.unlink()


# The heavy read


def read_people(year):
    """One row per person aged 16 to 24, from the baseline and the package
    built as the pipeline builds them (``pipeline.run_flat_unit``)."""
    import numpy as np
    import pandas as pd
    from policyengine_core.periods import period as as_period
    from policyengine_uk.utils.uc_work_related_requirements import (
        other_member_of_single_claim,
    )

    from uk_budget_data import local_build
    from uk_budget_data.models import DataConfig
    from uk_budget_data.pipeline import build_microsimulation
    from uk_budget_data.reforms import get_reform

    local_build.check_engine()
    local_build.check_dataset()
    reform = get_reform(REFORM_ID)
    config = DataConfig()
    dataset_path = str(config.dataset_path) if config.dataset_path else None
    baseline = build_microsimulation(
        dataset_path, reform.baseline_scenario_for(config)
    )
    reformed = build_microsimulation(dataset_path, reform.to_scenario())

    def person(sim, variable, dtype=float):
        return np.asarray(
            sim.calculate(variable, period=year, map_to="person").values,
            dtype=dtype,
        )

    # The measure's own claimant mask
    # (budget_measures/uc_health_element_removed_under_25.py), on the baseline
    population = baseline.populations["person"]
    period = as_period(year)
    claimant = (
        np.asarray(population("is_uc_assessed_claimant", period), dtype=bool)
        & ~np.asarray(other_member_of_single_claim(population, period), dtype=bool)
        & np.asarray(population("uc_limited_capability_for_WRA", period), dtype=bool)
    )
    frame = pd.DataFrame(
        {
            "age": person(baseline, "age"),
            "weight": person(baseline, "person_weight"),
            "decile": person(baseline, "household_income_decile"),
            "baseline_income": person(baseline, "household_net_income"),
            "reform_income": person(reformed, "household_net_income"),
            "employment_income": person(baseline, "employment_income"),
            "self_employment_income": person(baseline, "self_employment_income"),
            "in_full_time_education": person(
                baseline, "is_in_full_time_education", bool
            ),
            "baseline_pip": person(baseline, "pip"),
            "reform_pip": person(reformed, "pip"),
            "baseline_lcwra_element": person(baseline, "uc_LCWRA_element"),
            "reform_lcwra_element": person(reformed, "uc_LCWRA_element"),
            "lcwra_claimant": claimant,
            "employment_status": np.asarray(
                baseline.calculate("employment_status", period=year).values
            ).astype(str),
            "in_approved_training": person(
                baseline, "is_in_approved_training", bool
            ),
            "hours_worked": person(baseline, "hours_worked"),
        }
    )
    return frame[(frame["age"] >= LOWER_AGE) & (frame["age"] < UPPER_AGE)][
        list(COLUMNS)
    ].reset_index(drop=True)


# The summary (light)


def summarise(frame, year, label):
    import numpy as np

    from uk_budget_data.calculators import AGE_CHANGE_THRESHOLD

    frame = frame[frame["decile"] >= 1]
    weight = frame["weight"].to_numpy(dtype=float)
    change = (frame["reform_income"] - frame["baseline_income"]).to_numpy(dtype=float)
    relative = change / np.maximum(frame["baseline_income"].to_numpy(dtype=float), 1)
    worse = relative < -AGE_CHANGE_THRESHOLD
    no_earnings = (frame["employment_income"].to_numpy(dtype=float) == 0) & (
        frame["self_employment_income"].to_numpy(dtype=float) == 0
    )
    neet = no_earnings & ~frame["in_full_time_education"].to_numpy(dtype=bool)
    loses_pip = (frame["reform_pip"] < frame["baseline_pip"]).to_numpy()
    loses_uc_health = (
        frame["lcwra_claimant"].to_numpy(dtype=bool)
        & (frame["reform_lcwra_element"] < frame["baseline_lcwra_element"]).to_numpy()
    )
    loses_benefit = loses_pip | loses_uc_health

    def count(mask):
        """Weighted people, withheld under MIN_RECORDS records."""
        return round(float(weight[mask].sum())) if mask.sum() >= MIN_RECORDS else None

    def group(members):
        records = int(members.sum())
        people = float(weight[members].sum())
        enough = records >= MIN_RECORDS and people > 0
        losing = members & worse
        row = {
            "records": records,
            "population": round(people) if enough else None,
            "share_in_losing_households_pct": (
                round(float(weight[losing].sum()) / people * 100, 2) if enough else None
            ),
            "people_in_losing_households": count(losing) if enough else None,
            "average_change_in_household_net_income": (
                round(float((weight[members] * change[members]).sum()) / people, 2)
                if enough
                else None
            ),
            "people_losing_uc_health_or_pip": count(members & loses_benefit),
            "people_losing_pip": count(members & loses_pip),
            "people_losing_uc_health": count(members & loses_uc_health),
            "records_losing_uc_health_or_pip": int((members & loses_benefit).sum()),
        }
        if enough:
            lost = row["people_losing_uc_health_or_pip"]
            row["share_losing_uc_health_or_pip_pct"] = (
                round(lost / people * 100, 2) if lost is not None else None
            )
        else:
            row["share_losing_uc_health_or_pip_pct"] = None
        return row

    everyone = np.ones(len(frame), dtype=bool)
    all_young = group(everyone)
    neet_row = group(neet)
    return {
        "reform_id": REFORM_ID,
        "year": year,
        "build": label,
        "definition": DEFINITION,
        "definition_notes": DEFINITION_NOTES,
        "min_records": MIN_RECORDS,
        "groups": {
            "neet_approx": neet_row,
            "other_16_24": group(~neet),
            "all_16_24": all_young,
        },
        "neet_approx_total": neet_row["population"],
        "neet_approx_share_of_16_24_pct": (
            round(neet_row["population"] / all_young["population"] * 100, 1)
            if neet_row["population"] and all_young["population"]
            else None
        ),
        "ons_benchmark_id": ONS_BENCHMARK_ID,
    }, {
        "weight": weight,
        "change": change,
        "worse": worse,
        "neet": neet,
        "frame": frame,
    }


def reconcile(parts, year):
    """The two groups together against the published 16-24 row."""
    if not AGE_IMPACT.is_file():
        raise SystemExit(f"{AGE_IMPACT} not found: nothing to reconcile with.")
    with open(AGE_IMPACT, newline="") as handle:
        rows = [
            row
            for row in csv.DictReader(handle)
            if row["year"] == str(year) and row["age_band"] == "16-24"
        ]
    if len(rows) != 1:
        raise SystemExit(f"{AGE_IMPACT}: no single 16-24 row for {year}.")
    published = rows[0]
    weight, change, worse = parts["weight"], parts["change"], parts["worse"]
    people = float(weight.sum())
    ours = {
        "people": people,
        "sample_size": float(len(weight)),
        "mean_change": float((weight * change).sum()) / people,
        "pct_worse_off": float(weight[worse].sum()) / people * 100,
    }
    print("Reconciliation with the published 16-24 row:")
    failed = False
    for key, value in ours.items():
        target = float(published[key])
        ok = abs(value - target) <= 1e-6 * max(1.0, abs(target))
        failed = failed or not ok
        print(f"  {key}: ours {value:.6f}, published {target:.6f} {'ok' if ok else 'MISMATCH'}")
    if failed:
        raise SystemExit("Does not reproduce the published row: nothing written.")


def diagnostics(parts):
    """What the NEET-approx group is made of (internal: printed, not written)."""
    frame, neet, weight = parts["frame"], parts["neet"], parts["weight"]
    print("NEET-approx by the data's employment status (records, weighted):")
    status = frame["employment_status"].to_numpy()
    for name in sorted(set(status[neet])):
        mask = neet & (status == name)
        print(f"  {name}: {int(mask.sum())}, {weight[mask].sum():,.0f}")
    training = neet & frame["in_approved_training"].to_numpy(dtype=bool)
    hours = neet & (frame["hours_worked"].to_numpy(dtype=float) > 0)
    print(f"  in approved training: {int(training.sum())}, {weight[training].sum():,.0f}")
    print(f"  with hours worked: {int(hours.sum())}, {weight[hours].sum():,.0f}")


def main(argv=None):
    arguments = parse_arguments(argv)
    for name in TOKEN_VARIABLES:
        os.environ.pop(name, None)
    sys.path.insert(0, str(ROOT / "src"))
    import pandas as pd

    from uk_budget_data import local_build

    extract = arguments.extract.expanduser() if arguments.extract else None
    if extract and ROOT / "public" in extract.resolve().parents:
        raise SystemExit("Keep the extract outside public/: it is microdata.")
    if extract and extract.is_file():
        print(f"Reading {extract} (no simulation built).")
        frame = pd.read_csv(extract)
    else:
        take_lock()
        try:
            print(f"{time.strftime('%H:%M')} lock taken: {LOCK.read_text().strip()}", flush=True)
            frame = read_people(arguments.year)
        finally:
            release_lock()
            print(f"{time.strftime('%H:%M')} lock released", flush=True)
        if extract:
            extract.parent.mkdir(parents=True, exist_ok=True)
            frame.to_csv(extract, index=False)
            print(f"Wrote {extract}")

    summary, parts = summarise(frame, arguments.year, local_build.LABEL)
    reconcile(parts, arguments.year)
    diagnostics(parts)
    arguments.output.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(summary["groups"], indent=2))
    print(f"NEET-approx total: {summary['neet_approx_total']}")
    print(f"Wrote {arguments.output}")


if __name__ == "__main__":
    main()
