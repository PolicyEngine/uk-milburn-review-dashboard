"""The phased move into work: public/data/milburn_entry_path.json.

Arithmetic on runs, not a run of the scenario
(docs/milburn-phased-scenario-design.md, section 5). For an assumed share
``s`` of a group's non-workers moving into work, each additive figure is

    static + s × (all_move − static)

from the static package and the run in which everyone in the group moves.
That is the expected value over who moves, if movers are a random draw
from the group; no particular people are simulated. Relative poverty is
first-order only (the line moves with the median), and is withheld when it
fails the linearity check. A path on the phased package also carries
``share_of_group``: its movers over the whole group the full package's run
holds, as its ``share`` is of those reached.

Reads the runs from staging (each with its private counts, which never
reach public/):

    --static        the static report package (milburn_report_package)
    --static-phased the phased report package (milburn_report_package_phased)
    --runs          the folder holding the five entry runs by id

The floor, on top of each run's own (apply_flat_floor):

1. a figure is withheld if any input cell is withheld;
2. the movers must rest on at least SURVEY_HOUSEHOLD_FLOOR survey
   households (the all-move run's ``direct`` count, row "all");
3. a count-based figure (poverty, 16 to 24s in losing households) is
   withheld unless the two runs' counts of households whose status changes
   differ by at least the floor (a lower bound on the households whose
   status differs between them), or the two values are equal;
4. the with-PIP and rollout figures are also held to rules 2 and 3 against
   the health-element run, whose difference would give back the PIP-only
   or unreached movers.

Refuses to write if the runs' model builds differ, if any count is
missing, or if an all-move run differs from its static before April 2029.

    .venv/bin/python scripts/milburn_entry_path.py \\
        --static ~/milburn-runs/2026-11-18-floor/milburn_report_package \\
        --static-phased ~/milburn-runs/2026-11-18-floor/milburn_report_package_phased \\
        --runs ~/milburn-runs/2026-11-18-phased
"""

import argparse
import csv
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from uk_budget_data.budget_measures import (  # noqa: E402
    milburn_design as design,
)
from uk_budget_data.publication.disclosure_floor import (  # noqa: E402
    SURVEY_HOUSEHOLD_FLOOR,
)

OUTPUT = ROOT / "public" / "data" / "milburn_entry_path.json"
YEARS = tuple(range(2027, design.LAST_POLICY_YEAR + 1))
COUNTS_FILE = "disclosure_counts.private.csv"
UC_ONLY = "milburn_report_package_entry_all_uc_health"
WITH_PIP = "milburn_report_package_entry_all_with_pip"
PHASED = "milburn_report_package_phased_entry_all_uc_health"
CHECK = "milburn_report_package_entry_check_with_pip"
COMPLEMENT = "milburn_report_package_entry_check_complement_with_pip"
POVERTY = ("abs_bhc", "rel_ahc")
YOUNG = "16-24"
# The linearity check's tolerances, fixed before the runs: the residual
# (r_share − static) + (r_complement − static) − (all − static), against
# the increment (all − static). Pure interaction between movers; no draw
# noise. A figure that fails is withheld on every full-package path.
CHECK_TOLERANCE = {
    "exchequer_bn": 0.02,
    "poverty_pp": 0.05,
    "young_losing_pct": 0.05,
}
# Below these, a residual is rounding (the page's own precision)
CHECK_ABSOLUTE = {
    "exchequer_bn": 0.0005,
    "poverty_pp": 0.005,
    "young_losing_pct": 0.005,
}
BUILD_KEYS = ("build", "dataset_sha256", "engine", "certified", "policyengine")


def rows(path):
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def num(value):
    return None if value in (None, "") else float(value)


