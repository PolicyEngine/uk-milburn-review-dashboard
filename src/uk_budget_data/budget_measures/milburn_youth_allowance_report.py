"""The final report's Youth Allowance (17 November 2026). Hand-written.

What the report proposes ("From a Welfare State to a Working State",
chapter 6, paras 732 and 748 to 749; analytical annex sections 1 and 8):

* a Youth Allowance "set at the current UC rate for people under 25"
  (para 748), "higher for young people living independently". The annex
  models it inside Universal Credit: "paid at the rate of the current UC
  Standard Allowance for claimants aged under 25 unless they live
  independently, in which case it is increased to the rate currently paid
  to those aged 25 and over, proxied by receipt of the UC Housing Element"
  (annex section 8, Methodology);
* a work allowance "available for everyone in receipt of the Youth
  Allowance who is in employment" (para 749), "set at a level to allow for
  part-time work" (annex section 8). No amount is given.

The report does not take under-25s out of Universal Credit, and says
nothing on the housing, child, carer or childcare elements, the taper, the
benefit cap, Housing Benefit or passporting. So this module leaves all of
them as they are: the only changes are the standard allowance of young
claimants who get a housing costs element and, when amounts are given, the
work allowance. The health (LCWRA) element removal that the report pairs
with the allowance is ``milburn_report_uc_health``; it is not repeated
here, and the two can run in one simulation in either order.

The standard allowance is changed in its formula, not in the under-25
parameters: those feed the Universal Credit Act 2025 s. 4 floor on the
protected health element (``reforms.current_law_protected_health_element``)
and a parameter change would raise every under-25, not only those living
independently.

Year Y is fiscal year Y-(Y+1).
"""

import numpy as np

from uk_budget_data.budget_measures import milburn_design as design
from uk_budget_data.measure_templates import _call_formula, _replace_formula

# The annex's welfare figures start in 2029-30 ("starting in 2029/30",
# section 1; report para 769: every area served "by 2029"). The report
# wrapper below reads design.REPORT_START_YEAR; this is the report's own
# year, for a caller who passes it.
REPORT_FIRST_WELFARE_YEAR = 2029
# The age below which a claimant gets the Youth Allowance (para 748:
# "eligible people aged under 25").
YOUTH_ALLOWANCE_AGE_LIMIT = 25
MONTHS = 12
# ``work_allowance_monthly`` value for the year's statutory amounts.
CURRENT_WORK_ALLOWANCE = "current"


def _in_force(period, start_year, end_year):
    year = period.start.year
    return year >= start_year and (end_year is None or year <= end_year)


def _young_claim(benunit, period, age_limit):
    """Awards whose claimants are all under ``age_limit`` (the engine's
    under-25 standard allowance rule, reg. 36, at this age), and whether
    the award is a single claim."""
    person = benunit.members
    claimant = person("is_uc_single_or_joint_claimant", period)
    eldest = benunit.max(np.where(claimant, person("age", period), 0))
    return eldest < age_limit, benunit.sum(claimant) <= 1


