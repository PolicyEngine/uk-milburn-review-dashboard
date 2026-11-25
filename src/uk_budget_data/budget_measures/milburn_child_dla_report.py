"""The final report's child Disability Living Allowance to 18 (17 November
2026). Hand-written.

What the report proposes ("From a Welfare State to a Working State", para
760): 16 and 17-year-olds stay on child Disability Living Allowance (DLA)
instead of moving to Personal Independence Payment (PIP) at 16.

How it is modelled. From the start year, a 16 or 17-year-old's PIP is
replaced by DLA at the equivalent award level:

* PIP daily living, standard -> DLA care, middle rate;
* PIP daily living, enhanced -> DLA care, highest rate;
* PIP mobility, standard -> DLA mobility, lower rate;
* PIP mobility, enhanced -> DLA mobility, higher rate.

These are the pairs with the same weekly amounts (2026-27: £76.70 and
£114.60 for daily living and care, £30.30 and £80.00 for mobility), and
policyengine-uk 2.179.2 uprates both benefits by the same index, so the
amounts stay equal in every year: the swap changes the name of the
payment, not its size. The DLA care lowest rate has no PIP counterpart
and is not used. The engine can pay DLA at 16 and 17: ``dla_sc`` and
``dla_m`` have no upper age (the mobility minimum ages, 3 and 5, are far
below), and the certified build already holds 16 and 17-year-olds on DLA.

What the model cannot show is the proposal's real effect: at 16 a DLA
award is reassessed under the PIP rules, and some awards end, fall or
rise. The data hold each 16 and 17-year-old's PIP award as it is after
that assessment and no record of the DLA award before it, so the people
who would have kept (or lost) an award without the move cannot be
identified. The measure therefore shows the swap at equal award levels,
and its budgetary effect is nil apart from the passports below.

Passports. The engine's rules read the DLA and PIP amounts, and treat the
paired levels alike (benefit cap exceptions, non-dependant deduction
exemptions, the Universal Credit disabled child additions, the Housing
Benefit child premiums, the education exception). Two flags read the
stored DLA care category instead of the amount, ``dla_sc_middle_plus``
and ``receives_highest_dla_sc``; they are wrapped so a switched award
counts. One engine rule reads DLA only: ``is_enhanced_disabled_for_benefits``
counts the DLA care highest rate but not enhanced PIP daily living. The
certified build stores that flag, so the switch cannot move it in a
national run; where it is computed (a single household), a switched young
person would gain it through the engine's gap, not through the proposal,
so it is held at its value before the switch.

Scotland: Child Disability Payment (held as DLA) is already paid to 18
there, and Adult Disability Payment (held as PIP) is devolved, so Scottish
records are left as they are unless ``include_scotland=True``.

Year Y is fiscal year Y-(Y+1).
"""

import numpy as np
from policyengine_uk.model_api import WEEKS_IN_YEAR

from uk_budget_data.budget_measures import milburn_design as design
from uk_budget_data.measure_templates import (
    _call_formula,
    _replace_formula,
    _stored_input_periods,
)

# The annex's welfare figures start in 2029-30 (the wrapper below reads
# design.REPORT_START_YEAR; this is the report's own year, for a caller
# who passes it).
REPORT_FIRST_WELFARE_YEAR = 2029
# PIP starts at 16 (Welfare Reform Act 2012 s. 83; SI 2013/377 reg. 27);
# the report keeps child DLA until 18.
PIP_MINIMUM_AGE = 16
CHILD_DLA_AGE_LIMIT = 18


def _switched(
    person, period, start_year, lowest_age, age_limit, include_scotland
):
    """People whose PIP is replaced by DLA in ``period``."""
    if period.start.year < start_year:
        return np.zeros(person.count, dtype=bool)
    age = person("age", period)
    switched = (age >= lowest_age) & (age < age_limit)
    if not include_scotland:
        country = person.household("country", period)
        switched = switched & (country != country.possible_values.SCOTLAND)
    return switched


