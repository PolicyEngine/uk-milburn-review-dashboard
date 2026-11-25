"""No Personal Independence Payment for people aged 18 to 24
(``pip_removed_under_25``). Hand-written.

One modifier in a module of its own: see the package docstring.
"""

import numpy as np

from uk_budget_data.budget_measures import milburn_design as design
from uk_budget_data.measure_templates import _call_formula, _replace_formula


def pip_removed_ages_18_to_24(
    sim,
    start_year=design.START_YEAR,
    lowest_age=design.PIP_LOWER_AGE,
    age_limit=design.PIP_UPPER_AGE,
    include_scotland=design.PIP_INCLUDE_SCOTLAND,
    share_kept=design.PIP_REPLACEMENT_SHARE,
    shares_kept=None,
):
    """Pay no PIP daily living or mobility component to people aged
    ``lowest_age`` to ``age_limit`` - 1 from ``start_year`` (fiscal years).

    Hand-written: no template withdraws a benefit by age. It wraps
    ``pip_dl`` and ``pip_m``, which the engine computes from each person's
    category (in policyengine-uk 2.179.2 derived from the stored
    ``pip_dl_points`` and ``pip_m_points``); ``pip`` adds the two, so it
    follows. The certified build stores no ``pip`` amounts, so Scottish
    records (Adult Disability Payment, which the survey and the engine
    hold as PIP) are reached too; ``include_scotland=False`` leaves them
    alone, as a UK PIP change would not itself change the devolved
    payment.

    16 and 17-year-olds on PIP keep it (the measure covers 18 to 24), and
    DLA for children is untouched. The engine's passports read the PIP
    amounts (disability premia, the Universal Credit disabled child
    additions, the education exception, the shared accommodation rate
    exception, the benefit cap exceptions, non-dependant deduction
    exemptions), so they go with the payment; the PIP categories and points
    do not change. Carer's Allowance and the Universal Credit carer element
    do not follow: in policyengine-uk 2.179.2 a carer qualifies through
    ``cares_for_severely_disabled_person``, an input that defaults to true
    and is not linked to the PIP of the person cared for, so this removal
    changes no carer's award (in reality a carer whose entitlement rests on
    the person's PIP daily living award could lose it).

    ``share_kept`` pays that share of both components. ``shares_kept``,
    when given, replaces it with a share for each component at each award
    level (keys ``daily_living_enhanced``, ``daily_living_standard``,
    ``mobility_enhanced``, ``mobility_standard``), chosen by the person's
    ``pip_dl_category`` or ``pip_m_category``. Either way it is the amounts
    that are scaled, so the passports above stay with a component paid at
    any share above 0 and go with one paid at 0.
    """
    components = {"pip_dl": "daily_living", "pip_m": "mobility"}
    for name in ("pip_dl", "pip_m"):
        native = sim.tax_benefit_system.get_variable(name)

        def formula(person, period, parameters, native=native, name=name):
            current = _call_formula(native, person, period, parameters)
            if period.start.year < start_year:
                return current
            age = person("age", period)
            removed = (age >= lowest_age) & (age < age_limit)
            if not include_scotland:
                country = person.household("country", period)
                removed = removed & (
                    country != country.possible_values.SCOTLAND
                )
            if shares_kept is None:
                return np.where(removed, current * share_kept, current)
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

        _replace_formula(sim, name, formula)
    return sim


def pip_halved_ages_18_to_24(sim):
    """PIP for 18 to 24-year-olds paid at half its current amount: an
    illustrative stand-in for a smaller, non-means-tested additional cost
    allowance whose rules are not yet known."""
    return pip_removed_ages_18_to_24(sim, share_kept=design.PIP_HALVED_SHARE)


def pip_removed_ages_16_to_24(sim):
    """PIP removal from age 16 (\"under 25\" read literally)."""
    return pip_removed_ages_18_to_24(sim, lowest_age=16)


def pip_removed_ages_18_to_24_excluding_scotland(sim):
    """PIP removal for 18 to 24-year-olds with Scottish records (Adult
    Disability Payment, held as PIP) left alone."""
    return pip_removed_ages_18_to_24(sim, include_scotland=False)


def pip_removed_ages_16_to_24_excluding_scotland(sim):
    """PIP removal from age 16 with Scottish records left alone."""
    return pip_removed_ages_18_to_24(
        sim, lowest_age=16, include_scotland=False
    )