class Run:
    """One run's floored tables and private counts, by year."""

    def __init__(self, folder: Path):
        self.folder = folder
        self.id = folder.name
        if not (folder / COUNTS_FILE).exists():
            raise SystemExit(f"{folder}: no {COUNTS_FILE}; rerun it staged.")
        self.build = json.loads((folder / "model_build.json").read_text())
        self.budget = {
            int(r["year"]): num(r["value"])
            for r in rows(folder / "budgetary_impact.csv")
        }
        self.metrics = {
            int(r["year"]): r for r in rows(folder / "metrics.csv")
        }
        self.age = {
            (int(r["year"]), r["age_band"]): r
            for r in rows(folder / "age_impact.csv")
        }
        self.counts = {
            (r["table"], int(r["year"]), r["row"], r["column"]): int(
                r["count"]
            )
            for r in rows(folder / COUNTS_FILE)
        }

    def count(self, table, year, row, column):
        key = (table, year, row, column)
        if key not in self.counts:
            raise SystemExit(f"{self.id}: no count for {key}; refusing.")
        return self.counts[key]

    def values(self, year):
        """The additive figures, None where withheld."""
        metrics = self.metrics[year]
        young = self.age[(year, YOUNG)]
        everyone = self.age[(year, "all")]
        return {
            "exchequer_bn": self.budget.get(year),
            **{
                f"poverty_pp_{m}": num(metrics[f"poverty_{m}_change_pp"])
                for m in POVERTY
            },
            "young_losing_pct": num(young["pct_worse_off"]),
            "movers_all": num(everyone["people_directly_affected"]),
            "population": num(everyone["people"]),
        }

    def figure_counts(self, year):
        return {
            **{
                f"poverty_pp_{m}": self.count(
                    "metrics", year, "all", f"poverty_{m}"
                )
                for m in POVERTY
            },
            "young_losing_pct": self.count("age_impact", year, YOUNG, "worse"),
            "direct": self.count("age_impact", year, "all", "direct"),
        }


def same_build(runs):
    first = runs[0]
    for run in runs[1:]:
        for key in BUILD_KEYS:
            if run.build.get(key) != first.build.get(key):
                raise SystemExit(
                    f"{run.id} and {first.id} differ in {key}: refusing."
                )
    return {key: first.build[key] for key in ("label", *BUILD_KEYS)}


def check_pre_start(all_move, static):
    for year in YEARS:
        if year >= design.REPORT_START_YEAR:
            continue
        a, s = all_move.values(year), static.values(year)
        for key in (
            "exchequer_bn",
            "poverty_pp_abs_bhc",
            "poverty_pp_rel_ahc",
        ):
            if (a[key] or 0) != (s[key] or 0):
                raise SystemExit(
                    f"{all_move.id} differs from {static.id} in {year} "
                    f"({key}), before the changes start: refusing."
                )


def wide_enough(n_a, n_b, v_a, v_b):
    """Rule 3: the two runs' counts differ by at least the floor, or the
    values are equal (nothing to give back)."""
    return v_a == v_b or abs(n_a - n_b) >= SURVEY_HOUSEHOLD_FLOOR


