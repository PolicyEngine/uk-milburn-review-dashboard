"""Household examples for the Milburn review dashboard: four typical young
people in 2029-30, each under current law and under the report's runs.

Household calculations only (no survey data), built as
``uk_budget_data.milburn_scenarios`` builds its household: a situation
passed to ``personal_impact.household_simulations`` with the run's reform
from ``reforms.get_reform``, on the forecast. Every figure is read from the
engine; the inputs in ``CASES`` are entered by hand, and the assumptions
text names three engine values in words (the £180 TV licence, the 0.16%
pay adjustment and the 55% taper): check them if the engine changes.

The runs:

- ``milburn_report_package``: the health element and PIP removals together
  (the package holds those two and nothing else);
- ``milburn_report_uc_health`` and ``milburn_report_pip``: its two parts;
- ``milburn_report_youth_allowance_independent`` and
  ``milburn_report_employer_nics_threshold``: separate runs, not in the
  package, so they are never added to its figure.

Usage::

    .venv/bin/python scripts/milburn_household_examples.py \\
        --output public/data/milburn_households.json
"""

import argparse
import json
import warnings
from pathlib import Path

from uk_budget_data import local_build
from uk_budget_data.models import DataConfig
from uk_budget_data.reforms import get_reform

YEAR = 2029
FISCAL_YEAR = "2029-30"
LABEL = f"PolicyEngine household calculation, {FISCAL_YEAR}"
# As uk_budget_data.milburn_scenarios: £500 a month, North West.
ANNUAL_RENT = 6_000
REGION = "NORTH_WEST"
WEEKS_IN_YEAR = 52
RETAIL_SIC_DIVISION = 47
# A change smaller than this (£ a year) is rounding, not a change.
TOLERANCE = 0.005
# A breakdown line smaller than this (£ a year) is left out: the engine
# works in single precision, so pennies of rounding are not a line.
LINE_TOLERANCE = 0.05

RUNS = (
    ("milburn_report_package", "The report's package"),
    ("milburn_report_uc_health", "Health element removal"),
    ("milburn_report_pip", "PIP removal"),
    (
        "milburn_report_youth_allowance_independent",
        "Youth Allowance, higher rate",
    ),
    ("milburn_report_employer_nics_threshold", "Employer NI threshold"),
)
PACKAGE_ID = RUNS[0][0]
# The package's two parts: a card shows them as the package's breakdown.
PACKAGE_PARTS = ("milburn_report_uc_health", "milburn_report_pip")


def run_list() -> list[dict]:
    """The runs as the file lists them: ``part_of_package`` marks the
    package and its parts, the others are separate runs."""
    return [
        {
            "id": run_id,
            "name": name,
            "part_of_package": run_id == PACKAGE_ID or run_id in PACKAGE_PARTS,
        }
        for run_id, name in RUNS
    ]


# Each case's inputs. ``hours`` is paid at the engine's minimum wage for the
# person's age in YEAR; ``new_health_claim`` is the post-April 2026
# new-claimant health element rate (false: the protected rate).
CASES = (
    {
        "id": "with_parents_health",
        "title": "20-year-old living with parents",
        "description": (
            "Lives with parents and pays no rent; gets the Universal Credit "
            "health element and standard-rate PIP daily living; no earnings."
        ),
        "age": 20,
        "rent": 0,
        "lcwra": True,
        "new_health_claim": True,
        "pip_daily_living": "STANDARD",
        "hours": 0,
        "notes": [
            "Modelled as a one-person household with no housing costs: the "
            "parents' income and any housing support of theirs are not "
            "part of the calculation.",
            "Claimed after April 2026, so is paid the new-claimant rate of "
            "the health element under current law.",
        ],
    },
    {
        "id": "renting_health",
        "title": "22-year-old renting alone",
        "description": (
            "Rents alone in the North West; gets the Universal Credit "
            "health element and enhanced-rate PIP daily living; no earnings."
        ),
        "age": 22,
        "rent": ANNUAL_RENT,
        "lcwra": True,
        "new_health_claim": False,
        "pip_daily_living": "ENHANCED",
        "hours": 0,
        "notes": [
            "Claimed before April 2026, so is paid the protected rate of "
            "the health element under current law.",
            "A single renter under 35 is held to the shared accommodation "
            "rate unless they get the PIP daily living component. With PIP "
            "the housing element covers the rent; without it the element "
            "falls to the shared rate.",
        ],
    },
    {
        "id": "renting_part_time",
        "title": "23-year-old in part-time retail work",
        "description": (
            "Rents alone in the North West; no health condition; works 16 "
            "hours a week in retail at the minimum wage, on Universal Credit."
        ),
        "age": 23,
        "rent": ANNUAL_RENT,
        "lcwra": False,
        "new_health_claim": False,
        "pip_daily_living": None,
        "hours": 16,
        "sic_division": RETAIL_SIC_DIVISION,
        "notes": [
            "The housing element is the shared accommodation rate, below "
            "the rent, under current law and under every run.",
            "The employer National Insurance run raises the point at which "
            "the employer pays from £5,000 to £10,000 a year. The engine "
            "holds the employer's total cost of the job fixed, so the "
            "saving is paid as higher wages, and Universal Credit is "
            "withdrawn against the extra pay at its 55% taper.",
        ],
    },
    {
        "id": "lone_parent",
        "title": "19-year-old lone parent",
        "description": (
            "One child aged 1; rents in the North West; on Universal Credit; "
            "no earnings."
        ),
        "age": 19,
        "rent": ANNUAL_RENT,
        "lcwra": False,
        "new_health_claim": False,
        "pip_daily_living": None,
        "hours": 0,
        "child_age": 1,
        "notes": [
            "With a child the household is not held to the shared "
            "accommodation rate, so the housing element covers the rent.",
        ],
    },
)

