"""Milburn package variants: natural-migration phasing and an illustrative
employment response. Hand-written.

Phasing follows ministers' briefing (15 Nov 2026) that existing claimants
move to the new system when they are reassessed, not all at once. A person
is reached in fiscal year Y if they reached 18 after April 2026 (a new
entrant to adult benefits) or if a seeded per-person draw falls below
1 - (1 - r)^(Y - 2026), with r = 25% of the remaining stock reassessed each
year. The share reached in a year is read from the run, not from the rule
(the 2027-28 run saves about 45% of full abolition).
A draw (not a scaled amount) keeps distributional and poverty results
right: each person either keeps or loses the whole award.

The employment response moves a seeded share of affected young people who
do not work (aged 18 to 24, with PIP or limited capability for work and
work-related activity, no earnings) into 16 hours a week at their minimum
wage, in the reform only. It is a scenario, not a behavioural estimate.
"""

import numpy as np
from policyengine_core.periods import period as as_period
from policyengine_uk.utils.supplied_inputs import set_model_value
from policyengine_uk.utils.uc_work_related_requirements import (
    other_member_of_single_claim,
)

from uk_budget_data.budget_measures import milburn_design as design
from uk_budget_data.measure_templates import _call_formula, _replace_formula

# The 15 November designs (milburn_design, first group). Every function
# below takes them as arguments; the report's versions pass the REPORT_*
# constants (budget_measures/milburn_report.py).
START = design.COHORT_START_YEAR
REASSESSED_EACH_YEAR = design.REASSESSED_EACH_YEAR
SEED = 20261117


def _draws(n: int, salt: int) -> np.ndarray:
    return np.random.default_rng(SEED + salt).random(n)


def reached(
    person,
    period,
    rate=REASSESSED_EACH_YEAR,
    cohort_start=START,
    entrant_age=design.NEW_ENTRANT_AGE,
) -> np.ndarray:
    """Whether the new rules reach each person in ``period``: a new
    entrant (reached ``entrant_age`` after April of ``cohort_start``), or
    drawn at ``rate`` of the remaining stock a year since then."""
    years = period.start.year - cohort_start
    age = person("age", period)
    new_entrant = (age - entrant_age) < years
    reassessed = _draws(person.count, 0) < 1 - (1 - rate) ** years
    return new_entrant | reassessed


def lcwra_removed_under_25_phased(
    sim,
    start_year=design.START_YEAR,
    end_year=design.UC_ELEMENT_LAST_YEAR,
    age_limit=design.UC_HEALTH_UPPER_AGE,
    lowest_age=design.UC_HEALTH_LOWER_AGE,
    rate=REASSESSED_EACH_YEAR,
    cohort_start=START,
    entrant_age=design.NEW_ENTRANT_AGE,
):
    """The health element removal for under-25s, reaching claimants as
    above; an unreached young claimant with LCWRA keeps the element (as
    does one under ``lowest_age``, 0 by default: nobody)."""
    person = sim.populations["person"]
    benunit = sim.populations["benunit"]
    for year in range(start_year, end_year + 1):
        period = as_period(year)
        element = np.array(sim.calculate("uc_LCWRA_element", year))
        claimant = person("is_uc_assessed_claimant", period) & ~(
            other_member_of_single_claim(person, period)
        )
        lcwra = claimant & person("uc_limited_capability_for_WRA", period)
        age = person("age", period)
        keeps = lcwra & (
            (age >= age_limit)
            | ~reached(person, period, rate, cohort_start, entrant_age)
        )
        if lowest_age > 0:
            keeps = keeps | (lcwra & (age < lowest_age))
        set_model_value(
            sim,
            "uc_LCWRA_element",
            year,
            np.where(benunit.any(keeps), element, 0.0),
        )
    return sim


def pip_removed_18_to_24_phased(
    sim,
    start_year=design.START_YEAR,
    lowest_age=design.PIP_LOWER_AGE,
    age_limit=design.PIP_UPPER_AGE,
    include_scotland=design.PIP_INCLUDE_SCOTLAND,
    share_kept=design.PIP_REPLACEMENT_SHARE,
    rate=REASSESSED_EACH_YEAR,
    cohort_start=START,
    entrant_age=design.NEW_ENTRANT_AGE,
    shares_kept=None,
):
    """PIP removal for 18 to 24-year-olds, reaching recipients as above.
    ``shares_kept`` is the tiered share of ``pip_removed_ages_18_to_24``
    (by component and award level), in place of ``share_kept``."""
    components = {"pip_dl": "daily_living", "pip_m": "mobility"}
    for name in ("pip_dl", "pip_m"):
        native = sim.tax_benefit_system.get_variable(name)

        def formula(person, period, parameters, native=native, name=name):
            current = _call_formula(native, person, period, parameters)
            if period.start.year < start_year:
                return current
            age = person("age", period)
            removed = (
                (age >= lowest_age)
                & (age < age_limit)
                & reached(person, period, rate, cohort_start, entrant_age)
            )
            if not include_scotland:
                country = person.household("country", period)
                removed = removed & (
                    country != country.possible_values.SCOTLAND
                )
            if shares_kept is not None:
                category = person(f"{name}_category", period)
                levels = category.possible_values
                component = components[name]
                share = np.select(
                    [category == levels.ENHANCED, category == levels.STANDARD],
                    [
                        shares_kept[f"{component}_enhanced"],
                        shares_kept[f"{component}_standard"],
                    ],
                    default=1.0,
                )
                return np.where(removed, current * share, current)
            if share_kept == 0:
                return np.where(removed, 0.0, current)
            return np.where(removed, current * share_kept, current)

        _replace_formula(sim, name, formula)
    return sim


def milburn_package_phased(sim):
    sim = lcwra_removed_under_25_phased(sim)
    return pip_removed_18_to_24_phased(sim)


def _employment_response(
    sim,
    share,
    start_year=design.START_YEAR,
    end_year=design.LAST_POLICY_YEAR,
    hours=design.ENTRY_HOURS,
    lowest_age=design.PIP_LOWER_AGE,
    age_limit=design.PIP_UPPER_AGE,
):
    person = sim.populations["person"]
    for year in range(start_year, end_year + 1):
        period = as_period(year)
        age = person("age", period)
        earnings = np.array(sim.calculate("employment_income", year))
        pip_category = person("pip_dl_category", period)
        pip_m_category = person("pip_m_category", period)

        def has(cat):
            if hasattr(cat, "possible_values"):
                return cat != cat.possible_values.NONE
            return np.asarray(cat).astype(str) != "NONE"

        affected = (
            (age >= lowest_age)
            & (age < age_limit)
            & (earnings <= 0)
            & (
                has(pip_category)
                | has(pip_m_category)
                | person("uc_limited_capability_for_WRA", period)
            )
        )
        moves = affected & (_draws(person.count, 1) < share)
        wage = np.array(sim.calculate("minimum_wage", year))
        new = np.where(moves, hours * 52 * wage, earnings)
        sim.set_input("employment_income", year, new)
    return sim


def milburn_package_with_entry_25pct(sim):
    """The full package, with a quarter of affected non-working young
    people moving into 16 hours a week at their minimum wage."""
    from uk_budget_data.budget_measures.pip_removed_ages_18_to_24 import (
        pip_removed_ages_18_to_24,
    )
    from uk_budget_data.budget_measures.uc_health_element_removed_under_25 import (
        uc_health_element_removed_under_25,
    )

    sim = _employment_response(sim, design.ENTRY_SHARE)
    sim = uc_health_element_removed_under_25(sim)
    return pip_removed_ages_18_to_24(sim)
