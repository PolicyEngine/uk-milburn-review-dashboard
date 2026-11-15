"""No Universal Credit health (LCWRA) element where the claimant with
limited capability for work and work-related activity is under 25
(``uc_health_element_removed_under_25``). Hand-written.

One modifier in a module of its own: see the package docstring.
"""

import numpy as np
from policyengine_core.periods import period as as_period
from policyengine_uk.utils.supplied_inputs import set_model_value
from policyengine_uk.utils.uc_work_related_requirements import (
    other_member_of_single_claim,
)


def uc_health_element_removed_under_25(
    sim,
    start_year=2027,
    end_year=2032,
    age_limit=25,
    keep_enhanced_pip_daily_living=False,
):
    """Remove the LCWRA element from awards in which no claimant aged
    ``age_limit`` or over has limited capability for work and work-related
    activity, protected (pre-2026) and new-claimant rates alike, from
    ``start_year`` to ``end_year`` (fiscal years, inclusive).

    Hand-written because the engine's UC rebalancing
    (policyengine_uk.scenarios.uc_reform.add_universal_credit_reform)
    stores ``uc_LCWRA_element`` as an input in every year it runs (2026-27
    to 2032-33 in policyengine-uk 2.177.7), so a wrapper of the element's
    formula would move no award. This runs after that step (a modifier's
    default phase, after data load) and rewrites the stored element: kept
    where some claimant with LCWRA is 25 or over (joint claimants get one
    element, reg. 27(4)), nil otherwise. The claimant mask is the native
    formula's: an assessed claimant who is not the other member of a single
    claim.

    Everything that reads the element follows it: the award, the benefit
    cap's LCWRA exception (UC Regs 2013 reg. 83(1)(a): an award without the
    element is no longer exempt on that ground) and the carer element's
    LCWRA overlap rule. The LCWRA status itself is unchanged, so the work
    allowance and conditionality are unchanged.
    """
    person = sim.populations["person"]
    benunit = sim.populations["benunit"]
    for year in range(start_year, end_year + 1):
        period = as_period(year)
        element = np.array(sim.calculate("uc_LCWRA_element", year))
        claimant = person("is_uc_assessed_claimant", period) & ~(
            other_member_of_single_claim(person, period)
        )
        qualifying = (
            claimant
            & person("uc_limited_capability_for_WRA", period)
            & (person("age", period) >= age_limit)
        )
        if keep_enhanced_pip_daily_living:
            # Severity proxy: a young claimant with LCWRA whose PIP daily
            # living category is enhanced keeps the element. The category,
            # not the payment, is read, so a PIP change in the same run
            # does not move it.
            category = person("pip_dl_category", period)
            if hasattr(category, "possible_values"):
                enhanced = category == category.possible_values.ENHANCED
            else:
                enhanced = np.asarray(category).astype(str) == "ENHANCED"
            qualifying = qualifying | (
                claimant
                & person("uc_limited_capability_for_WRA", period)
                & enhanced
            )
        keep = benunit.any(qualifying)
        set_model_value(
            sim, "uc_LCWRA_element", year, np.where(keep, element, 0.0)
        )
    return sim


def uc_health_element_removed_under_22(sim):
    """As above with the age limit at 22 (the 2025 Pathways to Work
    proposal)."""
    return uc_health_element_removed_under_25(sim, age_limit=22)


def uc_health_element_removed_under_25_severe_kept(sim):
    """As above, but young claimants with LCWRA and an enhanced PIP daily
    living award keep the element: a proxy for the trailed higher-rate
    benefit for people with the most severe conditions."""
    return uc_health_element_removed_under_25(
        sim, keep_enhanced_pip_daily_living=True
    )
