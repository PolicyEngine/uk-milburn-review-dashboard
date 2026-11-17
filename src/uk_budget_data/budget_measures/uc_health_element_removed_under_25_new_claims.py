"""No Universal Credit health (LCWRA) element for new claims (the
post-April 2026 new-claimant rate) where the claimant with limited
capability for work and work-related activity is under 25
(``uc_health_element_removed_under_25_new_claims``). Hand-written.

One modifier in a module of its own: see the package docstring.
"""

import numpy as np
from policyengine_core.periods import period as as_period
from policyengine_uk.utils.supplied_inputs import set_model_value
from policyengine_uk.utils.uc_work_related_requirements import (
    other_member_of_single_claim,
)

from uk_budget_data.budget_measures import milburn_design as design


def uc_health_element_removed_under_25_new_claims(
    sim,
    start_year=design.START_YEAR,
    end_year=design.UC_ELEMENT_LAST_YEAR,
    age_limit=design.UC_HEALTH_UPPER_AGE,
):
    """As ``uc_health_element_removed_under_25``, but only for awards paid
    the new-claimant LCWRA rate (``uc_receives_new_claimant_health_element``
    true): protected pre-2026, severe conditions and terminally ill
    claimants keep the element whatever their age.

    The engine has no claim date. On survey data the new-claimant flag is a
    seeded draw at the expected new-claimant share of LCWRA awards each
    year (rebalancing.new_claimant_share), blind to age, so the young
    claimants it reaches are a random share of all young LCWRA claimants,
    not those who actually claimed after April 2026. A household situation
    sets the flag itself (false by default: protected).

    Like the all-claimant measure it rewrites the stored element, which the
    engine's rebalancing step stores as an input, so a formula wrapper
    would move nothing.
    """
    person = sim.populations["person"]
    benunit = sim.populations["benunit"]
    for year in range(start_year, end_year + 1):
        period = as_period(year)
        element = np.array(sim.calculate("uc_LCWRA_element", year))
        new_claim = np.asarray(
            sim.calculate("uc_receives_new_claimant_health_element", year),
            dtype=bool,
        )
        claimant = person("is_uc_assessed_claimant", period) & ~(
            other_member_of_single_claim(person, period)
        )
        qualifying = (
            claimant
            & person("uc_limited_capability_for_WRA", period)
            & (person("age", period) >= age_limit)
        )
        keep = benunit.any(qualifying) | ~new_claim
        set_model_value(
            sim, "uc_LCWRA_element", year, np.where(keep, element, 0.0)
        )
    return sim
