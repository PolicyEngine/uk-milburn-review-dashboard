"""No Personal Independence Payment for people aged 18 to 24
(``pip_removed_under_25``). Hand-written.

One modifier in a module of its own: see the package docstring.
"""

import numpy as np

from uk_budget_data.measure_templates import _call_formula, _replace_formula


def pip_removed_ages_18_to_24(
    sim,
    start_year=2027,
    lowest_age=18,
    age_limit=25,
    include_scotland=True,
    share_kept=0.0,
):
    """Pay no PIP daily living or mobility component to people aged
    ``lowest_age`` to ``age_limit`` - 1 from ``start_year`` (fiscal years).

    Hand-written: no template withdraws a benefit by age. It wraps
    ``pip_dl`` and ``pip_m``, which the engine computes from each person's
    category (in policyengine-uk 2.177.7 derived from the stored
    ``pip_dl_points`` and ``pip_m_points``); ``pip`` adds the two, so it
    follows. The certified build stores no ``pip`` amounts, so Scottish
    records (Adult Disability Payment, which the survey and the engine
    hold as PIP) are reached too; ``include_scotland=False`` leaves them
    alone, as a UK PIP change would not itself change the devolved
    payment.

    16 and 17-year-olds on PIP keep it (the measure covers 18 to 24), and
    DLA for children is untouched. The engine's passports read the PIP
    amounts (carer's benefits, disability premia, the benefit cap
    exceptions, non-dependant deduction exemptions), so they go with the
    payment; the PIP categories and points do not change.
    """
    for name in ("pip_dl", "pip_m"):
        native = sim.tax_benefit_system.get_variable(name)

        def formula(person, period, parameters, native=native):
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
            return np.where(removed, current * share_kept, current)

        _replace_formula(sim, name, formula)
    return sim


def pip_halved_ages_18_to_24(sim):
    """PIP for 18 to 24-year-olds paid at half its current amount: an
    illustrative stand-in for a smaller, non-means-tested additional cost
    allowance whose rules are not yet known."""
    return pip_removed_ages_18_to_24(sim, share_kept=0.5)
