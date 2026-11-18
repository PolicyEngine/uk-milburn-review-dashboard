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
from uk_budget_data.budget_measures.employer_nics_reduced_rate_under_25 import (
    employer_nics_reduced_rate_under_25,
)
from uk_budget_data.budget_measures.milburn_variants import (
    _employment_response,
    employment_response_in_group,
    entry_group,
    lcwra_removed_under_25_phased,
    pip_removed_18_to_24_phased,
    reached,
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
    """The report's PIP removal (or reduction, with a uniform replacement
    share or, when ``REPORT_PIP_REPLACEMENT_SHARES`` is set, a share for
    each component and award level)."""
    design.check_report_design()
    return pip_removed_ages_18_to_24(
        sim,
        start_year=design.REPORT_START_YEAR,
        lowest_age=design.REPORT_PIP_LOWER_AGE,
        age_limit=design.REPORT_PIP_UPPER_AGE,
        include_scotland=design.REPORT_PIP_INCLUDE_SCOTLAND,
        share_kept=design.REPORT_PIP_REPLACEMENT_SHARE,
        shares_kept=design.REPORT_PIP_REPLACEMENT_SHARES,
    )


def milburn_report_employer_nics(sim):
    """The report's reduced employer National Insurance rate for young
    employees (``REPORT_EMPLOYER_NICS_UNDER_25_RATE``; refused while it is
    None)."""
    design.check_report_design()
    if design.REPORT_EMPLOYER_NICS_UNDER_25_RATE is None:
        raise ValueError(
            "Milburn report design: REPORT_EMPLOYER_NICS_UNDER_25_RATE is "
            "None, so there is no employer NICs measure to run."
        )
    return employer_nics_reduced_rate_under_25(
        sim,
        rate=design.REPORT_EMPLOYER_NICS_UNDER_25_RATE,
        start_year=design.REPORT_START_YEAR,
        end_year=design.LAST_POLICY_YEAR,
        age_limit=design.REPORT_EMPLOYER_NICS_AGE_LIMIT,
    )


def milburn_report_package_phased(sim):
    """The report's package reaching claimants by natural migration: new
    entrants at once, the stock at ``REPORT_REASSESSED_EACH_YEAR`` a year
    (0: existing claimants are never reached, transitional protection).
    The severe-case proxy is not applied in the phased run, and the
    employer National Insurance rate is not part of it."""
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
        shares_kept=design.REPORT_PIP_REPLACEMENT_SHARES,
        **migration,
    )


def milburn_report_package_with_entry_25pct(sim):
    """The report's package, with a quarter of affected non-working young
    people (from the PIP lower age to the higher of the two upper ages)
    moving into 16 hours a week at their minimum wage. The employer
    National Insurance rate is not part of it."""
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


# The phased move into work (docs/milburn-phased-scenario-design.md): runs
# in which everyone in the group moves, for the page's arithmetic
# (scripts/milburn_entry_path.py), and the linearity check's seeded share
# and its complement. None of them is published as a run.


def _report_migration():
    return dict(
        rate=design.REPORT_REASSESSED_EACH_YEAR,
        cohort_start=design.REPORT_START_YEAR - 1,
        entrant_age=design.REPORT_NEW_ENTRANT_AGE,
    )


def _report_entry_group(include_pip=False, phased=False):
    if design.REPORT_UC_HEALTH_SEVERE_KEPT:
        raise ValueError(
            "Milburn report design: the entry runs follow the health "
            "element removal without the severe-case proxy, so "
            "REPORT_UC_HEALTH_SEVERE_KEPT must be False."
        )
    if include_pip and (
        design.REPORT_PIP_REPLACEMENT_SHARE != 0
        or design.REPORT_PIP_REPLACEMENT_SHARES is not None
    ):
        raise ValueError(
            "Milburn report design: the with-PIP entry runs need PIP "
            "removed (REPORT_PIP_REPLACEMENT_SHARE 0, no tiered shares)."
        )
    migration = _report_migration()
    reach = (
        (lambda person, period: reached(person, period, **migration))
        if phased
        else None
    )

    def group(sim, year):
        return entry_group(
            sim,
            year,
            lowest_age=design.REPORT_PIP_LOWER_AGE,
            age_limit=max(
                design.REPORT_PIP_UPPER_AGE, design.REPORT_UC_HEALTH_UPPER_AGE
            ),
            uc_upper_age=design.REPORT_UC_HEALTH_UPPER_AGE,
            uc_lower_age=design.REPORT_UC_HEALTH_LOWER_AGE,
            include_pip=include_pip,
            include_scotland=design.REPORT_PIP_INCLUDE_SCOTLAND,
            reach=reach,
        )

    return group


def _report_entry(sim, share, include_pip=False, phased=False, below=True):
    design.check_report_design()
    return employment_response_in_group(
        sim,
        _report_entry_group(include_pip, phased),
        share,
        start_year=design.REPORT_START_YEAR,
        end_year=design.LAST_POLICY_YEAR,
        hours=design.ENTRY_HOURS,
        draws_below=below,
    )


def milburn_report_package_entry_all_uc_health(sim):
    """The report package, with every non-working 18 to 24-year-old who
    loses the health element moving into 16 hours at their minimum wage."""
    sim = _report_entry(sim, 1.0)
    sim = milburn_report_uc_health(sim)
    return milburn_report_pip(sim)


def milburn_report_package_entry_all_with_pip(sim):
    """As above, adding non-working 18 to 24-year-olds who lose PIP."""
    sim = _report_entry(sim, 1.0, include_pip=True)
    sim = milburn_report_uc_health(sim)
    return milburn_report_pip(sim)


def milburn_report_package_phased_entry_all_uc_health(sim):
    """The phased package, with every non-working 18 to 24-year-old the
    new rules have reached who loses the health element moving into
    work."""
    sim = _report_entry(sim, 1.0, phased=True)
    return milburn_report_package_phased(sim)


def milburn_report_package_entry_check_with_pip(sim):
    """The linearity check: the with-PIP group, a seeded
    REPORT_ENTRY_CHECK_SHARE of it moving."""
    sim = _report_entry(sim, design.REPORT_ENTRY_CHECK_SHARE, include_pip=True)
    sim = milburn_report_uc_health(sim)
    return milburn_report_pip(sim)


def milburn_report_package_entry_check_complement_with_pip(sim):
    """The linearity check's complement: the rest of the with-PIP group
    (the same draw at or above the share) moving."""
    sim = _report_entry(
        sim, design.REPORT_ENTRY_CHECK_SHARE, include_pip=True, below=False
    )
    sim = milburn_report_uc_health(sim)
    return milburn_report_pip(sim)