# What is read from each simulation (£ a year, summed over the household).
COMPONENTS = {
    "net_income": "household_net_income",
    "universal_credit": "universal_credit",
    "uc_standard_allowance": "uc_standard_allowance",
    "uc_health_element": "uc_LCWRA_element",
    "uc_housing_element": "uc_housing_costs_element",
    "pip": "pip",
    "child_benefit": "child_benefit",
    "earnings": "employment_income",
    "income_tax": "income_tax",
    "employee_ni": "ni_employee",
    "employer_ni": "ni_class_1_employer",
    "tv_licence": "tv_licence",
}

# The lines of a change in net income: (id, label, how it is computed from
# the component changes). The Universal Credit elements are shown one by
# one, and "uc_other" is the rest of the award's change: where pay changes
# it is the taper on the extra pay and is labelled so (UC_TAPER_LABEL).
# "other" takes anything left, so the lines add up to the change in net
# income (to within LINE_TOLERANCE a line).
_UC_ELEMENTS = (
    "uc_health_element",
    "uc_standard_allowance",
    "uc_housing_element",
)
BREAKDOWN = (
    ("uc_health_element", "Health element"),
    ("pip", "PIP"),
    ("uc_standard_allowance", "Youth Allowance (standard allowance)"),
    ("uc_housing_element", "Housing element"),
    ("earnings", "Pay"),
    ("uc_other", "Other Universal Credit"),
    ("tax", "Income tax and National Insurance"),
    ("other", "Other"),
)


def situation(case: dict, wage: float = 0.0) -> dict:
    """The PolicyEngine situation of a case, paid ``wage`` an hour."""
    hours = case["hours"]
    person = {
        "age": {YEAR: case["age"]},
        "employment_income": {YEAR: round(wage * hours * WEEKS_IN_YEAR, 2)},
        "hours_worked": {YEAR: hours * WEEKS_IN_YEAR},
    }
    if case["lcwra"]:
        person["uc_limited_capability_for_WRA"] = {YEAR: True}
    if case["pip_daily_living"]:
        person["pip_dl_category"] = {YEAR: case["pip_daily_living"]}
    if case.get("sic_division"):
        person["sic_industry_division"] = {YEAR: case["sic_division"]}
    people = {"person": person}
    if case.get("child_age") is not None:
        people["child"] = {"age": {YEAR: case["child_age"]}}
    members = list(people)
    benunit = {"members": members}
    if case["new_health_claim"]:
        benunit["uc_receives_new_claimant_health_element"] = {YEAR: True}
    household = {"members": members, "region": {YEAR: REGION}}
    if case["rent"]:
        household["rent"] = {YEAR: case["rent"]}
        household["tenure_type"] = {YEAR: "RENT_PRIVATELY"}
    return {
        "people": people,
        "benunits": {"benunit": benunit},
        "households": {"household": household},
    }


def minimum_wage(case: dict) -> float:
    """The engine's minimum wage in YEAR for the case's adult."""
    from policyengine_uk import Simulation

    from uk_budget_data.forecast import with_forecast

    sim = Simulation(situation=situation(case), scenario=with_forecast(None))
    return round(float(sim.calculate("minimum_wage", YEAR)[0]), 2)


UC_TAPER_LABEL = "Universal Credit withdrawn against pay"


def _components(sim) -> dict:
    return {
        name: round(float(sim.calculate(variable, YEAR).sum()), 2)
        for name, variable in COMPONENTS.items()
    }


def _label(name: str, label: str, lines: dict) -> str:
    if name == "uc_other" and abs(lines["earnings"]) >= LINE_TOLERANCE:
        return UC_TAPER_LABEL
    return label


