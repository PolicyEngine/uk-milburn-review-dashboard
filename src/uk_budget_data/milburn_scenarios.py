"""What a young person moving into work gains, and what the Exchequer gains,
under current law and under the Milburn package.

Household calculations only (no survey data): one single person aged 22,
renting privately, with limited capability for work and work-related
activity (LCWRA) and no PIP, on Universal Credit with no earnings, who moves
into work at 16 or 25 hours a week at the 2029-30 minimum wage for their age
(the National Living Wage, which applies from 21). Each entry case compares
the person in work with the same person out of work, once under current law
and once under ``milburn_report_package`` (the health element removal for
under-25s and the PIP removal for 18 to 24-year-olds, from April 2029), in
2029-30, the year of the report runs' saving:

- ``net_income_gain_*``: the change in household net income;
- ``exchequer_gain_*``: the change in income tax plus employee and employer
  National Insurance, plus the fall in benefit spending (``gov_balance``'s
  household parts: taxes paid less benefits received).

Usage::

    uv run uk-budget-data milburn-scenarios \\
        --output public/data/milburn_scenarios.json
"""

import json
import warnings
from pathlib import Path

from uk_budget_data import local_build
from uk_budget_data.models import DataConfig
from uk_budget_data.reforms import MILBURN_REPORT_PACKAGE_ID, get_reform

YEAR = 2029
FISCAL_YEAR = f"{YEAR}-{(YEAR + 1) % 100:02d}"
AGE = 22
# £ a year: £500 a month, below every Local Housing Allowance rate
# for one bedroom outside London, so the housing element is the rent.
ANNUAL_RENT = 6_000
REGION = "NORTH_WEST"
ENTRY_HOURS = {"h16": 16, "h25": 25}
WEEKS_IN_YEAR = 52


def _situation(employment_income: float, hours: float) -> dict:
    return {
        "people": {
            "person": {
                "age": {YEAR: AGE},
                "employment_income": {YEAR: employment_income},
                "hours_worked": {YEAR: hours * WEEKS_IN_YEAR},
                "uc_limited_capability_for_WRA": {YEAR: True},
            }
        },
        "benunits": {"benunit": {"members": ["person"]}},
        "households": {
            "household": {
                "members": ["person"],
                "rent": {YEAR: ANNUAL_RENT},
                "tenure_type": {YEAR: "RENT_PRIVATELY"},
                "region": {YEAR: REGION},
            }
        },
    }


def hourly_wage() -> float:
    """The year's minimum wage for someone of AGE, from the engine."""
    from policyengine_uk import Simulation

    from uk_budget_data.forecast import with_forecast

    sim = Simulation(situation=_situation(0, 0), scenario=with_forecast(None))
    return round(float(sim.calculate("minimum_wage", YEAR)[0]), 2)


def _measures(sim) -> dict:
    def total(variable):
        return float(sim.calculate(variable, YEAR).sum())

    tax = (
        total("income_tax")
        + total("ni_employee")
        + total("ni_class_1_employer")
    )
    return {
        "net_income": total("household_net_income"),
        "taxes": tax,
        "benefits": total("household_benefits"),
    }


def _pair(employment_income: float, hours: float, reform) -> tuple:
    from uk_budget_data.personal_impact import household_simulations

    baseline, reformed = household_simulations(
        _situation(employment_income, hours), reform, DataConfig()
    )
    return _measures(baseline), _measures(reformed)


def _gains(out_of_work: dict, in_work: dict) -> tuple[float, float]:
    net = in_work["net_income"] - out_of_work["net_income"]
    exchequer = (in_work["taxes"] - out_of_work["taxes"]) + (
        out_of_work["benefits"] - in_work["benefits"]
    )
    return round(net, 2), round(exchequer, 2)


def milburn_scenarios() -> dict:
    """The entry cases, under current law and under the package."""
    warnings.simplefilter("ignore")
    package = get_reform(MILBURN_REPORT_PACKAGE_ID)
    wage = hourly_wage()
    out_current, out_package = _pair(0, 0, package)
    cases = []
    for case_id, hours in ENTRY_HOURS.items():
        earnings = round(wage * hours * WEEKS_IN_YEAR, 2)
        in_current, in_package = _pair(earnings, hours, package)
        net_current, exchequer_current = _gains(out_current, in_current)
        net_package, exchequer_package = _gains(out_package, in_package)
        cases.append(
            {
                "id": case_id,
                "hours": hours,
                "hourly_wage": wage,
                "annual_earnings": earnings,
                "net_income_gain_current_law": net_current,
                "net_income_gain_package": net_package,
                "exchequer_gain_current_law": exchequer_current,
                "exchequer_gain_package": exchequer_package,
            }
        )
    return {
        "year": YEAR,
        "basis": (
            f"Household calculation for {FISCAL_YEAR} ({local_build.LABEL}), on "
            "the OBR October 2026 forecast. A single person aged "
            f"{AGE}, renting privately in the North West for "
            f"£{ANNUAL_RENT:,} a year, with limited capability for work and "
            "work-related activity, no PIP and no other income, on "
            "Universal Credit; moving from no work to 16 or 25 hours a week "
            f"at the National Living Wage for {FISCAL_YEAR}, all year. Gains are "
            "annual, in work minus out of work. The Exchequer gain is income "
            "tax plus employee and employer National Insurance plus the fall "
            "in benefits; employer National Insurance is counted. Package: "
            "milburn_report_package (health element removed for under-25s "
            "and PIP removed for 18 to 24-year-olds, from April 2029)."
        ),
        "entry_cases": cases,
        "notes": [
            "Out of work under current law the person receives the protected "
            "LCWRA element (a pre-2026 claimant); the package removes it, "
            "in work and out.",
            "The LCWRA status still gives the Universal Credit work "
            "allowance under the package, so earnings up to it reduce the "
            "award by nothing.",
            "The person has no PIP, so the package's PIP removal does not "
            "change these cases.",
            "The element is a fixed amount: while Universal Credit stays in "
            "payment after the move into work, removing it lowers income by "
            "the same amount in and out of work, so the gains from work are "
            "the same under the package as under current law.",
            "Wages, hours and housing costs are held fixed; no behavioural "
            "response is modelled.",
        ],
    }


def write(output: Path) -> Path:
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(milburn_scenarios(), indent=2) + "\n")
    return output