def derive(all_move, static, share_of, year, against=None, dropped=()):
    """One path's figures in one year: {key: (static, scenario)} plus the
    movers, with each withheld figure as None and its reason."""
    share = share_of(year)
    a, s = all_move.values(year), static.values(year)
    withheld = {}
    out = {"share": share}
    if share == 0:
        out["movers"] = 0
    if year < design.REPORT_START_YEAR:
        out["no_change"] = True
        return out, withheld
    counts_a, counts_s = all_move.figure_counts(year), static.figure_counts(
        year
    )
    thin_movers = counts_a["direct"] < SURVEY_HOUSEHOLD_FLOOR
    if against is not None:
        counts_x = against.figure_counts(year)
        # The other run's movers are a subset: equal counts are the same
        # households, a gap under the floor gives back a thin group
        gap = abs(counts_a["direct"] - counts_x["direct"])
        if 0 < gap < SURVEY_HOUSEHOLD_FLOOR:
            thin_movers = True
    movers = a["movers_all"]
    out["movers"] = (
        None
        if thin_movers or movers is None
        else round(share * movers / 1000) * 1000
    )
    if out["movers"] is None:
        withheld["movers"] = "movers rest on too few survey households"
    for key in (
        "exchequer_bn",
        *[f"poverty_pp_{m}" for m in POVERTY],
        "young_losing_pct",
    ):
        base = key if not key.startswith("poverty_pp_") else "poverty_pp"
        reason = None
        if a[key] is None or s[key] is None:
            reason = "an input is withheld under the floor"
        elif thin_movers:
            reason = "movers rest on too few survey households"
        elif key in dropped:
            reason = "failed the linearity check"
        elif key != "exchequer_bn" and not wide_enough(
            counts_a[key], counts_s[key], a[key], s[key]
        ):
            reason = "the difference rests on too few survey households"
        elif key != "exchequer_bn" and against is not None:
            x = against.values(year)
            counts_x = against.figure_counts(year)
            if x[key] is None or not wide_enough(
                counts_a[key], counts_x[key], a[key], x[key]
            ):
                reason = "would give back a thin difference between paths"
        if reason:
            withheld[key] = reason
            out[key] = {"static": s[key], "scenario": None}
            continue
        scenario = s[key] + share * (a[key] - s[key])
        out[key] = {"static": s[key], "scenario": scenario}
        if key.startswith("poverty_pp_"):
            out[key.replace("pp", "people")] = {
                "static": _people(s[key], s["population"]),
                "scenario": _people(scenario, s["population"]),
            }
    return out, withheld


def _people(pp, population):
    """A poverty change in points as people, to the nearest thousand."""
    return round(pp / 100 * population / 1000) * 1000


def linearity(all_move, static, part, complement):
    """The check: residual over increment per figure and year, and the
    figures that fail (withheld on every full-package path)."""
    results, failed = [], set()
    for year in YEARS:
        if year < design.REPORT_START_YEAR:
            continue
        a, s = all_move.values(year), static.values(year)
        p, c = part.values(year), complement.values(year)
        for key, base in (
            ("exchequer_bn", "exchequer_bn"),
            *[(f"poverty_pp_{m}", "poverty_pp") for m in POVERTY],
            ("young_losing_pct", "young_losing_pct"),
        ):
            values = (a[key], s[key], p[key], c[key])
            if any(v is None for v in values):
                results.append(
                    {"year": year, "figure": key, "result": "withheld input"}
                )
                failed.add(key)
                continue
            increment = a[key] - s[key]
            residual = (p[key] - s[key]) + (c[key] - s[key]) - increment
            ok = abs(residual) <= max(
                CHECK_ABSOLUTE[base], CHECK_TOLERANCE[base] * abs(increment)
            )
            if not ok:
                failed.add(key)
            results.append(
                {
                    "year": year,
                    "figure": key,
                    "residual_share_of_increment": (
                        None
                        if increment == 0
                        else round(residual / increment, 4)
                    ),
                    "pass": ok,
                }
            )
    return results, failed


PATHS = (
    # id, run, static, share, against (rule 4), label, shown on the tab
    ("central", UC_ONLY, "static", "table3", None, True),
    ("flat", UC_ONLY, "static", "flat", None, True),
    ("with_pip", WITH_PIP, "static", "table3", UC_ONLY, True),
    ("rollout", PHASED, "static_phased", "flat", UC_ONLY, True),
    ("unrebased", UC_ONLY, "static", "table3_unrebased", None, False),
)


