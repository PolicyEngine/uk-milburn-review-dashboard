"""Milburn package variants: natural-migration phasing and an illustrative
employment response. Hand-written.

Phasing follows ministers' briefing (15 Nov 2026) that existing claimants
move to the new system when they are reassessed, not all at once. A person
is reached in fiscal year Y if they reached 18 after April 2026 (a new
entrant to adult benefits) or if a seeded per-person draw falls below
1 - (1 - r)^(Y - 2026), with r = 25% of the remaining stock reassessed each
year: about 36%, 60%, 76%, 86% and 93% reached in 2027-28 to 2031-32.
A draw (not a scaled amount) keeps distributional and poverty results
right: each person either keeps or loses the whole award.

The employment response moves a seeded share of affected young people who
do not work (aged 18 to 24, with PIP or limited capability for work and
work-related activity, no earnings) into 16 hours a week at their minimum
wage, in the reform only. It is a scenario, not a behavioural estimate.
"""

import numpy as np
from policyengine_core.periods import period as as_period

from uk_budget_data.measure_templates import _call_formula, _replace_formula
from policyengine_uk.utils.supplied_inputs import set_model_value
from policyengine_uk.utils.uc_work_related_requirements import (
    other_member_of_single_claim,
)

START = 2026
REASSESSED_EACH_YEAR = 0.25
SEED = 20261117


def _draws(n: int, salt: int) -> np.ndarray:
    return np.random.default_rng(SEED + salt).random(n)


def reached(person, period) -> np.ndarray:
    """Whether the new rules reach each person in ``period``."""
    years = period.start.year - START
    age = person("age", period)
    new_entrant = (age - 18) < years
    reassessed = _draws(person.count, 0) < 1 - (1 - REASSESSED_EACH_YEAR) ** years
    return new_entrant | reassessed


def lcwra_removed_under_25_phased(sim, start_year=2027, end_year=2032):
    """The health element removal for under-25s, reaching claimants as
    above; an unreached young claimant with LCWRA keeps the element."""
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
        keeps = lcwra & ((age >= 25) | ~reached(person, period))
        set_model_value(
            sim,
            "uc_LCWRA_element",
            year,
            np.where(benunit.any(keeps), element, 0.0),
        )
    return sim


def pip_removed_18_to_24_phased(sim, start_year=2027):
    """PIP removal for 18 to 24-year-olds, reaching recipients as above."""
    for name in ("pip_dl", "pip_m"):
        native = sim.tax_benefit_system.get_variable(name)

        def formula(person, period, parameters, native=native):
            current = _call_formula(native, person, period, parameters)
            if period.start.year < start_year:
                return current
            age = person("age", period)
            removed = (age >= 18) & (age < 25) & reached(person, period)
            return np.where(removed, 0.0, current)

        _replace_formula(sim, name, formula)
    return sim


def milburn_package_phased(sim):
    sim = lcwra_removed_under_25_phased(sim)
    return pip_removed_18_to_24_phased(sim)


def _employment_response(sim, share, start_year=2027, end_year=2031, hours=16):
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
            (age >= 18)
            & (age < 25)
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

    sim = _employment_response(sim, 0.25)
    sim = uc_health_element_removed_under_25(sim)
    return pip_removed_ages_18_to_24(sim)
