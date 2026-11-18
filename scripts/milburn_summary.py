"""Summarise the Milburn flat runs into one table of headline figures.

Reads public/data/milburn/<id>/ (budgetary_impact, age_impact, metrics,
model_build.json) and public/data/milburn_scenarios.json, and writes
public/data/milburn_summary.json plus a Markdown table on stdout.

Every year the runs cover goes under "by_year" (the default year's also
under "runs"); the break-even arithmetic is for YEAR only, the year of the
household entry cases. Static figures only. The return-to-work break-even is arithmetic on the
run's Exchequer saving and the household entry-to-work case, labelled as
illustrative.
"""

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNS = ROOT / "public" / "data" / "milburn"
YEAR = 2029
# Runs whose files stay (loadable by link) but which no summary figure
# reads: the pre-report 25% move into work, replaced on the tab by the
# phased scenario (scripts/milburn_entry_path.py)
OFF_SUMMARY = {"milburn_package_entry_25pct"}


def num(value):
    """A cell as a float, or None for an empty (withheld) cell: the flat
    route blanks a statistic resting on fewer than 3 survey households
    (publication.disclosure_floor.apply_flat_floor)."""
    return None if value in (None, "") else float(value)


def rounded(value, digits=None):
    return None if value is None else round(value, digits)


def rows(path):
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


# The run's direction's conditional mean in age_impact.csv
# (calculators.AGE_CONDITIONAL_COLUMNS): the mean change among the people
# in losing (or gaining) households only.
CONDITIONAL_COLUMN = {
    False: "mean_change_worse_off",
    True: "mean_change_better_off",
}
# Without that column, a run whose 16-24s both gain and lose by more than
# this share (%) has no average: the netted mean would misstate it.
MIXED_SHARE_PCT = 0.05


def average_loss(young: dict, gains: bool):
    """The average change in household net income for a 16-24-year-old in
    a losing household (positive: a loss), or in a gaining household for a
    gain run (negative: a gain), with how it was found.

    Read from the row's conditional mean for the run's direction. A file
    from before that column falls back to the netted mean over all 16-24s
    divided by the share on the run's side, which is exact only when no
    16-24 is on the other side: when both shares are over MIXED_SHARE_PCT,
    the average is None. Returns (average or None, basis)."""
    column = CONDITIONAL_COLUMN[gains]
    if column in young:
        value = young[column]
        # Withheld under the disclosure floor: with its own side's share,
        # or with the other side's (whose total it would give back)
        if value in (None, "") and (
            young.get("pct_worse_off") in (None, "")
            or young.get("pct_better_off") in (None, "")
        ):
            return None, "not available: withheld under the disclosure floor"
        if value in (None, ""):
            return None, (
                "not available: too few survey records in "
                + ("gaining" if gains else "losing")
                + " households"
            )
        return -float(value), (
            "mean change among 16-24s in "
            + ("gaining" if gains else "losing")
            + " households"
        )
    better = num(young["pct_better_off"])
    worse = num(young["pct_worse_off"])
    if better is None or worse is None:
        return None, "not available: withheld under the disclosure floor"
    if min(better, worse) > MIXED_SHARE_PCT:
        return None, (
            "not available: 16-24s both gain and lose and the file has no"
            " conditional mean, so the netted mean would misstate it"
        )
    share = (better if gains else worse) / 100
    if not share:
        return None, "not available: no 16-24s affected"
    return -float(young["mean_change"]) / share, (
        "netted mean over all 16-24s divided by the share affected"
        " (file without the conditional mean; under "
        f"{MIXED_SHARE_PCT}% on the other side)"
    )


