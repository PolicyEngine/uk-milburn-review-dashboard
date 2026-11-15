"""Summarise the Milburn flat runs into one table of headline figures.

Reads public/data/milburn/<id>/ (budgetary_impact, age_impact, metrics,
model_build.json) and public/data/milburn_scenarios.json, and writes
public/data/milburn_summary.json plus a Markdown table on stdout.

Static figures only. The return-to-work break-even is arithmetic on the
model's average loss and the household entry-to-work case, labelled as
illustrative.
"""

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNS = ROOT / "public" / "data" / "milburn"
YEAR = 2027


def rows(path):
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def summarise(run_dir: Path, scenarios: dict) -> dict:
    build = json.loads((run_dir / "model_build.json").read_text())
    rid = run_dir.name
    budget = {
        int(r["year"]): float(r["value"])
        for r in rows(run_dir / "budgetary_impact.csv")
    }
    ages = {
        r["age_band"]: r
        for r in rows(run_dir / "age_impact.csv")
        if int(r["year"]) == YEAR
    }
    metrics = next(
        r for r in rows(run_dir / "metrics.csv") if int(r["year"]) == YEAR
    )
    young = ages["16-24"]
    people = float(young["people"])
    worse = float(young["pct_worse_off"]) / 100
    better = float(young["pct_better_off"]) / 100
    gains = better > worse
    if gains:
        worse = better
    mean_change = float(young["mean_change"])
    affected = people * worse
    # Average change in household net income for a young person in an
    # affected household (household-level loss attributed to the person).
    loss_affected = (-mean_change / worse if worse else None)
    out = {
        "id": rid,
        "label": build["label"],
        "saving_bn": {str(y): round(v, 3) for y, v in sorted(budget.items())},
        "direction": "gain" if gains else "loss",
        "young_people_in_losing_households": round(affected),
        "share_of_16_24_in_losing_households_pct": round(worse * 100, 2),
        "average_loss_young_person_in_losing_household": (
            round(loss_affected) if loss_affected is not None else None
        ),
        "everyone_in_losing_households_pct": round(
            float(ages["all"]["pct_worse_off"]), 2
        ),
        "poverty_change_pp": {
            k: round(float(metrics[f"poverty_{k}_change_pp"]), 3)
            for k in ("rel_bhc", "rel_ahc", "abs_bhc", "abs_ahc")
        },
        "people_into_poverty_abs_ahc": round(
            float(metrics["poverty_abs_ahc_change_pp"])
            / 100
            * float(ages["all"]["people"])
        ),
        "people_into_poverty_rel_ahc": round(
            float(metrics["poverty_rel_ahc_change_pp"])
            / 100
            * float(ages["all"]["people"])
        ),
        "child_poverty_change_pp_rel_ahc": round(
            float(metrics["child_poverty_rel_ahc_change_pp"]), 3
        ),
    }
    # Illustrative break-even: the share of young people in losing
    # households who would need to move into work (16 or 25 hours at the
    # National Living Wage) for the group's average income to return to
    # where it was. Gains from work come from the household case (a single
    # 22-year-old renter with LCWRA); a household with PIP or a partner
    # gains differently, so this is an order of magnitude, not an estimate.
    if loss_affected and loss_affected > 0 and not gains and scenarios:
        cases = scenarios.get("entry_cases", [])
        # s = L / g: the share of young people in losing households who
        # would need to move into work for the group's average income to
        # recover. Above 100% means no entry rate at these hours restores
        # it. Arithmetic, not an incentive the reform creates: the gain
        # from work is the same under current law and the package.
        out["break_even_share_in_work_pct"] = {
            c["id"]: round(100 * loss_affected / c["net_income_gain_package"], 1)
            for c in cases
        }
        # Entrants whose gains from work would match the total static
        # income loss (approximated by the Exchequer saving).
        saving = budget.get(YEAR, 0) * 1e9
        out["entrants_to_match_income_loss"] = {
            c["id"]: round(saving / c["net_income_gain_package"])
            for c in cases
        }
        out["exchequer_gain_per_entrant"] = {
            c["id"]: c["exchequer_gain_package"] for c in cases
        }
    return out


def main():
    sp = ROOT / "public" / "data" / "milburn_scenarios.json"
    scenarios = json.loads(sp.read_text()) if sp.exists() else {}
    results = [
        summarise(d, scenarios)
        for d in sorted(RUNS.iterdir())
        if (d / "model_build.json").exists()
    ]
    (ROOT / "public" / "data" / "milburn_summary.json").write_text(
        json.dumps({"year": YEAR, "runs": results}, indent=2) + "\n"
    )
    w = sys.stdout.write
    w(
        "| Measure | Saving 2027-28 | 16-24s in losing households |"
        " Avg loss (losing hh) | Relative AHC poverty | Break-even 16h / 25h |\n"
    )
    w("|---|---|---|---|---|---|\n")
    for r in results:
        be = r.get("break_even_share_in_work_pct", {})
        w(
            f"| {r['id']} | £{r['saving_bn'][str(YEAR)]:.2f}bn |"
            f" {r['young_people_in_losing_households']/1000:.0f}k"
            f" ({r['share_of_16_24_in_losing_households_pct']:.1f}%) |"
            f" £{r['average_loss_young_person_in_losing_household'] or 0:,} |"
            f" {r['poverty_change_pp']['rel_ahc']:+.2f}pp"
            f" ({r['people_into_poverty_rel_ahc']/1000:.0f}k) |"
            f" {be.get('h16', '–')}% / {be.get('h25', '–')}% |\n"
        )


if __name__ == "__main__":
    main()
