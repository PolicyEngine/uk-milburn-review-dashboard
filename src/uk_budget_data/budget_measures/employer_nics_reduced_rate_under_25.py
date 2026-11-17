"""A reduced employer National Insurance rate for young employees
(``milburn_report_employer_nics``). Hand-written.

One modifier in a module of its own: see the package docstring.
"""

import numpy as np
from policyengine_uk.utils.employer_ni import (
    salary_sacrifice_cost_terms,
    secondary_class_1_threshold,
)

from uk_budget_data.budget_measures import milburn_design as design
from uk_budget_data.measure_templates import _call_formula, _replace_formula


def employer_nics_reduced_rate_under_25(
    sim,
    rate,
    start_year=design.START_YEAR,
    end_year=design.LAST_POLICY_YEAR,
    age_limit=25,
):
    """Charge employer (secondary Class 1) contributions at ``rate``, not
    the main rate, on an employee's earnings between the secondary
    threshold and the upper secondary threshold, where the employee is
    under ``age_limit``, in fiscal years ``start_year`` to ``end_year``.
    Earnings above the upper secondary threshold bear the main rate.

    Hand-written: the zero-rate comparator (``employer_nics_zero_under_25``)
    is one parameter, the age below which the upper secondary threshold
    replaces the secondary threshold, and no parameter holds a second rate
    for an age band. This is the same schedule with ``rate`` in place of
    zero on that band, so ``rate=0`` is the comparator and ``rate`` equal
    to the main rate is current law.

    The band is the gap between the threshold the engine already gives
    each person (``secondary_class_1_threshold``) and the upper secondary
    threshold. Under-21s and relevant apprentices under 25 already have a
    threshold at the upper one, so their band is empty and they keep
    their zero rate.

    Three variables change, as the comparator moves all three:

    - ``ni_class_1_employer``: the charge, less (main rate - ``rate``) on
      the band;
    - ``employer_ni_fixed_employer_cost_change``: the engine's pass-through
      to pay. The native formula compares NI parameters, which do not
      change here, and returns nothing; this is the native calculation with
      the reduced-rate band in the reformed schedule (pay such that the
      employer's cost is the baseline's), at the engine's employee
      incidence;
    - ``adjusted_employer_cost``: the reformed employer cost the engine's
      capital and consumer incidence read, on the same schedule.

    ``salary_sacrifice_pension_ni_employer`` (a part of the charge, in no
    total) is left on the main rate.
    """

    def band_width(person, period, class_1, threshold):
        """Annual width of each person's reduced-rate band."""
        # Weekly, as the engine's thresholds are: 52 weeks a year.
        upper = np.float32(class_1.thresholds.upper_secondary_threshold * 52)
        in_ages = person("age", period) < age_limit
        return np.where(in_ages, np.maximum(upper - threshold, 0), 0)

    def applies(period):
        return start_year <= period.start.year <= end_year

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
        if (
            not gov.contrib.policyengine.employer_ni.exempt_employer_pension_contributions
        ):
            earnings = earnings + person(
                "employer_pension_contributions", period
            )
        threshold = secondary_class_1_threshold(person, period, class_1)
        width = band_width(person, period, class_1, threshold)
        main_rate = class_1.employer_scale.components[1].rate
        relief = (main_rate - rate) * np.clip(earnings - threshold, 0, width)
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
        if (
            gov.contrib.policyengine.employer_ni.exempt_employer_pension_contributions
        ):
            earnings = earnings - pension
        threshold = secondary_class_1_threshold(person, period, class_1)
        width = band_width(person, period, class_1, threshold)
        main_rate = class_1.employer_scale.components[1].rate
        relief = (main_rate - rate) * np.clip(earnings - threshold, 0, width)
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
        width = band_width(person, period, reform_class_1, t_r)
        if rate == r_r or not np.any(width > 0):
            # At the main rate the band is the native schedule.
            return current

        # As the native formula, from here to the reformed schedule.
        prior_employment_income = person(
            "employment_income_before_lsr", period
        )
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
        baseline_class_1 = (
            baseline_parameters.gov.hmrc.national_insurance.class_1
        )
        r_b = baseline_class_1.employer_scale.components[1].rate
        t_b = secondary_class_1_threshold(person, period, baseline_class_1)
        p_b = (
            baseline_parameters.gov.contrib.policyengine.employer_ni.exempt_employer_pension_contributions
        )
        pension_subtracted_b = pension if p_b else 0
        baseline_employer_ni = r_b * np.maximum(
            ni_class_1_income
            - pension_subtracted_b
            + ni_only_earnings_b
            - t_b,
            0,
        )
        c_b = ni_class_1_income + baseline_employer_ni
        pension_subtracted_r = (
            pension if employer_ni.exempt_employer_pension_contributions else 0
        )

        # The reformed cost of x (cost before employer NI) is x below k_t,
        # x + rate (x - k_t) from k_t to k_u, and x + rate (k_u - k_t) +
        # r_r (x - k_u) above k_u. It is continuous and strictly
        # increasing; solve it for the baseline cost c_b.
        k_t = pension_subtracted_r + t_r - ni_only_earnings_r
        k_u = k_t + width
        new_ni_class_1_income = np.where(
            c_b <= k_t,
            c_b,
            np.where(
                c_b <= k_u + rate * width,
                (c_b + rate * k_t) / (1 + rate),
                (c_b - rate * width + r_r * k_u) / (1 + r_r),
            ),
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
