"""The Milburn review dashboard's household calculator (the Household
impact tab): its four report runs, its eight stored examples, and how one
household is run through them.

Each run is one request to the household API (``/api/household-impact``),
through ``household_impact.calculate_household_impact`` as the API runs it,
against current law for the same household:

- ``package``: the health element and PIP removals run together (our
  design of the report's changes, with no replacement awards) (their own changes are its split by measure);
- ``youth_allowance``, ``work_allowance`` and ``employer_ni``: separate
  runs, never added to the package's figure or to each other.

The page sends the same groups (src/utils/milburn/householdCalculator.js),
the stored examples are precomputed from here
(scripts/precompute_milburn_household_presets.py), and the Milburn Modal app
warms them (modal_household.milburn_warm_jobs).
"""

from uk_budget_data import household_impact as hi

YEAR = 2029
FISCAL_YEAR = hi.fiscal_year(YEAR)

# (key, policies, name, kind): ``package`` is both removals together; the
# others are separate runs. The illustrative work allowance's amount is our
# assumption (the report gives none).
RUNS = (
    {
        "key": "package",
        "policies": ["milburn_report_uc_health", "milburn_report_pip"],
        "name": "Health element and PIP removal (no replacement awards)",
        "kind": "package",
        "description": (
            "The Universal Credit health element and PIP removed for "
            "under-25s, run together. Its two parts are each removal on "
            "its own."
        ),
    },
    {
        "key": "youth_allowance",
        "policies": ["milburn_report_youth_allowance_independent"],
        "name": "Higher Youth Allowance",
        "kind": "separate",
        "description": (
            "A separate run: under-25 claims with a housing costs element "
            "(the review's proxy for living independently) get the "
            "standard allowance for those aged 25 and over."
        ),
    },
    {
        "key": "work_allowance",
        "policies": ["milburn_report_youth_allowance_work_allowance"],
        "name": "Work allowance (illustrative)",
        "kind": "illustrative",
        "description": (
            "A separate, illustrative run: the report proposes a work "
            "allowance for young people in work but gives no amount; the "
            "amount here is our assumption, the current Universal Credit "
            "work allowance."
        ),
    },
    {
        "key": "employer_ni",
        "policies": ["milburn_report_employer_nics_threshold"],
        "name": "Employer NI threshold",
        "kind": "separate",
        "description": (
            "A separate run: employers pay National Insurance from £10,000 "
            "a year, not £5,000, for 21 to 24-year-olds in retail and "
            "hospitality. The model passes the saving to pay."
        ),
    },
)

# Every stored example's answers start from these: 2029-30 pay, in the
# North West, claiming Universal Credit, with no Council Tax (left out, as
# the earlier household examples left it out).
BASE = {
    "age": 22,
    "employment_income": 0,
    "salary_year": YEAR,
    "region": "NORTH_WEST",
    "claims_universal_credit": True,
    "council_tax": 0,
}
RENTING_ALONE = {"tenure": "RENT_PRIVATELY", "monthly_rent": 500}