def clean(value):
    if isinstance(value, float):
        return None if math.isnan(value) else round(value, 6)
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items()}
    if isinstance(value, list):
        return [clean(v) for v in value]
    return value


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--static", type=Path, required=True)
    parser.add_argument("--static-phased", type=Path, required=True)
    parser.add_argument("--runs", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args(argv)
    design.check_entry_design()
    runs = {
        "static": Run(args.static.expanduser()),
        "static_phased": Run(args.static_phased.expanduser()),
        **{
            rid: Run(args.runs.expanduser() / rid)
            for rid in (UC_ONLY, WITH_PIP, PHASED, CHECK, COMPLEMENT)
        },
    }
    build = same_build(list(runs.values()))
    for rid, static in (
        (UC_ONLY, "static"),
        (WITH_PIP, "static"),
        (CHECK, "static"),
        (COMPLEMENT, "static"),
        (PHASED, "static_phased"),
    ):
        check_pre_start(runs[rid], runs[static])
    check, failed = linearity(
        runs[WITH_PIP], runs["static"], runs[CHECK], runs[COMPLEMENT]
    )
    paths, withheld_all = [], []
    for path_id, rid, static, share_path, against, shown in PATHS:
        full = static == "static"
        by_year = {}
        for year in YEARS:
            figures, withheld = derive(
                runs[rid],
                runs[static],
                lambda y, p=share_path: design.report_entry_share(y, p),
                year,
                against=runs[against] if against else None,
                dropped=failed,
            )
            # The rollout path's share is of those the phased package has
            # reached; its movers over the whole group (everyone the full
            # package's group holds) is what the share chart plots
            if not full and figures.get("movers") is not None:
                reached = runs[rid].values(year)["movers_all"]
                group = runs[UC_ONLY].values(year)["movers_all"]
                figures["share_of_group"] = (
                    0.0
                    if figures["share"] == 0
                    else figures["share"] * reached / group
                    if reached is not None and group
                    else None
                )
            by_year[str(year)] = figures
            withheld_all += [
                {"path": path_id, "year": year, "figure": k, "reason": r}
                for k, r in withheld.items()
            ]
        paths.append(
            {
                "id": path_id,
                "share_path": share_path,
                "base": "phased" if not full else "full",
                "on_tab": shown,
                "years": by_year,
            }
        )
    out = clean(
        {
            "status": "ok",
            "method": (
                "static + share × (everyone moves − static), the expected "
                "value over who moves, if movers are a random draw from the "
                "group"
                + (
                    "; relative poverty is withheld (it failed the linearity "
                    "check)"
                    if "poverty_pp_rel_ahc" in failed
                    else "; relative poverty first-order only"
                )
            ),
            "years": list(YEARS),
            "start_year": design.REPORT_START_YEAR,
            "effect": design.REPORT_ENTRY_EFFECT,
            "neet_gap_pp": {
                str(k): v for k, v in design.REPORT_NEET_GAP_PP.items()
            },
            "rebase_year": design.REPORT_ENTRY_REBASE_YEAR,
            "hours": design.ENTRY_HOURS,
            "people_basis": "age_impact.csv, row all, people (the summary's)",
            "model_build": build,
            "paths": paths,
            "linearity_check": {
                "runs": [CHECK, COMPLEMENT],
                "share": design.REPORT_ENTRY_CHECK_SHARE,
                "tolerance": CHECK_TOLERANCE,
                "covers": "the full package with PIP recipients; the rollout path is not checked",
                "results": check,
                "failed": sorted(failed),
            },
            "withheld": withheld_all,
        }
    )
    args.output.write_text(json.dumps(out, indent=2) + "\n")
    print(f"wrote {args.output}")
    for path in paths:
        for year, fig in path["years"].items():
            if int(year) < design.REPORT_START_YEAR:
                continue

            def sc(key):
                v = fig.get(key)
                return None if not v else v.get("scenario")

            print(
                path["id"],
                year,
                f"share={fig['share']:.4f}",
                f"movers={fig.get('movers')}",
                f"exch={sc('exchequer_bn')}",
                f"static={fig['exchequer_bn']['static']}",
                f"abs_bhc={sc('poverty_pp_abs_bhc')}",
                f"rel_ahc={sc('poverty_pp_rel_ahc')}",
                f"young_losing={sc('young_losing_pct')}",
            )
    print("check failed:", sorted(failed))
    print("withheld:", len(withheld_all))
    for w in withheld_all:
        print("  ", w)


if __name__ == "__main__":
    main()
