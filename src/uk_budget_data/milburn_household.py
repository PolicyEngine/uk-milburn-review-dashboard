"""The Milburn review dashboard's household calculator (the Household
impact tab): which of the published runs it covers, its eight stored
examples, and how one household is run through a run.

The tab follows the one run chosen in the header, like the other tabs.
Each run is one request to the household API (``/api/household-impact``),
through ``household_impact.calculate_household_impact`` as the API runs it,
against current law for the same household, with the run's id as its
policies: a combined run runs as its members together
(``household_impact.PACKAGE_MEMBERS``), its parts each member on its own.
Runs are never added to each other.

A published run is covered unless ``NOT_COVERED`` gives the reason one
household cannot show it. The page reads the coverage and the stored
examples from the presets file
(scripts/precompute_milburn_household_presets.py); a custom household asks
the API's Milburn route for the chosen run (``/api/milburn-household``),
and the Milburn Modal app warms every covered run
(modal_household.milburn_warm_jobs).
"""

from uk_budget_data import household_impact as hi

YEAR = 2029
FISCAL_YEAR = hi.fiscal_year(YEAR)

# Who a run reaches by a random draw across the population: one
# household's result would be that draw, not the policy
_DRAW = (
    "Who is reassessed each year is a random draw across the population, "
    "so one household's result would be that draw, not the policy."
)
_SEVERE = (
    "It keeps the health element for claimants with 24 or more PIP daily "
    "living points, which the calculator does not ask for."
)
# The published runs one household cannot show, with the reason the page
# gives (every other published run is covered)
NOT_COVERED = {
    "milburn_report_package_phased": _DRAW,
    "milburn_package_phased": _DRAW,
    "milburn_package_entry_25pct": (
        "An illustrative move into work for a random quarter of affected "
        "young people: one household's result would be that draw, not the "
        "policy."
    ),
    "uc_health_element_removed_under_25_severe_kept": _SEVERE,
    "milburn_package_central": _SEVERE,
}

# What a covered run's household figure needs said beside it
NOTES = {
    "milburn_report_employer_nics_threshold_glide_path": (
        f"In {FISCAL_YEAR} the glide path's threshold is £8,000, its third "
        "step (the end state, £10,000, is reached in 2031-32)."
    ),
    "milburn_report_employer_nics_threshold": (
        "The threshold applies to 21 to 24-year-olds in retail and "
        "hospitality; the model passes the employer's saving to pay."
    ),
    "milburn_report_employer_nics_threshold_all_sectors": (
        "The threshold applies to 21 to 24-year-olds in every sector; the "
        "model passes the employer's saving to pay."
    ),
    "employer_nics_zero_under_25": (
        "The model passes the employer's saving to pay."
    ),
}

# The four runs the tab showed before it followed the header, by their old
# keys: a request that names no runs (a page built before) still gets them
LEGACY_RUNS = (
    {"key": "package", "policies": ["milburn_report_package"]},
    {
        "key": "youth_allowance",
        "policies": ["milburn_report_youth_allowance_independent"],
    },
    {
        "key": "work_allowance",
        "policies": ["milburn_report_youth_allowance_work_allowance"],
    },
    {
        "key": "employer_ni",
        "policies": ["milburn_report_employer_nics_threshold"],
    },
)


def published_run_ids() -> list[str]:
    """Every published run, in the registry's order: the runs
    ``milburn_measures.json`` lists as computable."""
    from uk_budget_data.reforms import get_milburn_reforms

    return [reform.id for reform in get_milburn_reforms()]


def covered_run_ids() -> list[str]:
    """The published runs the calculator covers."""
    return [id_ for id_ in published_run_ids() if id_ not in NOT_COVERED]


def coverage() -> list[dict]:
    """Each published run, covered or not, as the presets file lists it:
    its id, its published name and description, whether the calculator
    covers it, and the reason when not (or a note when it needs one)."""
    from uk_budget_data.reforms import get_reform

    runs = []
    for id_ in published_run_ids():
        reform = get_reform(id_)
        entry = {
            "id": id_,
            "name": reform.name,
            "description": reform.description,
        }
        if id_ in NOT_COVERED:
            entry.update(covered=False, reason=NOT_COVERED[id_])
        else:
            entry.update(covered=True, policies=[id_])
            if id_ in NOTES:
                entry["note"] = NOTES[id_]
        runs.append(entry)
    return runs


def run_entries(run_ids) -> tuple:
    """The runs to compute, by id (each run's id as its policies).

    Raises:
        ValueError: for an id that isn't a published run, or one the
            calculator does not cover (with the reason).
    """
    published = set(published_run_ids())
    entries = []
    for id_ in dict.fromkeys(run_ids):
        if id_ not in published:
            raise ValueError(f"Not a published run: {id_}")
        if id_ in NOT_COVERED:
            raise ValueError(
                f"The household calculator does not cover {id_}: "
                f"{NOT_COVERED[id_]}"
            )
        entries.append({"key": id_, "policies": [id_]})
    return tuple(entries)


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
        "title": "21, part-time in retail",
        "description": (
            "Renting alone; 15 hours a week at the minimum wage in retail "
            "(the report's example, para 270); on Universal Credit. In "
            "2029-30 that pays about £10,800 (£13.85 an hour), above the "
            "£10,000 threshold, so employer NI is reduced, not removed."
        ),
        "icon": "briefcase",
        "household": {
            **BASE,
            **RENTING_ALONE,
            "age": 21,
            "hours_worked_per_week": 15,
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
    "Each run is compared with current law for the same household, one "
    "run at a time: runs are never added to each other.",
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


def run_requests(household: dict, runs=LEGACY_RUNS) -> list:
    """Each run's request, as ``/api/household-impact`` validates it: the
    run's key and the validated request."""
    from uk_budget_data.api import HouseholdImpactRequest

    return [
        (
            run["key"],
            HouseholdImpactRequest.model_validate(
                {
                    "year": YEAR,
                    "policies": run["policies"],
                    "household": household,
                    "include": ["by_policy"],
                }
            ),
        )
        for run in runs
    ]


def run_household(household: dict, runs=LEGACY_RUNS, workers: int = 1) -> dict:
    """Each run's answer for one household (the API's household answers),
    by run key: validated and computed as ``/api/household-impact`` does,
    with the split by measure and no earnings sweep.

    The runs' simulations are run first, all together (one ``_run_all``),
    so the current-law side they share is run once and, on Modal, the
    batches go out at once (``modal_household.fan_out``); each run's own
    calculation then reads them back from ``household_impact._RUNS``, so
    every answer is exactly the one its own request gets.
    """
    requests = run_requests(household, runs)
    jobs: list = []
    seen: set = set()
    for _, request in requests:
        for job in hi.household_plan(
            request.household.answers(),
            request.policies,
            request.year,
            tuple(request.include),
        )["jobs"]:
            key = hi._run_key(job)
            if key not in seen:
                seen.add(key)
                jobs.append(job)
    hi._run_all(jobs, workers)
    results = {}
    for key, request in requests:
        result = hi.calculate_household_impact(
            request.household.answers(),
            request.policies,
            request.year,
            include=tuple(request.include),
            workers=workers,
        )
        if isinstance(result.get("by_policy"), dict):
            result["by_policy"]["method"] = BY_POLICY_METHOD
        results[key] = result
    return results