def youth_allowance_report(
    sim,
    start_year=REPORT_FIRST_WELFARE_YEAR,
    end_year=None,
    age_limit=YOUTH_ALLOWANCE_AGE_LIMIT,
    independent_at_25_plus_rate=True,
    work_allowance_monthly=None,
):
    """The report's Youth Allowance, inside Universal Credit, from
    ``start_year`` (to ``end_year`` inclusive; None: no end).

    A claim whose claimants are all under ``age_limit`` keeps the under-25
    standard allowance (the "base level"), unless it gets a housing costs
    element, the annex's proxy for living independently: then it is paid
    the 25-and-over amount for a single claimant or a couple, read from
    the year's parameters, so it is uprated with them. A couple with a
    claimant aged 25 or over already has the higher rate and is unchanged.
    ``independent_at_25_plus_rate=False`` leaves every allowance at the
    base level (no award changes).

    ``work_allowance_monthly`` is None by default: the report gives no
    amount ("a level to allow for part-time work"), so none is invented.
    Given ``(with housing costs element, without)`` monthly amounts, a
    young claim with no work allowance today (no child and no limited
    capability for work, reg. 22) gets one at those amounts; a claim that
    already has one keeps the statutory amount. Given
    ``CURRENT_WORK_ALLOWANCE``, the amounts are the statutory ones of the
    year (``means_test.work_allowance``: the lower with a housing costs
    element, the higher without), so they are uprated as those are. The
    taper is unchanged, and a claim that is neither young nor entitled
    under reg. 22 has no allowance, as now.

    Everything that reads the allowance follows it: the maximum amount, the
    award and the benefit cap (the higher allowance counts towards it).
    """
    if type(age_limit) is not int or not 18 < age_limit <= 25:
        # Above 25 the "young" rate would be taken from claimants who have
        # the 25-and-over one today, which the report does not propose.
        raise ValueError("age_limit must be a whole age from 19 to 25")
    statutory_amounts = work_allowance_monthly == CURRENT_WORK_ALLOWANCE
    if work_allowance_monthly is not None and not statutory_amounts:
        with_housing, without_housing = (
            float(amount) for amount in work_allowance_monthly
        )
        if with_housing < 0 or without_housing < 0:
            raise ValueError("work_allowance_monthly amounts must be 0 or more")

    if independent_at_25_plus_rate:
        native_allowance = sim.tax_benefit_system.get_variable(
            "uc_standard_allowance"
        )

        def standard_allowance(benunit, period, parameters):
            current = _call_formula(
                native_allowance, benunit, period, parameters
            )
            if not _in_force(period, start_year, end_year):
                return current
            young, is_single = _young_claim(benunit, period, age_limit)
            independent = benunit("uc_housing_costs_element", period) > 0
            amounts = parameters(
                period
            ).gov.dwp.universal_credit.standard_allowance.amount
            higher = MONTHS * np.where(
                is_single, amounts.SINGLE_OLD, amounts.COUPLE_OLD
            )
            # max: never below the current amount.
            return np.where(
                young & independent, np.maximum(current, higher), current
            )

        _replace_formula(sim, "uc_standard_allowance", standard_allowance)

    if work_allowance_monthly is not None:
        native_eligible = sim.tax_benefit_system.get_variable(
            "is_uc_work_allowance_eligible"
        )
        native_amount = sim.tax_benefit_system.get_variable(
            "uc_work_allowance"
        )

        def eligible(benunit, period, parameters):
            current = _call_formula(
                native_eligible, benunit, period, parameters
            )
            if not _in_force(period, start_year, end_year):
                return current
            young, _ = _young_claim(benunit, period, age_limit)
            return current | young

        def amount(benunit, period, parameters):
            statutory = _call_formula(
                native_eligible, benunit, period, parameters
            )
            # The engine pays the amount only to an eligible claim
            # (``defined_for``); the replacement formula is not masked for
            # it, so the mask is applied here.
            current = np.where(
                statutory,
                _call_formula(native_amount, benunit, period, parameters),
                0,
            )
            if not _in_force(period, start_year, end_year):
                return current
            young, _ = _young_claim(benunit, period, age_limit)
            housing = benunit("uc_housing_costs_element", period) > 0
            if statutory_amounts:
                table = parameters(
                    period
                ).gov.dwp.universal_credit.means_test.work_allowance
                monthly = np.where(
                    housing, table.with_housing, table.without_housing
                )
            else:
                monthly = np.where(housing, with_housing, without_housing)
            return np.where(young & ~statutory, MONTHS * monthly, current)

        _replace_formula(sim, "is_uc_work_allowance_eligible", eligible)
        _replace_formula(sim, "uc_work_allowance", amount)
    return sim


def milburn_report_youth_allowance(sim):
    """The report's Youth Allowance from ``design.REPORT_START_YEAR`` (read
    when called, as the other ``milburn_report_*`` measures do): the
    25-and-over standard allowance for young claimants with a housing
    costs element, no work allowance change (the report gives no amount).
    """
    design.check_report_design()
    return youth_allowance_report(sim, start_year=design.REPORT_START_YEAR)


def milburn_report_youth_allowance_work_allowance(sim):
    """Illustrative: the report's work allowance for "everyone in receipt
    of the Youth Allowance who is in employment" (para 749), which has no
    amount, taken to be the current Universal Credit work allowance (our
    assumption). From ``design.REPORT_START_YEAR`` a claim whose claimants
    are all under 25 and that has no work allowance today gets the year's
    statutory one. The standard allowance is not changed here."""
    design.check_report_design()
    return youth_allowance_report(
        sim,
        start_year=design.REPORT_START_YEAR,
        independent_at_25_plus_rate=False,
        work_allowance_monthly=CURRENT_WORK_ALLOWANCE,
    )