# The eight stored examples, as the API's household answers.
EXAMPLES = (
    {
        "id": "with_parents_health",
        "title": "20, living with parents",
        "description": (
            "Health condition (new claim) and standard-rate PIP daily "
            "living; no earnings."
        ),
        "icon": "house",
        "household": {
            **BASE,
            "age": 20,
            "lives_with_parents": True,
            "limited_capability_for_work_related_activity": True,
            "new_claimant_health_element": True,
            "pip_daily_living": "STANDARD",
        },
    },
    {
        "id": "renting_health",
        "title": "22, renting alone",
        "description": (
            "Health condition (protected claim) and enhanced-rate PIP daily "
            "living; no earnings."
        ),
        "icon": "key",
        "household": {
            **BASE,
            **RENTING_ALONE,
            "age": 22,
            "limited_capability_for_work_related_activity": True,
            "pip_daily_living": "ENHANCED",
        },
    },
    {
        "id": "renting_health_25",
        "title": "25, renting alone",
        "description": (
            "As the 22-year-old, but aged 25: above the report's age limit."
        ),
        "icon": "armchair",
        "household": {
            **BASE,
            **RENTING_ALONE,
            "age": 25,
            "limited_capability_for_work_related_activity": True,
            "pip_daily_living": "ENHANCED",
        },
    },
    {
        "id": "college_17",
        "title": "17, at college",
        "description": (
            "Lives with parents; standard-rate PIP daily living; no "
            "earnings or Universal Credit."
        ),
        "icon": "graduate",
        "household": {
            **BASE,
            "age": 17,
            "lives_with_parents": True,
            "claims_universal_credit": False,
            "pip_daily_living": "STANDARD",
        },
    },
    {
        "id": "couple_partner_health",
        "title": "23, with a partner aged 27",
        "description": (
            "Renting; the partner has a health condition; no earnings."
        ),
        "icon": "family",
        "household": {
            **BASE,
            **RENTING_ALONE,
            "age": 23,
            "has_partner": True,
            "partner_age": 27,
            "partner_employment_income": 0,
            "partner_limited_capability_for_work_related_activity": True,
        },
    },
    {
        "id": "retail_part_time",
        "title": "23, part-time in retail",
        "description": (
            "Renting alone; 16 hours a week at the minimum wage; on "
            "Universal Credit."
        ),
        "icon": "briefcase",
        "household": {
            **BASE,
            **RENTING_ALONE,
            "age": 23,
            "hours_worked_per_week": 16,
            "earnings_at_minimum_wage": True,
            "employment_sector": "RETAIL",
        },
    },
    {
        "id": "hospitality_health",
        "title": "24, in hospitality with PIP",
        "description": (
            "Renting alone; 20 hours a week at the minimum wage; health "
            "condition and standard-rate PIP daily living."
        ),
        "icon": "hardHat",
        "household": {
            **BASE,
            **RENTING_ALONE,
            "age": 24,
            "hours_worked_per_week": 20,
            "earnings_at_minimum_wage": True,
            "employment_sector": "HOSPITALITY",
            "limited_capability_for_work_related_activity": True,
            "pip_daily_living": "STANDARD",
        },
    },
    {
        "id": "lone_parent",
        "title": "19, lone parent",
        "description": "One child aged 1; renting; on Universal Credit; no earnings.",
        "icon": "baby",
        "household": {
            **BASE,
            **RENTING_ALONE,
            "age": 19,
            "children": [{"age": 1}],
        },
    },
)

ASSUMPTIONS = (
    "Renters pay £500 a month to a private landlord; the stored examples "
    "are in the North West.",
    "A young person living with their parents is modelled as their own "
    "household with no rent: the parents' income and housing costs are not "
    "part of the calculation.",
    "Council Tax and Council Tax Reduction are left out.",
    "Benefit rates, the minimum wage and tax thresholds are the engine's "
    f"for {FISCAL_YEAR}, on the OBR forecast; every award is claimed in "
    "full, all year.",
    "The report's replacement payments (such as its additional cost "
    "allowance) are not modelled, so nothing is paid in place of the health "
    "element or PIP.",
    "Each run is compared with current law for the same household. The "
    "Youth Allowance, work allowance and employer National Insurance runs "
    "are separate: they are not added to the package or to each other.",
    "Losing PIP daily living moves a single renter under 35 onto the "
    "shared accommodation rate of Local Housing Allowance, so the PIP part "
    "of a renter's change can include a fall in the Universal Credit "
    "housing element as well as the PIP itself.",
    "A young person living with their parents holds no TV licence: the "
    "parents' household holds it.",
    "Hours, wages (other than the employer National Insurance saving, "
    "which the model passes to pay) and housing costs are held fixed; no "
    "behavioural response is modelled.",
)


# The split by measure, said for these runs: against current law, not the
# Autumn Budget's "Budget setting" and "pre-Budget law".
BY_POLICY_METHOD = (
    "Each part's change is that measure on its own, with the run's other "
    "measures held at current law, against the same current-law household. "
    "The run's change switches them all at once. The residual is the run's "
    "change minus the sum of the parts: what the measures do together "
    "beyond what each does alone."
)


def run_household(household: dict, runs=RUNS) -> dict:
    """Each run's answer for one household (the API's household answers),
    by run key: validated and computed as ``/api/household-impact`` does,
    with the split by measure and no earnings sweep."""
    from uk_budget_data.api import HouseholdImpactRequest

    results = {}
    for run in runs:
        request = HouseholdImpactRequest.model_validate(
            {
                "year": YEAR,
                "policies": run["policies"],
                "household": household,
                "include": ["by_policy"],
            }
        )
        result = hi.calculate_household_impact(
            request.household.answers(),
            request.policies,
            request.year,
            include=tuple(request.include),
        )
        if isinstance(result.get("by_policy"), dict):
            result["by_policy"]["method"] = BY_POLICY_METHOD
        results[run["key"]] = result
    return results
