"""The Milburn report's employer National Insurance proposal: a higher
secondary threshold for employees aged 21 to 24 in retail and hospitality,
raised in steps from £5,000 to £10,000 over five years. Hand-written.

One modifier in a module of its own: see the package docstring.

The report ("From a Welfare State to a Working State", 17 November 2026),
paragraphs 50 and 269 to 271:

- para 270: "When fiscal conditions allow, the point at which employers in
  those sectors pay employer National Insurance for 21 to 24 year-olds
  should double and rise progressively from the current £5,000 threshold
  to a new one of £10,000."
- para 269: "a 5-year glide path to lower National Insurance costs for
  workers aged 21 to 24".
- para 270: "A start should be made with the 2 sectors which provide the
  most entry level jobs for young people: retail and hospitality."
- para 271: "The pace of change would be set at each fiscal event".

The report gives no start date, no year-by-year thresholds and no costing
of this proposal (its analytical annex prices the Youth Jobs Grant and
apprenticeships under "youth hiring incentives", not this). What is
assumed here, and is not in the report:

- the start, April 2027 (``START_YEAR``), though the report says only
  "when fiscal conditions allow";
- the main option is the end state, £10,000 in every year from 2027-28
  (``END_STATE_THRESHOLDS``); the glide path is a second option, in five
  equal steps of £1,000 (``REPORT_THRESHOLDS``): £6,000 in 2027-28 to
  £10,000 in 2031-32, in cash, held at the last value afterwards;
- the sectors as SIC 2007 divisions of the main job
  (``RETAIL_AND_HOSPITALITY``): 47, retail trade except of motor vehicles;
  55, accommodation; 56, food and beverage service activities. The report
  defines neither sector; ``SECTIONS_G_AND_I`` is the wider reading.
"""

import numpy as np
from policyengine_uk.utils.employer_ni import (
    salary_sacrifice_cost_terms,
    secondary_class_1_threshold,
)

from uk_budget_data.measure_templates import _call_formula, _replace_formula

START_YEAR = 2027
# Annual secondary threshold for the age band, by fiscal year (the year the
# fiscal year starts in). Assumed: five equal steps from current law's
# £5,000 to the report's £10,000.
REPORT_THRESHOLDS = {
    2027: 6_000,
    2028: 7_000,
    2029: 8_000,
    2030: 9_000,
    2031: 10_000,
}
# The end state, the main option: the report's £10,000 in every year from
# the start, in cash (current law's threshold is £5,000 to 2030-31, then
# rises with CPI: £5,100 in 2031-32).
END_STATE_THRESHOLD = 10_000
END_STATE_THRESHOLDS = {START_YEAR: END_STATE_THRESHOLD}
LOWEST_AGE = 21
AGE_LIMIT = 25  # under 25: "21 to 24 year-olds"
# SIC 2007 divisions (``sic_industry_division``, the main or last job).
RETAIL = (47,)
HOSPITALITY = (55, 56)
RETAIL_AND_HOSPITALITY = RETAIL + HOSPITALITY
# A wider reading, for a sensitivity run: SIC sections G (wholesale and
# retail trade; repair of motor vehicles: 45 to 47) and I (accommodation
# and food service: 55, 56). The report's "37% of jobs for young people
# aged 16 to 24" (para 50, footnote 14) is from the ONS's employment by
# industry section, which has no narrower retail group.
SECTIONS_G_AND_I = (45, 46) + RETAIL_AND_HOSPITALITY


def threshold_in(year, thresholds):
    """The measure's annual threshold in fiscal year ``year``: None before
    the first scheduled year (current law), the scheduled value, the latest
    earlier one in a gap, and the last one after the schedule ends."""
    reached = [y for y in thresholds if y <= year]
    return thresholds[max(reached)] if reached else None