def summarise(run_dir: Path, scenarios: dict, year: int = YEAR) -> dict:
    build = json.loads((run_dir / "model_build.json").read_text())
    rid = run_dir.name
    budget = {
        int(r["year"]): float(r["value"])
        for r in rows(run_dir / "budgetary_impact.csv")
    }
    ages = {
        r["age_band"]: r
        for r in rows(run_dir / "age_impact.csv")
        if int(r["year"]) == year
    }
    metrics = next(
        r for r in rows(run_dir / "metrics.csv") if int(r["year"]) == year
    )
    young = ages["16-24"]
    people = float(young["people"])
    everyone = float(ages["all"]["people"])
    worse = num(young["pct_worse_off"])
    better = num(young["pct_better_off"])
    if worse is not None and better is not None:
        gains = better > worse
    else:
        # A side withheld under the floor: the run's direction is the
        # Exchequer's (a saving is a loss to households)
        gains = budget.get(year, 0) < 0
    share = (better if gains else worse)
    share = None if share is None else share / 100
    affected = None if share is None else people * share
    loss_affected, loss_basis = average_loss(young, gains)

    def poverty_people(measure):
        # A withheld rate takes its people count with it
        pp = num(metrics[f"poverty_{measure}_change_pp"])
        return None if pp is None else round(pp / 100 * everyone)

    def pp(column):
        return rounded(num(metrics[column]), 3)

    out = {
        "id": rid,
        "label": build["label"],
        "saving_bn": {str(y): round(v, 3) for y, v in sorted(budget.items())},
        "direction": "gain" if gains else "loss",
        "young_people_in_losing_households": rounded(affected),
        "share_of_16_24_in_losing_households_pct": rounded(
            None if share is None else share * 100, 2
        ),
        "average_loss_young_person_in_losing_household": (
            round(loss_affected) if loss_affected is not None else None
        ),
        "average_loss_basis": loss_basis,
        "everyone_in_losing_households_pct": rounded(
            num(ages["all"]["pct_worse_off"]), 2
        ),
        "poverty_change_pp": {
            k: pp(f"poverty_{k}_change_pp")
            for k in ("rel_bhc", "rel_ahc", "abs_bhc", "abs_ahc")
        },
        "people_into_poverty_abs_ahc": poverty_people("abs_ahc"),
        "people_into_poverty_rel_ahc": poverty_people("rel_ahc"),
        "child_poverty_change_pp_rel_ahc": pp(
            "child_poverty_rel_ahc_change_pp"
        ),
        # Before housing costs: the page's default poverty measure
        "people_into_poverty_abs_bhc": poverty_people("abs_bhc"),
        "people_into_poverty_rel_bhc": poverty_people("rel_bhc"),
        "child_poverty_change_pp_rel_bhc": pp(
            "child_poverty_rel_bhc_change_pp"
        ),
    }
    # People whose own earnings or taxes change (calculators.py): the movers
    # in a run with a move into work, none in a static run. Null when
    # withheld under the floor.
    if "people_directly_affected" in ages["all"]:
        out["people_directly_affected"] = rounded(
            num(ages["all"]["people_directly_affected"])
        )
    # Illustrative break-even, one definition throughout: the entrants
    # whose gains from work (16 or 25 hours at the National Living Wage)
    # would add up to the total static income loss, approximated by the
    # Exchequer saving, and those entrants as a share of the young people
    # in losing households. Gains from work come from the household case
    # (a single 22-year-old renter with LCWRA); a household with PIP or a
    # partner gains differently, so this is an order of magnitude, not an
    # estimate.
    # The break-even uses the saving and the count of young people in
    # losing households, not the average loss, so it does not wait on it.
    # The household entry cases are for YEAR (2029-30) only
    if not gains and affected and scenarios and year == YEAR:
        cases = scenarios.get("entry_cases", [])
        saving = budget.get(YEAR, 0) * 1e9
        entrants = {
            c["id"]: saving / c["net_income_gain_package"] for c in cases
        }
        # Entrants needed as a share of the young people in losing
        # households. Above 100%: more entrants than there are young
        # people in those households. The household loss is counted once
        # here (in the saving), not once per young person in it.
        out["break_even_share_in_work_pct"] = {
            k: round(100 * v / affected, 1) for k, v in entrants.items()
        }
        out["entrants_to_match_income_loss"] = {
            k: round(v) for k, v in entrants.items()
        }
        out["exchequer_gain_per_entrant"] = {
            c["id"]: c["exchequer_gain_package"] for c in cases
        }
    return out


def count_text(people, share):
    if people is None:
        return "withheld"
    return f"{people/1000:.0f}k ({share:.1f}%)"


def poverty_text(pp, people):
    if pp is None:
        return "withheld"
    return f"{pp:+.2f}pp ({people/1000:.0f}k)"


def loss_text(value):
    return "–" if value is None else f"£{value:,}"


def main():
    sp = ROOT / "public" / "data" / "milburn_scenarios.json"
    scenarios = json.loads(sp.read_text()) if sp.exists() else {}
    folders = [
        d
        for d in sorted(RUNS.iterdir())
        if (d / "model_build.json").exists() and d.name not in OFF_SUMMARY
    ]
    results = [summarise(d, scenarios) for d in folders]
    # Every year the runs cover, under the same floor (the cells each run's
    # files withhold), so the page's figures follow its year selector;
    # "year" and "runs" stay the default year's, as before
    years = sorted(
        {
            year
            for d in folders
            for year in json.loads((d / "model_build.json").read_text())[
                "years"
            ]
        }
    )
    by_year = {
        str(year): (
            results
            if year == YEAR
            else [summarise(d, scenarios, year) for d in folders]
        )
        for year in years
    }
    (ROOT / "public" / "data" / "milburn_summary.json").write_text(
        json.dumps(
            {"year": YEAR, "runs": results, "years": years, "by_year": by_year},
            indent=2,
        )
        + "\n"
    )
    w = sys.stdout.write
    w(
        "| Measure | Saving 2029-30 | 16-24s in losing households |"
        " Avg loss (losing hh) | Absolute AHC poverty |"
        " Entrants needed, share of 16-24s in losing households 16h / 25h |\n"
    )
    w("|---|---|---|---|---|---|\n")
    for r in results:
        be = r.get("break_even_share_in_work_pct", {})
        w(
            f"| {r['id']} | £{r['saving_bn'][str(YEAR)]:.2f}bn |"
            f" {count_text(r['young_people_in_losing_households'], r['share_of_16_24_in_losing_households_pct'])} |"
            f" {loss_text(r['average_loss_young_person_in_losing_household'])} |"
            f" {poverty_text(r['poverty_change_pp']['abs_ahc'], r['people_into_poverty_abs_ahc'])} |"
            f" {be.get('h16', '–')}% / {be.get('h25', '–')}% |\n"
        )


if __name__ == "__main__":
    main()
