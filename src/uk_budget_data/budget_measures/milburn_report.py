"""The final report's design (17 November 2026), run from the ``REPORT_*``
constants in ``milburn_design``. Hand-written.

Each function reads the constants when it is called, so editing
``milburn_design.py`` and running the ``milburn_report_*`` ids is all a
re-parameterisation needs. With the constants as committed on 16 November
they equal the 15 November designs: ``milburn_report_package`` is then
``milburn_package`` (``tests/test_milburn_design.py``).

The ids are reserved in ``reforms.py`` (resolvable by ``generate
--reforms``, not listed on the page until promoted).
"""

from uk_budget_data.budget_measures import milburn_design as design
from uk_budget_data.budget_measures.milburn_variants import (
    _employment_response,
    lcwra_removed_under_25_phased,
    pip_removed_18_to_24_phased,
)
from uk_budget_data.budget_measures.pip_removed_ages_18_to_24 import (
    pip_removed_ages_18_to_24,
)
from uk_budget_data.budget_measures.uc_health_element_removed_under_25 import (
    uc_health_element_removed_under_25,
)


def milburn_report_uc_health(sim):
    """The report's UC health (LCWRA) element removal."""
    design.check_report_design()
    return uc_health_element_removed_under_25(
        sim,
        start_year=design.REPORT_START_YEAR,
        end_year=design.UC_ELEMENT_LAST_YEAR,
        age_limit=design.REPORT_UC_HEALTH_UPPER_AGE,
        keep_enhanced_pip_daily_living=design.REPORT_UC_HEALTH_SEVERE_KEPT,
        lowest_age=design.REPORT_UC_HEALTH_LOWER_AGE,
        severe_dl_points=design.REPORT_SEVERE_DL_POINTS,
    )


def milburn_report_pip(sim):
    """The report's PIP removal (or reduction, with a replacement share)."""
    design.check_report_design()
    return pip_removed_ages_18_to_24(
        sim,
        start_year=design.REPORT_START_YEAR,
        lowest_age=design.REPORT_PIP_LOWER_AGE,
        age_limit=design.REPORT_PIP_UPPER_AGE,
        include_scotland=design.REPORT_PIP_INCLUDE_SCOTLAND,
        share_kept=design.REPORT_PIP_REPLACEMENT_SHARE,
    )


def milburn_report_package_phased(sim):
    """The report's package reaching claimants by natural migration: new
    entrants at once, the stock at ``REPORT_REASSESSED_EACH_YEAR`` a year
    (0: existing claimants are never reached, transitional protection).
    The severe-case proxy is not applied in the phased run."""
    design.check_report_design()
    migration = dict(
        rate=design.REPORT_REASSESSED_EACH_YEAR,
        cohort_start=design.REPORT_START_YEAR - 1,
        entrant_age=design.REPORT_NEW_ENTRANT_AGE,
    )
    sim = lcwra_removed_under_25_phased(
        sim,
        start_year=design.REPORT_START_YEAR,
        end_year=design.UC_ELEMENT_LAST_YEAR,
        age_limit=design.REPORT_UC_HEALTH_UPPER_AGE,
        lowest_age=design.REPORT_UC_HEALTH_LOWER_AGE,
        **migration,
    )
    return pip_removed_18_to_24_phased(
        sim,
        start_year=design.REPORT_START_YEAR,
        lowest_age=design.REPORT_PIP_LOWER_AGE,
        age_limit=design.REPORT_PIP_UPPER_AGE,
        include_scotland=design.REPORT_PIP_INCLUDE_SCOTLAND,
        share_kept=design.REPORT_PIP_REPLACEMENT_SHARE,
        **migration,
    )


def milburn_report_package_with_entry_25pct(sim):
    """The report's package, with a quarter of affected non-working young
    people (from the PIP lower age to the higher of the two upper ages)
    moving into 16 hours a week at their minimum wage."""
    design.check_report_design()
    sim = _employment_response(
        sim,
        design.ENTRY_SHARE,
        start_year=design.REPORT_START_YEAR,
        end_year=design.LAST_POLICY_YEAR,
        hours=design.ENTRY_HOURS,
        lowest_age=design.REPORT_PIP_LOWER_AGE,
        age_limit=max(
            design.REPORT_PIP_UPPER_AGE, design.REPORT_UC_HEALTH_UPPER_AGE
        ),
    )
    sim = milburn_report_uc_health(sim)
    return milburn_report_pip(sim)