def employer_nics_threshold_ages_21_to_24(
    sim,
    thresholds=None,
    lowest_age=LOWEST_AGE,
    age_limit=AGE_LIMIT,
    sic_divisions=RETAIL_AND_HOSPITALITY,
):
    """Raise the secondary threshold, above which employers pay Class 1
    contributions, to ``thresholds[year]`` a year for employees aged
    ``lowest_age`` to under ``age_limit`` whose main job is in one of
    ``sic_divisions``. ``sic_divisions=None`` applies it in every sector,
    which is an upper bound on the report's two-sector proposal.

    Hand-written: the secondary threshold is one parameter for all
    employees, and no parameter holds a second threshold for an age band
    or a sector.

    Each person's band is the gap between the threshold the engine already
    gives them (``secondary_class_1_threshold``) and the measure's. The
    main rate comes off earnings in the band. Under-21s and relevant
    apprentices under 25 already have a threshold at the upper secondary
    one, so their band is empty; so is anyone's whose current-law threshold
    is at or above the measure's.

    Three variables change, as in ``employer_nics_reduced_rate_under_25``
    (this is that schedule with a zero rate on a narrower band):

    - ``ni_class_1_employer``: the charge, less the main rate on the band;
    - ``employer_ni_fixed_employer_cost_change``: the engine's pass-through
      to pay. The native formula compares NI parameters, which do not
      change here; this is the native calculation with the higher threshold
      in the reformed schedule (pay such that the employer's cost is the
      baseline's), at the engine's employee incidence;
    - ``adjusted_employer_cost``: the reformed employer cost the engine's
      capital and consumer incidence read, on the same schedule.

    Limits. The sector is the SIC division of the person's main (or last)
    job, as the Family Resources Survey records it: a second job in another
    sector is not seen, and a record with no division (0) is outside the
    sector. The Employment Allowance is not modelled per employer, so small
    employers who pay no contributions today are relieved here as well.
    Hiring is fixed: the engine moves pay, not employment.
    """
    thresholds = dict(REPORT_THRESHOLDS if thresholds is None else thresholds)
    if not thresholds:
        raise ValueError("thresholds needs at least one fiscal year")
    if lowest_age >= age_limit:
        raise ValueError("lowest_age must be below age_limit")
    divisions = None if sic_divisions is None else list(sic_divisions)
    if divisions is not None and not divisions:
        raise ValueError(
            "sic_divisions is empty; pass None to apply it in every sector"
        )

    def band_width(person, period, threshold):
        """Annual width of each person's newly zero-rated band."""
        new_threshold = threshold_in(period.start.year, thresholds)
        if new_threshold is None:
            return np.zeros_like(threshold)
        age = person("age", period)
        eligible = (age >= lowest_age) & (age < age_limit)
        if divisions is not None:
            eligible = eligible & np.isin(
                person("sic_industry_division", period), divisions
            )
        return np.where(
            eligible,
            np.maximum(np.float32(new_threshold) - threshold, 0),
            0,
        )

    def applies(period):
        return threshold_in(period.start.year, thresholds) is not None

    native_charge = sim.tax_benefit_system.get_variable("ni_class_1_employer")
    native_cost = sim.tax_benefit_system.get_variable("adjusted_employer_cost")
    native_change = sim.tax_benefit_system.get_variable(
        "employer_ni_fixed_employer_cost_change"
    )

    def charge(person, period, parameters):
        current = _call_formula(native_charge, person, period, parameters)
        if not applies(period):
            return current
        gov = parameters(period).gov
        class_1 = gov.hmrc.national_insurance.class_1
        earnings = person("ni_class_1_income", period)
        if not gov.contrib.policyengine.employer_ni.exempt_employer_pension_contributions:
            earnings = earnings + person(
                "employer_pension_contributions", period
            )
        threshold = secondary_class_1_threshold(person, period, class_1)
        width = band_width(person, period, threshold)
        main_rate = class_1.employer_scale.components[1].rate
        relief = main_rate * np.clip(earnings - threshold, 0, width)
        return np.where(width > 0, current - relief, current)

    def cost(person, period, parameters):
        current = _call_formula(native_cost, person, period, parameters)
        if not applies(period):
            return current
        gov = parameters(period).gov
        class_1 = gov.hmrc.national_insurance.class_1
        pension = person("employer_pension_contributions", period)
        earnings = (
            person("employment_income", period)
            + person("statutory_sick_pay", period)
            + person("statutory_maternity_pay", period)
            + person("statutory_paternity_pay", period)
            + pension
            + person("salary_sacrifice_pension_ni_excess", period)
        )
        if gov.contrib.policyengine.employer_ni.exempt_employer_pension_contributions:
            earnings = earnings - pension
        threshold = secondary_class_1_threshold(person, period, class_1)
        width = band_width(person, period, threshold)
        main_rate = class_1.employer_scale.components[1].rate
        relief = main_rate * np.clip(earnings - threshold, 0, width)
        return np.where(width > 0, current - relief, current)

    def pay_change(person, period, parameters):
        current = _call_formula(native_change, person, period, parameters)
        baseline = person.simulation.baseline
        if not applies(period) or baseline is None:
            return current
        reform_parameters = parameters(period)
        employer_ni = reform_parameters.gov.contrib.policyengine.employer_ni
        employee_incidence = employer_ni.employee_incidence
        if employee_incidence == 0:
            return current
        reform_class_1 = reform_parameters.gov.hmrc.national_insurance.class_1
        r_r = reform_class_1.employer_scale.components[1].rate
        t_r = secondary_class_1_threshold(person, period, reform_class_1)
        width = band_width(person, period, t_r)
        if not np.any(width > 0):
            return current

        # As the native formula, from here to the reformed schedule.
        prior_employment_income = person("employment_income_before_lsr", period)
        behavioural_response = person(
            "employment_income_behavioral_response", period
        )
        benefits = (
            person("statutory_sick_pay", period)
            + person("statutory_maternity_pay", period)
            + person("statutory_paternity_pay", period)
        )
        pension = person("employer_pension_contributions", period)
        baseline_person = baseline.populations["person"]
        sacrifice_pay_b, ni_only_earnings_b = salary_sacrifice_cost_terms(
            baseline_person, period
        )
        sacrifice_pay_r, ni_only_earnings_r = salary_sacrifice_cost_terms(
            person, period
        )
        pay_before_sacrifice = prior_employment_income + behavioural_response
        ni_class_1_income = (
            pay_before_sacrifice + sacrifice_pay_b + benefits + pension
        )
        baseline_parameters = baseline.tax_benefit_system.parameters(period)
        baseline_class_1 = baseline_parameters.gov.hmrc.national_insurance.class_1
        r_b = baseline_class_1.employer_scale.components[1].rate
        t_b = secondary_class_1_threshold(person, period, baseline_class_1)
        p_b = baseline_parameters.gov.contrib.policyengine.employer_ni.exempt_employer_pension_contributions
        pension_subtracted_b = pension if p_b else 0
        baseline_employer_ni = r_b * np.maximum(
            ni_class_1_income - pension_subtracted_b + ni_only_earnings_b - t_b,
            0,
        )
        c_b = ni_class_1_income + baseline_employer_ni
        pension_subtracted_r = (
            pension if employer_ni.exempt_employer_pension_contributions else 0
        )

        # The reformed cost of x (cost before employer NI) is x up to k_u,
        # the measure's threshold, and x + r_r (x - k_u) above it. It is
        # continuous and strictly increasing; solve it for the baseline
        # cost c_b.
        k_u = pension_subtracted_r + t_r - ni_only_earnings_r + width
        new_ni_class_1_income = np.where(
            c_b <= k_u, c_b, (c_b + r_r * k_u) / (1 + r_r)
        )
        previous_employment_income = pay_before_sacrifice + sacrifice_pay_r
        new_employment_income = new_ni_class_1_income - benefits - pension
        change = np.maximum(
            new_employment_income - previous_employment_income,
            -previous_employment_income,
        )
        change = np.where(
            previous_employment_income > 0, change * employee_incidence, 0
        )
        return np.where(width > 0, change, current)

    _replace_formula(sim, "ni_class_1_employer", charge)
    _replace_formula(sim, "adjusted_employer_cost", cost)
    _replace_formula(sim, "employer_ni_fixed_employer_cost_change", pay_change)
    return sim


def milburn_employer_nics_report(sim):
    """The main option, the report's end state: a £10,000 threshold for
    ages 21 to 24 in retail and hospitality in every year from 2027-28
    (``END_STATE_THRESHOLDS``), as if the glide path were complete."""
    return employer_nics_threshold_ages_21_to_24(
        sim, thresholds=END_STATE_THRESHOLDS
    )


def milburn_employer_nics_report_glide_path(sim):
    """The same measure phased in: £6,000 in 2027-28 rising £1,000 a year
    to £10,000 in 2031-32 (``REPORT_THRESHOLDS``, assumed steps)."""
    return employer_nics_threshold_ages_21_to_24(sim)


def milburn_employer_nics_report_all_sectors(sim):
    """The end state for every 21 to 24-year-old employee: where the
    report says the relief should go "over time", and an upper bound on
    the two-sector start."""
    return employer_nics_threshold_ages_21_to_24(
        sim, thresholds=END_STATE_THRESHOLDS, sic_divisions=None
    )