def child_dla_report(
    sim,
    start_year=REPORT_FIRST_WELFARE_YEAR,
    lowest_age=PIP_MINIMUM_AGE,
    age_limit=CHILD_DLA_AGE_LIMIT,
    include_scotland=False,
):
    """From ``start_year``, people aged ``lowest_age`` to ``age_limit`` - 1
    are paid DLA care and mobility at the level equivalent to their PIP
    daily living and mobility awards, and no PIP (module docstring).

    A person who already has a DLA component keeps it if it is higher than
    the mapped one (the certified build has no 16 or 17-year-old on both).
    ``pip`` and ``dla`` add their components, so they follow; the PIP
    categories and points do not change.
    """
    if not (
        type(lowest_age) is int
        and type(age_limit) is int
        and PIP_MINIMUM_AGE <= lowest_age < age_limit
    ):
        raise ValueError(
            f"ages must be whole, from {PIP_MINIMUM_AGE}, lowest below the limit"
        )
    scope = (start_year, lowest_age, age_limit, include_scotland)
    system = sim.tax_benefit_system

    # PIP: not paid to the switched.
    for name in ("pip_dl", "pip_m"):
        native = system.get_variable(name)

        def pip_formula(person, period, parameters, native=native):
            current = _call_formula(native, person, period, parameters)
            return np.where(_switched(person, period, *scope), 0, current)

        _replace_formula(sim, name, pip_formula)

    # DLA: paid at the level equivalent to the PIP award.
    native_care = system.get_variable("dla_sc")
    native_mobility = system.get_variable("dla_m")

    def care(person, period, parameters):
        current = _call_formula(native_care, person, period, parameters)
        rates = parameters(period).gov.dwp.dla.self_care
        award = person("pip_dl_category", period)
        levels = award.possible_values
        mapped = WEEKS_IN_YEAR * np.select(
            [award == levels.ENHANCED, award == levels.STANDARD],
            [rates.higher, rates.middle],
            default=0,
        )
        return np.where(
            _switched(person, period, *scope),
            np.maximum(current, mapped),
            current,
        )

    def mobility(person, period, parameters):
        current = _call_formula(native_mobility, person, period, parameters)
        rates = parameters(period).gov.dwp.dla.mobility
        award = person("pip_m_category", period)
        levels = award.possible_values
        mapped = WEEKS_IN_YEAR * np.select(
            [award == levels.ENHANCED, award == levels.STANDARD],
            [rates.higher, rates.lower],
            default=0,
        )
        return np.where(
            _switched(person, period, *scope),
            np.maximum(current, mapped),
            current,
        )

    # The two flags that read the stored DLA care category.
    native_middle_plus = system.get_variable("dla_sc_middle_plus")
    native_highest = system.get_variable("receives_highest_dla_sc")

    def middle_plus(person, period, parameters):
        current = _call_formula(native_middle_plus, person, period, parameters)
        award = person("pip_dl_category", period)
        return current | (
            _switched(person, period, *scope)
            & (award != award.possible_values.NONE)
        )

    def highest(person, period, parameters):
        current = _call_formula(native_highest, person, period, parameters)
        award = person("pip_dl_category", period)
        return current | (
            _switched(person, period, *scope)
            & (award == award.possible_values.ENHANCED)
        )

    # The engine counts DLA care at the highest rate here but not enhanced
    # PIP daily living; a switched award must not gain the flag through
    # that gap, so it counts only a DLA award the person already had.
    def enhanced_disabled(person, period, parameters):
        threshold = (
            parameters(period).gov.dwp.dla.self_care.higher * WEEKS_IN_YEAR
        )
        already = (
            _call_formula(native_care, person, period, parameters) >= threshold
        )
        return np.where(
            _switched(person, period, *scope),
            already,
            person("dla_sc", period) >= threshold,
        )

    _replace_formula(sim, "dla_sc", care)
    _replace_formula(sim, "dla_m", mobility)
    _replace_formula(sim, "dla_sc_middle_plus", middle_plus)
    _replace_formula(sim, "receives_highest_dla_sc", highest)
    # Stored in the certified build (then the stored value stands).
    if not _stored_input_periods(sim, "is_enhanced_disabled_for_benefits"):
        _replace_formula(
            sim, "is_enhanced_disabled_for_benefits", enhanced_disabled
        )
    return sim


def milburn_child_dla_report(sim):
    """Child DLA to 18 from ``design.REPORT_START_YEAR`` (read when called,
    as the other ``milburn_report_*`` measures do)."""
    design.check_report_design()
    return child_dla_report(sim, start_year=design.REPORT_START_YEAR)