def breakdown(current: dict, reformed: dict) -> list[dict]:
    """The change in net income, line by line; lines that do not change
    are left out, and the lines add up to the change in net income."""
    change = {name: reformed[name] - current[name] for name in current}
    lines = {name: change[name] for name in _UC_ELEMENTS}
    lines["pip"] = change["pip"]
    lines["earnings"] = change["earnings"]
    lines["uc_other"] = change["universal_credit"] - sum(
        change[name] for name in _UC_ELEMENTS
    )
    lines["tax"] = -(change["income_tax"] + change["employee_ni"])
    lines["other"] = change["net_income"] - sum(lines.values())
    return [
        {
            "id": name,
            "label": _label(name, label, lines),
            "change": round(lines[name], 2),
        }
        for name, label in BREAKDOWN
        if abs(lines[name]) >= LINE_TOLERANCE
    ]


def household_example(case: dict, run_ids=None) -> dict:
    """One case under current law and under each run in ``run_ids`` (all
    of RUNS by default)."""
    from uk_budget_data.personal_impact import household_simulations

    warnings.simplefilter("ignore")
    wage = minimum_wage(case) if case["hours"] else 0.0
    household = situation(case, wage)
    current_law = None
    runs = {}
    for run_id, _ in RUNS:
        if run_ids is not None and run_id not in run_ids:
            continue
        baseline, reformed = household_simulations(
            household, get_reform(run_id), DataConfig()
        )
        current = _components(baseline)
        if current_law is None:
            current_law = current
        elif current != current_law:
            raise ValueError(
                f"{case['id']}: {run_id} has a different current law"
            )
        after = _components(reformed)
        lines = breakdown(current, after)
        net_change = round(after["net_income"] - current["net_income"], 2)
        # Each line left out is under LINE_TOLERANCE
        if abs(sum(line["change"] for line in lines) - net_change) > (
            LINE_TOLERANCE * len(BREAKDOWN)
        ):
            raise ValueError(f"{case['id']}: {run_id} lines do not add up")
        runs[run_id] = {
            "applies": abs(net_change) >= TOLERANCE,
            "net_income": after["net_income"],
            "net_income_change": net_change,
            "components": after,
            "breakdown": lines,
        }
    inputs = {
        "age": case["age"],
        "region": REGION,
        "annual_rent": case["rent"],
        "limited_capability_for_work_related_activity": case["lcwra"],
        "health_element_rate": (
            None
            if not case["lcwra"]
            else "new_claimant"
            if case["new_health_claim"]
            else "protected"
        ),
        "pip_daily_living": case["pip_daily_living"],
        "hours_per_week": case["hours"],
        "hourly_wage": wage if case["hours"] else None,
        "annual_earnings_entered": round(
            wage * case["hours"] * WEEKS_IN_YEAR, 2
        ),
        "sic_division": case.get("sic_division"),
        "child_age": case.get("child_age"),
    }
    return {
        "id": case["id"],
        "title": case["title"],
        "description": case["description"],
        "inputs": inputs,
        "notes": list(case["notes"]),
        "current_law": current_law,
        "runs": runs,
    }


def household_examples() -> dict:
    return {
        "year": YEAR,
        "fiscal_year": FISCAL_YEAR,
        "label": LABEL,
        "build": local_build.LABEL,
        "package_id": PACKAGE_ID,
        "runs": run_list(),
        "basis": (
            f"Household calculations for {FISCAL_YEAR} ({local_build.LABEL}), "
            "on the OBR October 2026 forecast, with no survey data. Amounts "
            "are pounds a year. Each run is compared with current law for "
            "the same household."
        ),
        "assumptions": [
            f"Renters pay £{ANNUAL_RENT:,} a year (£{ANNUAL_RENT // 12} a "
            "month) to a private landlord in the North West.",
            "Benefit rates, the minimum wage and tax thresholds are the "
            f"engine's for {FISCAL_YEAR}; every award is claimed in full, "
            "all year.",
            "The report's package is the health element removal and the "
            "PIP removal. The higher Youth Allowance and the employer "
            "National Insurance threshold are separate runs and are not "
            "added to the package's figure.",
            "The report's replacement payments (such as its additional "
            "cost allowance) are not modelled, so nothing is paid in place "
            "of the health element or PIP.",
            "Net income is after taxes and benefits and after a TV licence "
            "(£180 a year in the engine), before housing costs.",
            "Pay in the engine is 0.16% below hours times the hourly wage: "
            "its allowance for employers spreading the cost of the 2029 "
            "salary sacrifice cap across all pay.",
            "Hours, wages (other than the employer National Insurance "
            "saving paid as wages) and housing costs are held fixed; no "
            "behavioural response is modelled.",
        ],
        "households": [household_example(case) for case in CASES],
    }


def write(output: Path) -> Path:
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(household_examples(), indent=2, ensure_ascii=False) + "\n"
    )
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("public/data/milburn_households.json"),
    )
    print(write(parser.parse_args().output))


if __name__ == "__main__":
    main()
