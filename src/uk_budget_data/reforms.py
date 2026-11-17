"""Candidate measures for the Milburn review of young people and work.

The active registry is the Milburn section at the end of this module: five
computable measures and their combined package, each compared against
current law in policyengine-uk 2.177.7 (Microcosm build fcfac709, certified in policyengine 6.20.1; see
``uk_budget_data.local_build``) from 2027-28, and four measures listed as
not computable with their reasons (``NOT_COMPUTABLE_MEASURES``).

The candidate Autumn Budget 2026 measures above them are retired: their
factories and ids stay, unregistered, because other modules and kept tests
import them. What follows describes them as written for the Budget.

These were candidates, modelled before the Budget from reporting and
briefing up to 24 October 2026; none is announced policy. They replaced
the nine Autumn Budget 2025 placeholder measures on 24 October, all of
which are already in the policyengine-uk 2.132.6 baseline or had lapsed.

Every measure is compared against current law: the installed
policyengine-uk (2.132.6, through policyengine 6.10.2), with no baseline
changes of its own, except the Plan 2 measure, whose baseline also counts
modelled student loan repayments. Every measure that moves capital gains
tax holds capital gains realisations fixed (``static_capital_gains``), so
its figure is static. A measure changes parameters
(``parameter_changes``, bound by content) or applies a modifier from
``budget_measures``, each in a module of its own (of fixed shape, which
receipts can bind; this module fills caches at run time, so no modifier
may live here).

Year Y is fiscal year Y-(Y+1).
"""

from dataclasses import dataclass
from datetime import date
from typing import Optional

from uk_budget_data.budget_measures import (
    state_pension_only_income_tax_allowance as _sp_threshold,
)
from uk_budget_data.budget_measures import (
    zero_vat_on_domestic_electricity as _electricity,
)
from uk_budget_data.budget_measures.bus_fare_cap_2027 import (
    bus_fare_cap_2027,
)
from uk_budget_data.budget_measures.carers_allowance_earnings_taper import (
    carers_allowance_earnings_taper,
)
from uk_budget_data.budget_measures.connect_student_loan_repayments import (
    connect_student_loan_repayments,
)
from uk_budget_data.budget_measures.employer_ni_relief_ages_21_to_24 import (
    employer_ni_relief_ages_21_to_24,
)
from uk_budget_data.budget_measures.household_energy_payment_2026 import (
    household_energy_payment_2026,
)
from uk_budget_data.budget_measures.pension_tax_allowance import (
    pension_tax_allowance,
)
from uk_budget_data.budget_measures import milburn_design
from uk_budget_data.budget_measures.milburn_report import (
    milburn_report_employer_nics,
    milburn_report_package_phased,
    milburn_report_package_with_entry_25pct,
    milburn_report_pip,
    milburn_report_uc_health,
)
from uk_budget_data.budget_measures.milburn_variants import (
    milburn_package_phased,
    milburn_package_with_entry_25pct,
)
from uk_budget_data.budget_measures.pip_removed_ages_18_to_24 import (
    pip_halved_ages_18_to_24,
    pip_removed_ages_16_to_24,
    pip_removed_ages_16_to_24_excluding_scotland,
    pip_removed_ages_18_to_24,
    pip_removed_ages_18_to_24_excluding_scotland,
)
from uk_budget_data.budget_measures.planned_cash_isa_limit import (
    planned_cash_isa_limit,
)
from uk_budget_data.budget_measures.pump_vat_on_fuel_duty_deferral import (
    pump_vat_on_fuel_duty_deferral,
)
from uk_budget_data.budget_measures.road_fuel_vat_cut import road_fuel_vat_cut
from uk_budget_data.budget_measures.state_pension_income_tax_allowance import (
    state_pension_income_tax_allowance,
)
from uk_budget_data.budget_measures.state_pension_only_income_tax_allowance import (
    state_pension_only_income_tax_allowance,
)
from uk_budget_data.budget_measures.uc_health_element_removed_under_25 import (
    uc_health_element_removed_under_22,
    uc_health_element_removed_under_25,
    uc_health_element_removed_under_25_severe_kept,
)
from uk_budget_data.budget_measures.uc_health_element_removed_under_25_new_claims import (
    uc_health_element_removed_under_25_new_claims,
)
from uk_budget_data.budget_measures.warm_home_discount_top_up import (
    warm_home_discount_top_up,
)
from uk_budget_data.budget_measures.zero_vat_on_domestic_electricity import (
    zero_vat_on_domestic_electricity,
)
from uk_budget_data.budget_years import POLICY_YEARS
from uk_budget_data.forecast import (
    FUEL_DUTY_STATUTORY,
    forecast_parameters,
    fuel_duty_rpi_steps,
)
from uk_budget_data.measure_templates import (
    rate_change,
    threshold_change,
    uc_health_element_change,
)
from uk_budget_data.models import Reform

# Default years for parameter changes: the policy years in
# budget_years.json, which the page reads too (2026-27 to 2031-32)
DEFAULT_YEARS = list(POLICY_YEARS)

# Legacy lifetime response columns have no reviewed publication contract.
# Keep this empty for receipt compatibility; the live single-year calculator
# uses the current registry through the household API.
PUBLIC_PERSONAL_SERIES: dict[str, dict] = {}

FUEL_DUTY = "gov.hmrc.fuel_duty.petrol_and_diesel"
PERSONAL_ALLOWANCE = "gov.hmrc.income_tax.allowances.personal_allowance.amount"
BASIC_RATE_BAND = "gov.hmrc.income_tax.rates.uk[1].threshold"
BADR_LIFETIME_LIMIT = "gov.hmrc.cgt.badr.lifetime_limit"
PLAN_2_THRESHOLD = "gov.hmrc.student_loans.thresholds.plan_2"
CAPITAL_GAINS_RESPONSES = "gov.simulation.capital_gains_responses"
LHA_FREEZE = "gov.dwp.LHA.freeze"
# Northern Ireland's, which the Housing Executive sets as DWP does
LHA_FREEZE_NI = "gov.dfc.LHA.freeze"
# The employer (secondary) Class 1 threshold, weekly: £5,000 a year from
# April 2025 is stored as 5,000 / 52.
SECONDARY_THRESHOLD = (
    "gov.hmrc.national_insurance.class_1.employer_scale[1].threshold"
)
INCOME_TAX_RATES = "gov.hmrc.income_tax.rates"
# Budget 2026 document (3.9; Table 6.1 rows 61 and 62): property and
# savings income rates up a further 2 points from April 2027 at the basic,
# higher and additional rates; dividends unchanged. One measure each, as
# the Treasury's two rows (Vahid, 28 October 2026).
PROPERTY_INCOME_RATE_PATHS = (
    f"{INCOME_TAX_RATES}.property.basic",
    f"{INCOME_TAX_RATES}.property.higher",
    f"{INCOME_TAX_RATES}.property.additional",
)
SAVINGS_INCOME_RATE_PATHS = (
    f"{INCOME_TAX_RATES}.savings.basic",
    f"{INCOME_TAX_RATES}.savings.higher",
    f"{INCOME_TAX_RATES}.savings.additional",
)
# Both together: the single measure withdrawn when they were split.
UNEARNED_INCOME_RATE_PATHS = (
    *SAVINGS_INCOME_RATE_PATHS,
    *PROPERTY_INCOME_RATE_PATHS,
)

FUEL_DUTY_DEFERRAL_ID = "fuel_duty_rise_deferral"
STATE_PENSION_ALLOWANCE_ID = "state_pension_income_tax_protection"
WARM_HOME_DISCOUNT_ID = "warm_home_discount_top_up"
ELECTRICITY_VAT_ID = "domestic_electricity_zero_vat"
EMPLOYER_NI_ID = "employer_ni_relief_under_25s"
THRESHOLD_FREEZE_ID = "threshold_freeze_2031_32"
BADR_ID = "badr_lifetime_limit_cut"
FUEL_VAT_ID = "road_fuel_vat_cut"
PLAN_2_ID = "plan_2_threshold_unfreeze"
EMPLOYER_NI_THRESHOLD_ID = "employer_nics_secondary_threshold_raise"
UNEARNED_INCOME_RATES_ID = "unearned_income_rates_up"
PROPERTY_INCOME_RATES_ID = "property_income_rates_up"
SAVINGS_INCOME_RATES_ID = "savings_income_rates_up"
LHA_UNFREEZE_ID = "lha_unfreeze_2027"
CARERS_ALLOWANCE_TAPER_ID = "carers_allowance_earnings_taper"
STATE_PENSION_DOUBLE_LOCK_ID = "state_pension_double_lock_2030"
HOUSEHOLD_ENERGY_PAYMENT_ID = "household_energy_payment_2026"
TRADING_ALLOWANCE_ID = "trading_allowance_raise"
BUS_FARE_CAP_ID = "bus_fare_cap_2027"
CASH_ISA_LIMIT_ID = "cash_isa_limit_kept"
MACHINE_GAMES_DUTY_ID = "machine_games_duty_rise"
TRADING_ALLOWANCE = "gov.hmrc.income_tax.allowances.trading_allowance"
MACHINE_GAMES_STANDARD_RATE = (
    "gov.hmrc.gambling_duty.machine_games.rates.standard"
)


def _years_dict(value, years: list[int] = None) -> dict[str, any]:
    """Create a {year: value} dict for parameter changes."""
    years = years or DEFAULT_YEARS
    return {str(y): value for y in years}


def _years_from(first_year: int, value) -> dict[str, any]:
    """A {year: value} dict for every policy year from ``first_year``."""
    return _years_dict(value, [y for y in POLICY_YEARS if y >= first_year])


def static_capital_gains() -> dict[str, dict[str, any]]:
    """No capital gains realisation response, in every policy year.

    Set by every measure that moves capital gains tax, through its rates,
    bands, allowances or reliefs, so its figure is static: the Business
    Asset Disposal Relief limit, the threshold freeze (the basic rate band)
    and the State Pension allowance designs (taxable income; not the Pension
    Tax Allowance, a tax reduction). This is the static
    setting policyengine-uk's own parameter descriptions give: both
    elasticities 0, and gains qualifying for the relief on the main
    elasticity. 2.132.6 has no response by default, so nothing changes on
    it; from 2.134.0 the main elasticity defaults to 1, which would turn a
    static figure into a post-response one.

    The reform side is enough: the engine scales the reformed simulation's
    gains by its own elasticities, against current law's rates, and current
    law against itself has no rate change to respond to. It is a shared
    setting, so members of a combined run may each set it
    (``combine.SHARED_SETTINGS``).
    """
    changes = rate_change(
        f"{CAPITAL_GAINS_RESPONSES}.elasticity", _years_dict(0)
    )
    changes.update(
        rate_change(
            f"{CAPITAL_GAINS_RESPONSES}.mtr_elasticity", _years_dict(0)
        )
    )
    changes[f"{CAPITAL_GAINS_RESPONSES}.separate_badr_elasticity"] = (
        _years_dict(False)
    )
    return changes


# =============================================================================
# 1. FUEL DUTY: THE 5P CUT EXTENDED TO 1 JULY 2027
# =============================================================================

# Current law, by the date each rate takes effect: 52.95p to 31 December
# 2026, 55.95p from 1 January 2027, 57.95p from 1 March 2027 (as in
# policyengine-uk 2.151.0's petrol_and_diesel.yaml; HMRC's amended rates
# note, SI 2026/164 as amended by SI 2026/555), then 60.59p from 1 April
# 2027 (the OBR's July rate, EFO October 2026 paragraph 3.19, taken in
# April in current law; HMRC set no April rate) and RPI each April after,
# on the OBR October 2026 forecast, the same path the baseline is built on
# (uk_budget_data.forecast.fuel_duty_rpi_steps).
FUEL_DUTY_CURRENT_LAW = (
    ("2026-03-23", 0.5295),
    ("2027-01-01", 0.5595),
    FUEL_DUTY_STATUTORY,
    *fuel_duty_rpi_steps(),
)
# The pre-Budget candidate (27 October 2026), kept only for
# FUEL_DUTY_FROZEN_UNTIL = None: 52.95p frozen through 2027-28 (to 31 March
# 2028), RPI uprating resuming in April 2028 from 52.95p, each later rate
# current law's scaled by 52.95p over current law's April 2027 rate.
# Budget day replaced it with FUEL_DUTY_FROZEN_UNTIL below.
#
# Budget day: the two numbers to set from the Budget document.
# - FUEL_DUTY_FROZEN: the frozen rate, £ a litre. 0.5295 keeps the 5p cut
#   (52.95p); 0.5795 would let it lapse and freeze at 57.95p.
# - FUEL_DUTY_FROZEN_THROUGH: the last fiscal year the freeze covers (2027
#   = 2027-28, to 31 March 2028). RPI uprating resumes on 1 April of the
#   next year, from the frozen rate. Must be a year with an April step in
#   FUEL_DUTY_CURRENT_LAW (2027 to 2031).
# Changing either changes the pump VAT modifier's defaults too
# (budget_measures/pump_vat_on_fuel_duty_deferral.py):
# ``uv run python -c "from uk_budget_data.reforms import
# pump_vat_on_fuel_duty_deferral_defaults as d; print(d())"`` prints them,
# and tests/test_reforms.py fails until they are pasted in.
FUEL_DUTY_FROZEN = 0.5295
FUEL_DUTY_FROZEN_THROUGH = 2027
#
# Announced in the speech (28 October 2026, 12:54): "a further extension
# of the 5p fuel duty cut until next July". FUEL_DUTY_FROZEN_UNTIL, when
# set, is the first day back on current law: 52.95p to the day before,
# then current law's rate in force that day (60.59p: the 5p and the
# deferred RPI rise together, EFO October 2026 paragraph 3.19) and its RPI
# rises after.
# Budget 2026 document: "Extend the 5p fuel duty cut and freeze ... to
# 1 July 2027" (Table row 3: -575, -780, then 0), so "2027-07-01".
# None gives the 27 October candidate (FUEL_DUTY_FROZEN_THROUGH, with RPI
# resuming from 52.95p).
FUEL_DUTY_FROZEN_UNTIL = "2027-07-01"
FUEL_DUTY_STAGES = (("2026-03-23", FUEL_DUTY_FROZEN),)
FUEL_DUTY_RPI_FROM = f"{FUEL_DUTY_FROZEN_THROUGH + 1}-04-01"


def _fuel_duty_scale_base() -> float:
    """Current law's rate just before uprating resumes, which the frozen
    rate stands in for (60.59p, its April 2027 rate, for a freeze through
    2027-28); later rates are current law's scaled by frozen / this. Used
    only by the pre-Budget candidate (FUEL_DUTY_FROZEN_UNTIL = None)."""
    before = [
        rate for day, rate in FUEL_DUTY_CURRENT_LAW if day < FUEL_DUTY_RPI_FROM
    ]
    return before[-1]


def fuel_duty_deferral_schedule() -> tuple:
    """The candidate's rates by the date each takes effect."""
    if FUEL_DUTY_FROZEN_UNTIL is not None:
        before = [
            rate
            for day, rate in FUEL_DUTY_CURRENT_LAW
            if day <= FUEL_DUTY_FROZEN_UNTIL
        ]
        return (
            FUEL_DUTY_STAGES
            + ((FUEL_DUTY_FROZEN_UNTIL, before[-1]),)
            + tuple(
                (day, rate)
                for day, rate in FUEL_DUTY_CURRENT_LAW
                if day > FUEL_DUTY_FROZEN_UNTIL
            )
        )
    scale = FUEL_DUTY_FROZEN / _fuel_duty_scale_base()
    later = tuple(
        (day, round(rate * scale, 4))
        for day, rate in FUEL_DUTY_CURRENT_LAW
        if day >= FUEL_DUTY_RPI_FROM
    )
    return FUEL_DUTY_STAGES + later


def fiscal_year_means(schedule, years=DEFAULT_YEARS) -> dict[str, float]:
    """Day-weighted mean rate in each model year, 6 April to 5 April, as
    the engine blends the fuel duty parameter (``fiscal_year_blend``)."""
    steps = [(date.fromisoformat(day), rate) for day, rate in schedule]
    means = {}
    for year in years:
        start, end = date(year, 4, 6), date(year + 1, 4, 6)
        total = 0.0
        for k, (day, rate) in enumerate(steps):
            following = steps[k + 1][0] if k + 1 < len(steps) else end
            low, high = max(day, start), min(following, end)
            if high > low:
                total += (high - low).days * rate
        means[str(year)] = total / (end - start).days
    return means


def fuel_duty_deferral_rates() -> dict[str, float]:
    """The candidate's annual fuel duty rates, every policy year (the
    parameter is uprated, so a bounded change would return to the old
    path: policyengine-uk #2430). With FUEL_DUTY_FROZEN_UNTIL, only the
    years the extension touches: later years return to current law's own
    path, which is what the extension does."""
    rates = {
        year: round(rate, 6)
        for year, rate in fiscal_year_means(
            fuel_duty_deferral_schedule()
        ).items()
    }
    if FUEL_DUTY_FROZEN_UNTIL is not None:
        # After the extension, current law's own rates, written for every
        # scored year: the parameter is uprated, so a bounded change would
        # return to the old path (policyengine-uk #2430; scored_years).
        node = forecast_parameters().get_child(FUEL_DUTY)
        for y in list(rates):
            if int(y) not in fuel_duty_extension_years():
                rates[y] = node(f"{y}-04-30")
    return rates


def fuel_duty_extension_years() -> list[int]:
    """The fiscal years (from 6 April) the 5p cut's extension touches."""
    last = date.fromordinal(
        date.fromisoformat(FUEL_DUTY_FROZEN_UNTIL).toordinal() - 1
    )
    last_year = (
        last.year if (last.month, last.day) >= (4, 6) else last.year - 1
    )
    return [y for y in DEFAULT_YEARS if y <= last_year]


def pump_vat_on_fuel_duty_deferral_defaults() -> dict[str, float]:
    """The pump VAT modifier's defaults for the current freeze: for each
    fuel and year, 0.24 x the duty change / the engine's pump price (see
    the modifier's comment). Paste them into
    ``budget_measures/pump_vat_on_fuel_duty_deferral.py`` after changing
    the freeze."""
    prices = forecast_parameters().household.consumption.fuel.prices
    rates = fuel_duty_deferral_rates()
    current = fiscal_year_means(FUEL_DUTY_CURRENT_LAW)
    return {
        f"{fuel}_{year}": (
            0.24
            * (rates[str(year)] - current[str(year)])
            / getattr(prices, fuel)(f"{year}-04-30")
            if FUEL_DUTY_FROZEN_UNTIL is None
            or year in fuel_duty_extension_years()
            else 0.0
        )
        for year in POLICY_YEARS
        for fuel in ("petrol", "diesel")
    }


def _fiscal_year_label(year: int) -> str:
    return f"{year}-{(year + 1) % 100:02d}"


def _pence(rate: float) -> str:
    return f"{rate * 100:.2f}p"


def _fuel_duty_cut_extension_description() -> str:
    frozen = _pence(FUEL_DUTY_FROZEN)
    back = date.fromisoformat(FUEL_DUTY_FROZEN_UNTIL)
    last = date.fromordinal(back.toordinal() - 1)
    rate = dict(fuel_duty_deferral_schedule())[FUEL_DUTY_FROZEN_UNTIL]
    return (
        "The 5p cut in fuel duty is kept: the main rate stays at "
        f"{frozen} a litre to {last.day} {last:%B %Y}, so the rise due on "
        "1 January 2027 and the March and April 2027 steps do not happen. "
        f"From {back.day} {back:%B %Y} it returns to current law's "
        f"{_pence(rate)} a litre, rising with RPI each April. Rates are "
        "day-weighted to fiscal years, and the VAT on the lower pump "
        "price is included."
    )


def _fuel_duty_deferral_description() -> str:
    if FUEL_DUTY_FROZEN_UNTIL is not None:
        return _fuel_duty_cut_extension_description()
    frozen = _pence(FUEL_DUTY_FROZEN)
    through = FUEL_DUTY_FROZEN_THROUGH
    resume = through + 1
    if FUEL_DUTY_FROZEN == 0.5295:
        cut = "so the 5p cut continues"
    else:
        cut = "so the 5p cut ends"
    rises = "there is no March 2027 step and no April 2027 RPI rise"
    skipped = "the 5p and that year's RPI are"
    if through > 2027:
        rises += (
            ", nor the April 2028 RPI rise"
            if through == 2028
            else f", nor any April RPI rise from 2028 to {through}"
        )
        skipped = "the 5p and those years' RPI are"
    if FUEL_DUTY_FROZEN != 0.5295:
        skipped = skipped.replace("the 5p and ", "")
    # On main's values this is main's description, byte for byte.
    return (
        f"Candidate measure. Fuel duty stays at {frozen} a litre through "
        f"{_fiscal_year_label(through)} (to 31 March {resume}): the rise "
        f"due on 1 January 2027 does not happen, {cut}, and {rises}. RPI "
        f"uprating resumes in April {resume} from {frozen}, so {skipped} "
        "never made up. Rates are day-weighted to fiscal years. Includes "
        "the VAT on the lower pump price."
    )


def _create_fuel_duty_rise_deferral() -> Reform:
    return Reform(
        id=FUEL_DUTY_DEFERRAL_ID,
        name="Fuel duty cut extended",
        description=_fuel_duty_deferral_description(),
        parameter_changes=rate_change(FUEL_DUTY, fuel_duty_deferral_rates()),
        simulation_modifier=pump_vat_on_fuel_duty_deferral,
    )


# =============================================================================
# 2. PENSION TAX ALLOWANCE: AN INCOME TAX REDUCTION FOR PENSIONERS WHOSE
#    TOTAL INCOME IS AT MOST THE FULL NEW STATE PENSION
# =============================================================================


# The design: "total_income" follows the reporting of 27 October 2026
# (Telegraph: "officials have broadened it ... provided their total income
# stays below the threshold"; GB News): an allowance of the full new State
# Pension for people over State Pension age whose total income, State
# Pension included, is at or below it. It broadened the "sole_income"
# design of 26 October (BBC; The Times), for pensioners "wholly reliant on
# the state pension", which the same module gives with
# other_income_limit=0, total_income_at_most_allowance=False and
# disregard_savings_interest=True. "tapered", the design modelled before
# that, gives the allowance to everyone over State Pension age and
# withdraws it £1 for £1 of income above it.
#
# Budget day: two switches. The design here (``total_income``, or
# ``tapered``: everyone over State Pension age, withdrawn £1 for £1 above
# it), and the rounding of the threshold, ``ROUND_DOWN`` in
# budget_measures/state_pension_only_income_tax_allowance.py (up: £13,037
# in 2027-28; down: £13,036, as the Times reports). The description
# follows the rounding.
# Budget 2026 (6.182; costings p. 63; HM Treasury's explainer): the
# Pension Tax Allowance is a non-refundable tax reduction ("tax_reduction",
# budget_measures/pension_tax_allowance.py), not a higher allowance.
STATE_PENSION_PROTECTION_DESIGN = "tax_reduction"
_SP_ROUNDING = "down" if _sp_threshold.ROUND_DOWN else "up"
_SP_THRESHOLD_2027 = state_pension_only_income_tax_allowance.__defaults__[0]
# The allowance's last fiscal year (a default of the modifier): "in this
# Parliament", per the speech; the description names it only when it ends
# before 2031-32, the last scored year.
_SP_LAST_YEAR = state_pension_only_income_tax_allowance.__defaults__[-1]
_SP_UNTIL = (
    ""
    if _SP_LAST_YEAR >= POLICY_YEARS[-1]
    else f" The allowance applies to {_SP_LAST_YEAR}-"
    f"{(_SP_LAST_YEAR + 1) % 100:02d} and ends after it."
)
STATE_PENSION_PROTECTION_DESIGNS = {
    "tax_reduction": (
        pension_tax_allowance,
        "From 6 April 2027 to 5 April "
        "2030, people over State Pension age whose total "
        "income (the State Pension, with any increments or additional "
        "State Pension, plus all other income, savings interest included) "
        "is at or below the full new State Pension (£13,036.40 in 2027-28) "
        "get a Pension Tax Allowance: a non-refundable reduction in their "
        "income tax, worth up to £94 in 2027-28. It falls by £1 for every "
        "£3 of income above the full new State Pension, so it is gone at "
        "about £13,319 in 2027-28. The personal allowance is unchanged.",
    ),
    "total_income": (
        state_pension_only_income_tax_allowance,
        "From 6 April 2027, people over State Pension age whose total "
        "income (the State Pension, with any increments or additional "
        "State Pension, plus all other income, savings interest included) "
        "is at or below the full new State Pension get an income tax "
        "allowance of that amount; £1 of income above it takes the whole "
        "allowance away.",
    ),
    "tapered": (
        state_pension_income_tax_allowance,
        "From 6 April 2027, people over State Pension "
        "age get an income tax allowance equal to the full new State "
        "Pension (rounded up to £10: £13,040 in 2027-28), withdrawn £1 "
        "for £1 of income above it, down to the standard personal "
        "allowance. Someone whose only income is the full new State "
        "Pension pays no income tax.",
    ),
}


def _create_state_pension_income_tax_protection(
    design: str = None,
) -> Reform:
    design = design or STATE_PENSION_PROTECTION_DESIGN
    modifier, description = STATE_PENSION_PROTECTION_DESIGNS[design]
    return Reform(
        id=STATE_PENSION_ALLOWANCE_ID,
        name="Pension Tax Allowance",
        description=description,
        simulation_modifier=modifier,
        # The PTA ("tax_reduction") lowers the liability and leaves taxable
        # income, and so the capital gains rate, alone: no capital gains
        # pin, which would only add noise in the years it is not in force.
        # The allowance designs move taxable income, so they carry it.
        parameter_changes=(
            None if design == "tax_reduction" else static_capital_gains()
        ),
    )


# =============================================================================
# 3. WARM HOME DISCOUNT FROM £150 TO £250, WINTER 2026-27
# =============================================================================


def _create_warm_home_discount_top_up() -> Reform:
    return Reform(
        id=WARM_HOME_DISCOUNT_ID,
        name="Warm Home Discount top-up",
        description=(
            "Candidate measure. The Warm Home Discount rises from £150 to "
            "£250 for winter 2026-27 only: £100 more to each household in "
            "Great Britain receiving Universal Credit, Pension Credit, "
            "Housing Benefit or income-related ESA. Receipt follows DESNZ's "
            "rates: 85% of Pension Credit households and 70% of other "
            "eligible households. Eligibility follows England and Wales's "
            "2026-27 core group, so households in Scotland are approximate."
        ),
        simulation_modifier=warm_home_discount_top_up,
    )


# =============================================================================
# 4. ZERO VAT ON DOMESTIC ELECTRICITY, 1 OCTOBER 2026 TO 31 MARCH 2028
# =============================================================================


def _electricity_vat_description() -> str:
    end = date.fromisoformat(_electricity.ZERO_RATE_EXTENDED_TO)
    end_text = f"{end.day} {end:%B %Y}"
    days = (end - date(2027, 4, 1)).days + 1
    if _electricity.PRE_BUDGET_ZERO_RATE_IN_MEASURE:
        return (
            "VAT on domestic electricity is 0% instead of 5% from "
            f"1 October 2026 to {end_text}. It applies in Great Britain "
            "from October 2026 and across the UK from April 2027. It covers "
            "electricity only, not gas. Each year counts its share of a "
            "year's electricity use: about 57% in 2026-27 (October to "
            "March) and 22% in 2027-28 (April to June)."
        )
    return (
        "The zero rate of VAT on domestic electricity, "
        "in force from 1 October 2026 to 31 March 2027, is extended to "
        f"{end_text}: VAT is 0% instead of 5% from 1 April 2027 to "
        f"{end_text}. Applied to electricity spending only, in Great "
        "Britain (Northern Ireland keeps the 5%), weighted by its "
        f"{days} days of 2027-28's 366. The zero rate before April 2027 "
        "is in neither the model's baseline nor this measure."
    )


def _create_domestic_electricity_zero_vat() -> Reform:
    return Reform(
        id=ELECTRICITY_VAT_ID,
        name="Zero VAT on domestic electricity",
        description=_electricity_vat_description(),
        simulation_modifier=zero_vat_on_domestic_electricity,
    )


# =============================================================================
# 5. EMPLOYER NI RELIEF FOR UNDER-25S
# =============================================================================


def _create_employer_ni_relief_under_25s() -> Reform:
    return Reform(
        id=EMPLOYER_NI_ID,
        name="Employer NI relief for under-25s",
        description=(
            "Candidate measure. From 6 April 2027 employers pay no "
            "secondary Class 1 National Insurance on earnings up to the "
            "upper earnings limit (£50,270) for employees under 25, "
            "extending the under-21 relief to ages 21 to 24. Wages are held "
            "fixed, so it changes revenue, not household incomes. The data "
            "identify no apprentices, so the cost includes 21 to 24-year-old "
            "apprentices, whose employers already pay none in law."
        ),
        simulation_modifier=employer_ni_relief_ages_21_to_24,
    )


# =============================================================================
# 6. THRESHOLD FREEZE EXTENDED INTO 2031-32
# =============================================================================


def _create_threshold_freeze_2031_32() -> Reform:
    changes = threshold_change(PERSONAL_ALLOWANCE, {"2031": 12570})
    changes.update(threshold_change(BASIC_RATE_BAND, {"2031": 37700}))
    # The basic rate band sets which gains pay the lower capital gains rate.
    changes.update(static_capital_gains())
    return Reform(
        id=THRESHOLD_FREEZE_ID,
        name="Threshold freeze to 2031-32",
        description=(
            "Candidate measure. The income tax personal allowance stays at "
            "£12,570 and the basic rate band at £37,700 (a higher rate "
            "threshold of £50,270) for one more year, 2031-32, instead of "
            "rising with inflation to £12,830 and £38,500. From 2031-32 "
            "policyengine-uk sets the National Insurance primary threshold "
            "and upper earnings limit at the personal allowance and higher "
            "rate threshold, so they stay at £12,570 and £50,270 too; the "
            "employer secondary threshold is not held."
        ),
        parameter_changes=changes,
    )


# =============================================================================
# 7. BUSINESS ASSET DISPOSAL RELIEF RESTRICTED
# =============================================================================


def _create_badr_lifetime_limit_cut() -> Reform:
    return Reform(
        id=BADR_ID,
        name="Business Asset Disposal Relief restricted",
        description=(
            "Candidate measure. From 6 April 2027 the lifetime limit on "
            "gains qualifying for Business Asset Disposal Relief falls from "
            "£1 million to £500,000; the relief rate stays at 18%. Gains "
            "above the limit pay the main capital gains tax rates. The "
            "model applies the limit to each year's gains. Capital gains "
            "are imputed and calibrated to 2024-25, when disposals were "
            "unusually high ahead of the April 2025 rise in the relief's "
            "rate, so the relief's base, and the revenue from restricting "
            "it, are likely 1.5 to 1.7 times too high."
        ),
        parameter_changes={
            **threshold_change(
                BADR_LIFETIME_LIMIT, _years_from(2027, 500_000)
            ),
            **static_capital_gains(),
        },
    )


# =============================================================================
# 8. TEMPORARY VAT CUT ON ROAD FUEL
# =============================================================================


def _create_road_fuel_vat_cut() -> Reform:
    return Reform(
        id=FUEL_VAT_ID,
        name="VAT cut on road fuel",
        description=(
            "Candidate measure. VAT on petrol and diesel falls from 20% to "
            "15% from 1 December 2026 to 31 May 2027, fully passed through "
            "to pump prices; spending on fuel is held fixed. Day-weighted "
            "to fiscal years."
        ),
        simulation_modifier=road_fuel_vat_cut,
    )


# =============================================================================
# 9. PLAN 2 STUDENT LOAN REPAYMENT THRESHOLD UNFROZEN
# =============================================================================

# The Plan 2 threshold in 2026-27, before the Budget 2025 freeze.
PLAN_2_THRESHOLD_2026 = 29385


def plan_2_unfrozen_thresholds() -> dict[str, float]:
    """The Plan 2 threshold uprated by RPI each April from 2027, as the
    law did before the Budget 2025 freeze (2027-28 to 2029-30), with the
    engine's RPI index; every policy year from 2027, since the parameter is
    uprated (policyengine-uk #2430)."""
    rpi = forecast_parameters().gov.economic_assumptions.indices.obr.rpi
    base = rpi("2026-04-06")
    return {
        str(year): round(PLAN_2_THRESHOLD_2026 * rpi(f"{year}-04-06") / base)
        for year in POLICY_YEARS
        if year >= 2027
    }


def _create_plan_2_threshold_unfreeze() -> Reform:
    return Reform(
        id=PLAN_2_ID,
        name="Plan 2 student loan threshold unfrozen",
        description=(
            "Candidate measure. The Plan 2 student loan repayment threshold "
            "rises with RPI from April 2027 (to £30,648 in 2027-28), reversing "
            "the freeze at £29,385 to April 2030. Repayments are modelled, "
            "replacing those reported in the survey, and the revenue figure "
            "is the change in modelled repayments."
        ),
        parameter_changes=threshold_change(
            PLAN_2_THRESHOLD, plan_2_unfrozen_thresholds()
        ),
        simulation_modifier=connect_student_loan_repayments,
        baseline_simulation_modifier=connect_student_loan_repayments,
    )


# =============================================================================
# CARER'S ALLOWANCE EARNINGS TAPER
# =============================================================================


# Announced in written statement HCWS421 (27 October 2026): "earnings above
# the Weekly Earnings Limit will be subject to a 100% taper, where support
# is only reduced by £1 for each £1 increase in earnings", beginning
# "within 2030-31 once the Department for Work and Pensions have developed
# a new IT system". The limit is 16 hours at the National Living Wage, £204
# a week in 2026-27.
#
# Budget day, from the Budget document (6.13, 6.128) and the policy
# costings (p. 16); each is a default argument of
# budget_measures/carers_allowance_earnings_taper.py, and changing one
# changes the module's receipt, so it needs a fresh two-person attestation:
# - start: ``start_year=2030`` with ``first_year_share=0.5``, half of
#   2030-31's effect, as the start date "within the 2030-31 financial year"
#   is still to be confirmed.
# - limit: 16 hours at the National Living Wage, rounded up to the pound:
#   the OBR's wage for each April (EFO October 2026, Table 1.13), £212 at
#   April 2027's £13.21, £228 in 2030-31 and £234 in 2031-32.
# - rate: ``taper_rate=1.0`` (100%).
# - Registered and in the package (AUTUMN_BUDGET_2026_COMBINED_COMPONENTS).
def _create_carers_allowance_earnings_taper() -> Reform:
    return Reform(
        id=CARERS_ALLOWANCE_TAPER_ID,
        name="Carer's Allowance earnings taper",
        description=(
            "In England and Wales, Carer's Allowance no longer stops when "
            "weekly net earnings pass the Weekly Earnings Limit, 16 hours at "
            "the National Living Wage (£212 a week at April 2027's £13.21, "
            "rounded up to the pound): it is "
            "reduced by £1 for each £1 of earnings above the limit, a 100% "
            "taper, to nothing once earnings exceed the limit by the full "
            "weekly rate. The taper starts within 2030-31, on a date still to "
            "come, so the model counts half of that year. "
            "Carers at or below the limit, and "
            "Scotland's Carer Support Payment, are unchanged. Claims by "
            "carers "
            "the limit kept out follow the data's take-up draw (60%). For "
            "a carer on Universal Credit the model counts the extra "
            "allowance in full as unearned income but deducts none of the "
            "PAYE on it from earnings, as DWP would, so such a carer can "
            "lose overall."
        ),
        simulation_modifier=carers_allowance_earnings_taper,
    )


# =============================================================================
# LOCAL HOUSING ALLOWANCE UNFROZEN FROM APRIL 2027
# =============================================================================


def _create_lha_unfreeze_2027() -> Reform:
    # The freeze is a switch, which the templates' numeric values refuse,
    # so the change is written directly, as static_capital_gains writes
    # its switch. Every policy year from 2027: a bounded change would
    # return to the freeze, holding the rates at their 2027 level.
    return Reform(
        id=LHA_UNFREEZE_ID,
        name="Local Housing Allowance unfrozen",
        description=(
            "Candidate measure. From April 2027 Local Housing Allowance "
            "rates are no longer frozen at their April 2024 level: each "
            "April they are re-set to the 30th percentile "
            "of local rents, as policyengine-uk determines them from its "
            "projected rents, with the national maximum and the March 2020 "
            "minimum. It raises Universal Credit's housing element and "
            "Housing Benefit for private renters whose rent is above the "
            "frozen rate. Northern Ireland's rates, which follow Great "
            "Britain's, are unfrozen too."
        ),
        parameter_changes={
            LHA_FREEZE: _years_from(2027, False),
            LHA_FREEZE_NI: _years_from(2027, False),
        },
    )


# =============================================================================
# EMPLOYER NI SECONDARY THRESHOLD BACK TO £9,100 FROM APRIL 2027
# =============================================================================

# Current law: £5,000 a year (stored weekly, £96.15) from April 2025, held
# to 2030-31 and then raised by CPI each year by the engine. The candidate:
# £9,100 a year (£175 a week, its 2022-23 to 2024-25 value) from 6 April
# 2027, and from 2031-32 current law's CPI rise applied to it (the engine
# indexes the threshold from its own previous amount; every scored year is
# written, as scored_years asks of a projected threshold).
SECONDARY_THRESHOLD_RAISED = 9100
SECONDARY_THRESHOLD_FROM = 2027


def secondary_threshold_raised() -> dict[str, float]:
    """The weekly secondary threshold, every policy year from 2027."""
    node = forecast_parameters().get_child(SECONDARY_THRESHOLD)
    weekly = SECONDARY_THRESHOLD_RAISED / 52
    values = {}
    for year in POLICY_YEARS:
        if year < SECONDARY_THRESHOLD_FROM:
            continue
        if year > SECONDARY_THRESHOLD_FROM:
            weekly *= node(f"{year}-04-06") / node(f"{year - 1}-04-06")
        values[str(year)] = round(weekly, 8)
    return values


def _create_employer_nics_secondary_threshold_raise() -> Reform:
    return Reform(
        id=EMPLOYER_NI_THRESHOLD_ID,
        name="Employer NI threshold raised",
        description=(
            "Candidate measure. From 6 April 2027 the threshold above which "
            "employers pay Class 1 National Insurance goes back from £5,000 "
            "to £9,100 a year (£175 a week), rising with CPI from 2031-32 "
            "as current law's does; the 15% rate is unchanged. "
            "policyengine-uk holds each employer's total cost of employment "
            "fixed, so the saving is passed to employees as higher pay in "
            "the same year."
        ),
        parameter_changes=threshold_change(
            SECONDARY_THRESHOLD, secondary_threshold_raised()
        ),
    )


# =============================================================================
# PROPERTY AND SAVINGS INCOME TAX RATES UP 2 POINTS FROM APRIL 2027
# =============================================================================

UNEARNED_INCOME_RATE_RISE = 0.02
UNEARNED_INCOME_RATES_FROM = 2027


def _rates_up(paths) -> dict[str, dict[str, float]]:
    """Current law's rate plus 2 points at each path, every policy year
    from 2027."""
    changes = {}
    for path in paths:
        node = forecast_parameters().get_child(path)
        changes.update(
            rate_change(
                path,
                {
                    str(year): round(
                        node(f"{year}-04-06") + UNEARNED_INCOME_RATE_RISE, 6
                    )
                    for year in POLICY_YEARS
                    if year >= UNEARNED_INCOME_RATES_FROM
                },
            )
        )
    return changes


def property_income_rates_up() -> dict[str, dict[str, float]]:
    """The property basic, higher and additional rates, 2 points up."""
    return _rates_up(PROPERTY_INCOME_RATE_PATHS)


def savings_income_rates_up() -> dict[str, dict[str, float]]:
    """The savings basic, higher and additional rates, 2 points up."""
    return _rates_up(SAVINGS_INCOME_RATE_PATHS)


def unearned_income_rates_up() -> dict[str, dict[str, float]]:
    """Both: the withdrawn single measure's changes."""
    return _rates_up(UNEARNED_INCOME_RATE_PATHS)


def _create_property_income_rates_up() -> Reform:
    # Table 6.1 row 61. The engine's property rates do not apply to
    # Scottish taxpayers, whose property income is taxed at Scottish rates;
    # finance cost relief follows the property basic rate UK-wide (ITTOIA
    # 2005 s. 274AA(5) as amended by FA 2026), so Scottish landlords' relief
    # rises too (Max, #290, 28 October 2026).
    return Reform(
        id=PROPERTY_INCOME_RATES_ID,
        name="Property income tax rates up",
        description=(
            "From 6 April 2027 the income tax rates on property income rise "
            "to 24%, 44% and 49% at the basic, higher and additional rates "
            "in England, Wales and Northern Ireland: 2 percentage points "
            "above current law, which already includes Budget 2025's rises. "
            "Finance cost relief for landlords follows the property basic "
            "rate, so rises to 24%, Scottish landlords' included. Incomes "
            "are held fixed, with no behavioural response."
        ),
        parameter_changes=property_income_rates_up(),
    )


def _create_savings_income_rates_up() -> Reform:
    # Table 6.1 row 62.
    return Reform(
        id=SAVINGS_INCOME_RATES_ID,
        name="Savings income tax rates up",
        description=(
            "From 6 April 2027 the income tax rates on savings income rise "
            "to 24%, 44% and 49% at the basic, higher and additional rates "
            "across the UK: 2 percentage points above current law, which "
            "already includes Budget 2025's rises. Dividend rates are "
            "unchanged. Incomes are held fixed, with no behavioural response."
        ),
        parameter_changes=savings_income_rates_up(),
    )


def _create_unearned_income_rates_up() -> Reform:
    # Withdrawn on Budget day, 28 October 2026: split into the property and
    # savings measures above, one per Table 6.1 row. Unregistered.
    return Reform(
        id=UNEARNED_INCOME_RATES_ID,
        name="Savings and property income tax rates up",
        description=(
            "From 6 April 2027 the income tax rates on savings income rise "
            "to 24%, 44% and 49% at the basic, higher and additional rates "
            "across the UK, and those on property income to the same rates "
            "in England, Wales and Northern Ireland: 2 percentage points "
            "above current law, which already includes Budget 2025's rises. "
            "Finance cost relief for landlords follows the property basic "
            "rate, so rises to 24%. Dividend rates are unchanged. Incomes "
            "are held fixed, with no behavioural response."
        ),
        parameter_changes=unearned_income_rates_up(),
    )


# =============================================================================
# HOUSEHOLD ENERGY PAYMENT: £100, BANDS A TO D, ENGLAND, WINTER 2026-27
# =============================================================================

# Announced in the speech (28 October 2026, 12:53). Budget day, from the
# documents (each a default of the hand-written modifier in
# budget_measures/household_energy_payment_2026.py; changing one needs a
# fresh attestation): amount=100, year=2026 (winter 2026-27),
# country="ENGLAND" (devolved governments get a Barnett share instead; "UK"
# pays every country), bands=("A", "B", "C", "D"). In the package
# (AUTUMN_BUDGET_2026_COMBINED_COMPONENTS).


def _create_household_energy_payment_2026() -> Reform:
    return Reform(
        id=HOUSEHOLD_ENERGY_PAYMENT_ID,
        name="Household Energy Payment",
        description=(
            "A one-off £100 payment from January 2027 to each household in "
            "England in property valuation bands A to D (the lowest four of "
            "England's eight), up to 20 million households, paid into bank "
            "accounts and counted as household income in 2026-27. Scotland, "
            "Wales and Northern Ireland receive a share of the funding "
            "instead, which is not modelled."
        ),
        simulation_modifier=household_energy_payment_2026,
    )


# =============================================================================
# TRADING ALLOWANCE FROM £1,000 TO £3,000
# =============================================================================

# Budget 2026 (6.254; policy costings p. 23; Table 6.1 row 15): the
# trading allowance rises from £1,000 to £3,000 from 6 April 2027
# (TRADING_ALLOWANCE_RAISED, TRADING_ALLOWANCE_FROM), with no new-venture
# limit. The parameter is not uprated, so writing every year from the
# first is the whole change. The property allowance (£1,000) is unchanged.
TRADING_ALLOWANCE_RAISED = 3_000
TRADING_ALLOWANCE_FROM = 2027


def _create_trading_allowance_raise() -> Reform:
    return Reform(
        id=TRADING_ALLOWANCE_ID,
        name="Trading allowance raised to £3,000",
        description=(
            f"From 6 April {TRADING_ALLOWANCE_FROM} the "
            "trading allowance, which relieves trading receipts in place "
            "of actual expenses, rises from £1,000 to "
            f"£{TRADING_ALLOWANCE_RAISED:,}, for income tax and Class 4 "
            "National Insurance. Without gross receipts in the data, the "
            "model relieves a profit up to £3,000 in full and gives no "
            "relief above it, so the cost may be overstated for some people "
            "and understated for others."
        ),
        parameter_changes=threshold_change(
            TRADING_ALLOWANCE,
            _years_from(TRADING_ALLOWANCE_FROM, TRADING_ALLOWANCE_RAISED),
        ),
    )


# =============================================================================
# SINGLE BUS FARES CAPPED AT £2 OUTSIDE LONDON, CALENDAR 2027
# =============================================================================

# Budget 2026 (Table 6.1, "Single bus fares capped at £2 outside London"):
# a £2 maximum single fare on participating services in England outside
# London from 1 January to 31 December 2027, where most are capped at £3
# until then. Left out on Budget day only because runs were in flight
# (María, 29 October 2026); registered and in the package since. Vahid,
# 29 October 2026 (issue #329, option 3): the Treasury's costing (Table
# 6.1) shared out across households by their bus fare spending in England
# outside London, not our own estimate of the national cost: 10.0% of
# spending at £3 fares while the cap runs (£230m / 0.9 operator
# participation / £2,557m), grossed up from current law's spending at £2.
# It reads no gov.dft.bus parameter, so it does not reach the data limit
# bus_uncapped_single_fares. Defaults of the hand-written modifier in
# budget_measures/bus_fare_cap_2027.py: fall=0.10, capped_2026=95/365,
# capped_2027=270/366, country="ENGLAND", excluded_region="LONDON".


def _create_bus_fare_cap_2027() -> Reform:
    return Reform(
        id=BUS_FARE_CAP_ID,
        name="Single bus fares capped at £2",
        description=(
            "Single bus fares on participating services in England outside "
            "London are capped at £2 instead of £3 from 1 January to "
            "31 December 2027. The saving is the Treasury's costing "
            "(Table 6.1) shared out across households by their bus fare "
            "spending in England outside London: 10.0% of what that "
            "spending would be at £3 fares (£230m, divided by 0.9 for "
            "operator participation, over £2,557m of spending), for the "
            "days the cap runs: 1 January to 5 April 2027 in 2026-27 and "
            "6 April to 31 December 2027 in 2027-28. London residents get "
            "£0. The saving is counted as household income, a "
            "methodological choice: the official cost is a grant to bus "
            "operators. Spending is held fixed, with no extra travel."
        ),
        simulation_modifier=bus_fare_cap_2027,
    )


# =============================================================================
# CASH ISA LIMIT KEPT AT £20,000 (Household calculator only)
# =============================================================================


# Budget 2026 (2.52, 6.248; Table 6.1 row 11): the cut in the cash ISA limit
# to £12,000 a year for under-65s from 6 April 2027 (SI 2026/1018 reg 6)
# does not go ahead. policyengine-uk 2.151.0 has no ISA limits, so current
# law is the Budget's and the pre-Budget side carries the cut
# (budget_measures/planned_cash_isa_limit.py; its numbers are default
# arguments there). Its effect rests on what a household pays into cash
# ISAs, which the survey data do not hold (PolicyEngine/microcosm#1415), so
# it is registered for the Household calculator only: listed, not in the
# package, and never in the national results (calculatorOnlyMeasures.js).
def _create_cash_isa_limit_kept() -> Reform:
    return Reform(
        id=CASH_ISA_LIMIT_ID,
        name="Cash ISA limit kept at £20,000 for under-65s",
        description=(
            "The cut in the cash ISA limit to £12,000 a year for savers "
            "under 65, planned from 6 April 2027, does not go ahead: they "
            "can still pay up to £20,000 a year into cash ISAs. The "
            "household's gain is the income tax it would have paid on the "
            "interest from what the planned limit left out: the same "
            "payments each year from April 2027, the excess held in a "
            "taxable account earning Bank Rate as the OBR forecasts it, the "
            "interest paid out each year. For one household at a time: the "
            "survey data hold no payments into ISAs, so there is no "
            "national figure."
        ),
        baseline_simulation_modifier=planned_cash_isa_limit,
    )


# =============================================================================
# MACHINE GAMES DUTY UP FROM 20% TO 25% ON HIGHER-STAKE MACHINES
# =============================================================================

# Budget 2026 (2.49, 6.225; Table 6.1 row 56; policy costings p. 67): the
# Machine Games Duty rate on machines with a maximum stake above £1 or a
# maximum prize above £100 rises from 20% to 25% from 1 April 2027; lower
# stake machines stay at 20%. Row 56 also carries moving the liability to
# machine suppliers from 1 April 2028 (+£20m, +£15m, +£15m, +£10m), which
# changes who pays, not the rate, and is not modelled.
#
# policyengine-uk 2.151.0 and 2.164.2 split takings only by the duty's
# existing bands (lower 5%, standard 20%, higher 25%), with no input for
# the higher-stake part of the standard band (policyengine-uk#2731 adds
# one in 2.167.0). So the measure raises the standard rate, from 2027-28:
# - In the Household calculator this is exact: the form asks only for
#   losses on higher-stake machines and sets them as the household's
#   standard-rate takings.
# - On survey data it reaches every standard-rate machine, pubs' Category C
#   and D machines too, so it is an upper bound on the static cost (about
#   1 / 0.757 of it on the Gambling Commission's Category B share; María,
#   policyengine.py#731, 2 November 2026). Held back from the national
#   results (calculatorOnlyMeasures.js) until the engine and the data carry
#   the split. The certified data the dashboard runs on today hold no
#   gambling takings at all (data limit machine_games_standard_rate).
# Annual keys: the engine applies the change from 6 April 2027, so
# 2026-27, which the Treasury also scores at £0, has none of it.
MACHINE_GAMES_DUTY_FROM = 2027
MACHINE_GAMES_DUTY_HIGHER_STAKE_RATE = 0.25


def _create_machine_games_duty_rise() -> Reform:
    return Reform(
        id=MACHINE_GAMES_DUTY_ID,
        name="Machine Games Duty up to 25% on higher-stake machines",
        description=(
            "The Machine Games Duty rate on gaming machines with a stake "
            "over £1 or a prize over £100 rises from 20% to 25% of net "
            "takings from 1 April 2027; lower-stake machines stay at 20%. "
            "The duty is counted against the households whose gambling "
            "losses make up the takings, with no change in play. The model "
            "has no separate input for higher-stake machines, so the "
            "change raises its standard rate: exact for one household, "
            "whose losses on higher-stake machines the form asks for, but "
            "on survey data it also reaches lower-stake machines, so there "
            "is no national figure yet."
        ),
        parameter_changes=rate_change(
            MACHINE_GAMES_STANDARD_RATE,
            _years_from(
                MACHINE_GAMES_DUTY_FROM, MACHINE_GAMES_DUTY_HIGHER_STAKE_RATE
            ),
        ),
    )


# =============================================================================
# STATE PENSION DOUBLE LOCK FROM APRIL 2030 (not registered)
# =============================================================================

# Reported (BBC live, 11:53 on 28 October 2026): the Prime Minister's plan
# of 29 September to drop the triple lock's earnings leg from April 2030,
# so the State Pension rises by at least CPI or 2.5%. policyengine-uk
# 2.151.0 builds the April uprating from these switches when they arrive
# through Scenario(parameter_changes=...), as Reform.to_scenario sends
# them, and it reads a bare-year key as that April's uprating. Both the
# new and the basic State Pension follow its triple lock; the Pension
# Credit guarantee and the additional State Pension do not.
#
# Budget day:
# - DOUBLE_LOCK_FROM: the first April without the earnings leg.
# - DOUBLE_LOCK_EARNINGS_PATH: True is the reading in Vahid's
#   PolicyEngine/uk-triple-lock ("burnham_2030": never below an earnings
#   link from the 2029-30 level, as the speech's "hold its value relative
#   to earnings over time"); False is plain max(CPI, 2.5%).
# On the OBR October 2026 forecast the dashboard runs on
# (uk_budget_data.forecast), neither reading changes anything to 2031-32:
# the inputs for April 2030 (May-July 2029 earnings 2.28%, September 2029
# CPI 2.15%) and April 2031 (2.49%, 2.00%) are both under 2.5%, so the
# floor sets both upratings either way (full new State Pension £265.72 ->
# £272.36 -> £279.17 a week, with or without the switches). The OBR says
# the same: "an uprating of 2.5 per cent would apply under both the
# previous and adjusted version of the triple lock in both 2030-31 and
# 2031-32" (EFO October 2026, paragraph 3.50, footnote 17; Table A.3
# triple-lock guarantee 2.5, 2.5). Generation would refuse a measure that
# scores nothing; keep it on the ledger unless the forecast changes.
TRIPLE_LOCK_INCLUDE_EARNINGS = (
    "gov.dwp.state_pension.triple_lock.include_earnings"
)
TRIPLE_LOCK_EARNINGS_PATH = (
    "gov.dwp.state_pension.triple_lock.earnings_path_guarantee"
)
DOUBLE_LOCK_FROM = 2030
DOUBLE_LOCK_EARNINGS_PATH = True


def _create_state_pension_double_lock_2030() -> Reform:
    # Switches, which the templates' numeric values refuse, so written
    # directly as the LHA unfreeze writes its switch.
    return Reform(
        id=STATE_PENSION_DOUBLE_LOCK_ID,
        name="State Pension double lock from 2030",
        description=(
            "Candidate measure. From April "
            f"{DOUBLE_LOCK_FROM} the new and basic State Pension rise each "
            "April by the higher of September CPI and 2.5%, no longer by "
            "earnings growth when that is higher"
            + (
                ", but never fall below an earnings link from their "
                f"{DOUBLE_LOCK_FROM - 1}-{DOUBLE_LOCK_FROM % 100:02d} level"
                if DOUBLE_LOCK_EARNINGS_PATH
                else ""
            )
            + ". The additional State Pension and Pension Credit are "
            "unchanged."
        ),
        parameter_changes={
            TRIPLE_LOCK_INCLUDE_EARNINGS: _years_from(DOUBLE_LOCK_FROM, False),
            TRIPLE_LOCK_EARNINGS_PATH: _years_from(
                DOUBLE_LOCK_FROM, DOUBLE_LOCK_EARNINGS_PATH
            ),
        },
    )


# =============================================================================
# MILBURN REVIEW CANDIDATE MEASURES (THE ACTIVE REGISTRY)
# =============================================================================
#
# Candidate measures for the independent review of young people and work
# (the Milburn review; final report expected 17 November 2026). None is
# announced policy. Each is compared against current law in the installed
# policyengine-uk (2.177.7 on Microcosm build fcfac709: see
# ``uk_budget_data.local_build``), from 2027-28 through the last policy year.
# The Autumn Budget 2026 measures above are retired: their factories stay,
# unregistered, for the modules and tests that still read them.

# The 15 November designs' start year, age bands and rates live in
# ``budget_measures/milburn_design.py`` (first group, not to be edited); the
# text below is written from them. The report's design is the REPORT_*
# group there, read by the reserved ``milburn_report_*`` ids further down.
MILBURN_FIRST_YEAR = milburn_design.START_YEAR
_FROM = milburn_design.start_text()  # "From April 2027"
_UC_AGE = milburn_design.UC_HEALTH_UPPER_AGE  # 25
_UNDER = milburn_design.under_text()  # "under-25s"
_PIP_BAND = milburn_design.age_band_text()  # "18 to 24"
_PIP_PEOPLE = milburn_design.age_band_people_text()  # "18 to 24-year-olds"
# How each 15 November run stands against the final report (17 November
# 2026): what the report proposes in its place.
YOUTH_ALLOWANCE_BRIEFING_NOTE = (
    "The report proposes a Youth Allowance at the under-25 rate, higher "
    "only for those living independently; this run shows the higher rate "
    "for every under-25."
)
EMPLOYER_NICS_BRIEFING_NOTE = (
    "The report considers this option and does not propose it (paragraph "
    "268); it proposes a higher threshold for 21 to 24-year-olds in retail "
    "and hospitality instead."
)
SEVERE_KEPT_BRIEFING_NOTE = (
    "The points stand in for the report's Severe and Complex Needs "
    "Insurance, for which the report gives no eligibility test."
)
UC_HEALTH_UNDER_25_ID = "uc_health_element_removed_under_25"
UC_HEALTH_UNDER_25_NEW_CLAIMS_ID = (
    "uc_health_element_removed_under_25_new_claims"
)
PIP_UNDER_25_ID = "pip_removed_under_25"
YOUTH_ALLOWANCE_ID = "youth_allowance_at_25_plus_rate"
EMPLOYER_NICS_UNDER_25_ID = "employer_nics_zero_under_25"
MILBURN_PACKAGE_ID = "milburn_package"

UC_STANDARD_ALLOWANCE = "gov.dwp.universal_credit.standard_allowance.amount"
# The age below which an earner is in the under-21 group, whose employer
# (secondary) Class 1 contributions are zero-rated up to the upper secondary
# threshold (SSCBA 1992 s.9A; policyengine-uk's secondary_class_1_threshold).
EMPLOYER_NI_ZERO_RATE_AGE = (
    "gov.hmrc.national_insurance.class_1.secondary_zero_rate_age_limits."
    "under_21_group"
)


def _milburn_years() -> list[int]:
    return [y for y in POLICY_YEARS if y >= MILBURN_FIRST_YEAR]


def youth_allowance_rates(monthly=None) -> dict[str, dict[str, float]]:
    """The under-25 standard allowances set to the 25-and-over amounts in
    each year from 2027-28, read from current law on the forecast (monthly
    amounts, as the parameter holds them). Every year is given: the amounts
    are uprated, so a bounded change would return to the old path
    (policyengine-uk #2430).

    ``monthly`` sets given amounts instead, as ``{year: (single under 25,
    couple both under 25)}`` for every year changed
    (``milburn_design.REPORT_YOUTH_ALLOWANCE_MONTHLY``)."""
    if monthly is not None:
        changes = {}
        for index, young in enumerate(("SINGLE_YOUNG", "COUPLE_YOUNG")):
            changes.update(
                threshold_change(
                    f"{UC_STANDARD_ALLOWANCE}.{young}",
                    {
                        str(y): float(monthly[y][index])
                        for y in sorted(monthly)
                    },
                )
            )
        return changes
    amounts = forecast_parameters().get_child(UC_STANDARD_ALLOWANCE)
    changes = {}
    for young, old in (
        ("SINGLE_YOUNG", "SINGLE_OLD"),
        ("COUPLE_YOUNG", "COUPLE_OLD"),
    ):
        changes.update(
            threshold_change(
                f"{UC_STANDARD_ALLOWANCE}.{young}",
                {
                    str(y): amounts.children[old](f"{y}-04-30")
                    for y in _milburn_years()
                },
            )
        )
    return changes


def current_law_protected_health_element() -> dict[str, float]:
    """Current law's protected LCWRA amount (monthly) in each year the
    Universal Credit Act 2025 s. 4 floor sets it (2027-28 to 2029-30), as
    the engine computes it on the forecast.

    The floor pairs the protected amount with every standard allowance
    amount, the under-25 ones included, and in 2027-28 the under-25 single
    allowance is the one that binds. Raising the under-25 allowances
    would therefore lower the floor and cut every protected claimant's
    element (by about £0.70 a month in 2027-28), which is not part of the
    youth allowance measure; it holds the protected amount at current
    law's instead. From 2030-31 the amount is the year before's uprated,
    so it follows."""
    from policyengine_uk import Simulation
    from policyengine_uk.scenarios import uc_reform

    from uk_budget_data.forecast import forecast_scenario

    situation = {
        "people": {"p": {}},
        "benunits": {"b": {"members": ["p"]}},
        "households": {"h": {"members": ["p"]}},
    }
    sim = Simulation(situation=situation, scenario=forecast_scenario())
    return {
        str(y): round(
            uc_reform._protected_existing_health_element_monthly(sim, y), 6
        )
        for y in range(MILBURN_FIRST_YEAR, uc_reform.SECTION_4_LAST_YEAR + 1)
    }


def _create_uc_health_element_removed_under_25() -> Reform:
    return Reform(
        id=UC_HEALTH_UNDER_25_ID,
        name=f"UC health element removed for {_UNDER}",
        description=(
            f"{_FROM} Universal Credit awards no longer include the "
            "health (LCWRA) element where the claimant with limited "
            f"capability for work and work-related activity is under {_UC_AGE}, for "
            "existing and new claimants alike; an award keeps it where a "
            f"joint claimant aged {_UC_AGE} or over has that capability. The "
            "assessment itself is unchanged, so the work allowance still "
            "applies, but an award without the element loses the benefit "
            "cap exception that rests on it."
        ),
        simulation_modifier=uc_health_element_removed_under_25,
    )


def _create_uc_health_element_removed_under_25_new_claims() -> Reform:
    return Reform(
        id=UC_HEALTH_UNDER_25_NEW_CLAIMS_ID,
        name=f"UC health element removed for under-{_UC_AGE} new claims",
        description=(
            f"{_FROM} Universal Credit awards paid the health "
            "element at the new-claimant rate (claims from April 2026) no "
            "longer include it where the claimant with limited capability "
            f"for work and work-related activity is under {_UC_AGE}; protected "
            "claimants keep it. The data hold no claim dates: the model "
            "assigns the new-claimant rate by a random draw at the expected "
            "share of claims, regardless of age, so the figure rests on "
            "that assumption."
        ),
        simulation_modifier=uc_health_element_removed_under_25_new_claims,
    )


def _create_pip_removed_under_25() -> Reform:
    return Reform(
        id=PIP_UNDER_25_ID,
        name=f"PIP removed for {_PIP_PEOPLE}",
        description=(
            f"{_FROM} people aged {_PIP_BAND} receive neither component "
            "of Personal Independence Payment; 16 and 17-year-olds keep it "
            "and Disability Living Allowance for children is unchanged. "
            "Universal Credit amounts that depend on receiving PIP go with "
            "it; Carer's Allowance is not linked to PIP in the model and "
            "does not change. Scottish recipients of Adult Disability "
            "Payment, which the data record as PIP, are included."
        ),
        simulation_modifier=pip_removed_ages_18_to_24,
    )


def _create_youth_allowance_at_25_plus_rate() -> Reform:
    return Reform(
        id=YOUTH_ALLOWANCE_ID,
        name="Under-25 UC standard allowance at the 25-and-over rate",
        description=(
            f"{_FROM} single Universal Credit claimants under 25 "
            "receive the standard allowance for those aged 25 and over, and "
            "couples in which both are under 25 receive the couple rate for "
            "those aged 25 and over. The protected health element is held at "
            "its current-law amount, which the law otherwise links to the "
            "under-25 allowances. " + YOUTH_ALLOWANCE_BRIEFING_NOTE
        ),
        parameter_changes={
            **youth_allowance_rates(),
            **uc_health_element_change(
                protected=current_law_protected_health_element()
            ),
        },
    )


def _create_employer_nics_zero_under_25() -> Reform:
    return Reform(
        id=EMPLOYER_NICS_UNDER_25_ID,
        name="Employer NICs zero rate extended to under-25s",
        description=(
            f"{_FROM} employers pay no Class 1 National Insurance on "
            "earnings up to the upper secondary threshold (£50,270 a year) "
            "for employees under 25, extending the zero rate for under-21s. "
            "The model passes employers' National Insurance through to "
            "wages, so the saving shows as higher pay for these employees. "
            + EMPLOYER_NICS_BRIEFING_NOTE
        ),
        parameter_changes=threshold_change(
            EMPLOYER_NI_ZERO_RATE_AGE,
            {str(y): 25 for y in _milburn_years()},
        ),
    )


# =============================================================================
# MEASURES REGISTERED AS NOT COMPUTABLE
# =============================================================================


@dataclass(frozen=True)
class NotComputableMeasure:
    """A candidate measure the model and data cannot cost. It is listed
    with its reason and never given a figure (not even £0)."""

    id: str
    name: str
    description: str
    reason: str
    status: str = "not_computable"


# The final report's measures the page lists but cannot compute, in the
# page's order and words (src/utils/milburn/notComputable.js).
NOT_COMPUTABLE_MEASURES = (
    NotComputableMeasure(
        id="child_dla_to_18",
        name="Child DLA extended to 18",
        description=(
            "16 and 17-year-olds stay on Disability Living Allowance "
            "instead of moving to PIP (report paragraph 760)."
        ),
        reason=(
            "DLA and PIP pay the same amounts, so the switch changes no "
            "payment; its effect on reassessment is not in the data."
        ),
    ),
    NotComputableMeasure(
        id="additional_cost_allowance",
        name="Additional Cost Allowance",
        description=(
            "A national, non-means-tested allowance for established, "
            "ongoing disability costs, replacing PIP for young people."
        ),
        reason="Its eligibility and rates are not in the model.",
    ),
    NotComputableMeasure(
        id="severe_complex_needs_insurance",
        name="Severe and Complex Needs Insurance",
        description=(
            "A stable long-term income, above today's maximum benefit "
            "rates, where paid work is not realistic."
        ),
        reason=(
            "The data cannot identify who would qualify, and its rate is "
            "not in the model."
        ),
    ),
    NotComputableMeasure(
        id="health_and_disability_fund",
        name="Local Health and Disability Fund",
        description=(
            "Local payments for one-off or changing disability costs, "
            "decided by the Youth Opportunity Service."
        ),
        reason=(
            "Awards are at local discretion, with no rule to apply to "
            "households."
        ),
    ),
    NotComputableMeasure(
        id="youth_conditionality",
        name="Duty to engage",
        description=(
            "Persistent refusal to engage can end in loss of the Youth "
            "Allowance."
        ),
        reason="It works through behaviour, which a static model omits.",
    ),
    NotComputableMeasure(
        id="care_leaver_transition_allowance",
        name="Care Leaver Transition Allowance",
        description=(
            "A six-month weekly allowance for care leavers who are NEET or "
            "at serious risk."
        ),
        reason="The model's data do not identify care leavers.",
    ),
    NotComputableMeasure(
        id="opportunity_guarantee",
        name="Opportunity Guarantee",
        description=(
            "A legal right to education, training or work, with a paid "
            "six-month job as backstop."
        ),
        reason="An entitlement to places, not a tax or benefit rule.",
    ),
    NotComputableMeasure(
        id="employer_hiring_payments",
        name="Hiring payments to employers",
        description=(
            "Payments to employers for hiring a young person who has been "
            "out of work and education for six months."
        ),
        reason="Its effect is on hiring, which a static model omits.",
    ),
    NotComputableMeasure(
        id="apprenticeship_target",
        name="Apprenticeship target",
        description=(
            "More apprenticeship starts for under-25s a year by 2036, with "
            "pre-apprenticeship places."
        ),
        reason="A target for places, not a tax or benefit rule.",
    ),
    NotComputableMeasure(
        id="further_education_places",
        name="Further education places",
        description=(
            "More 18 to 24-year-olds in further education each year, over "
            "the decade."
        ),
        reason="A spending programme, not a tax or benefit rule.",
    ),
)


def get_not_computable_measures() -> list[NotComputableMeasure]:
    """The measures listed without a figure, with their reasons."""
    return list(NOT_COMPUTABLE_MEASURES)


# =============================================================================
# COMBINED PACKAGE
# =============================================================================

# The measures the package brings together, by id: the health element
# removal for all claimants and the PIP removal for 18 to 24-year-olds.
MILBURN_PACKAGE_COMPONENTS = (UC_HEALTH_UNDER_25_ID, PIP_UNDER_25_ID)


UC_HEALTH_UNDER_22_ID = "uc_health_element_removed_under_22"
UC_HEALTH_UNDER_25_SEVERE_KEPT_ID = "uc_health_element_removed_under_25_severe_kept"
PIP_HALVED_ID = "pip_halved_under_25"
MILBURN_CENTRAL_ID = "milburn_package_central"
MILBURN_CENTRAL_COMPONENTS = (UC_HEALTH_UNDER_25_SEVERE_KEPT_ID, PIP_HALVED_ID)


def _create_uc_health_element_removed_under_22() -> Reform:
    return Reform(
        id=UC_HEALTH_UNDER_22_ID,
        name="UC health element removed for under-22s",
        description=(
            f"{_FROM} Universal Credit awards no longer include the "
            "health (LCWRA) element where the claimant with limited "
            "capability for work and work-related activity is under 22, for "
            "existing and new claimants alike: the age limit proposed in the "
            "2025 Pathways to Work green paper."
        ),
        simulation_modifier=uc_health_element_removed_under_22,
    )


def _create_uc_health_element_removed_under_25_severe_kept() -> Reform:
    return Reform(
        id=UC_HEALTH_UNDER_25_SEVERE_KEPT_ID,
        name=f"UC health element removed for {_UNDER}, severe cases kept",
        description=(
            f"As the removal for {_UNDER}, except that a young claimant "
            "with limited capability for work and work-related activity "
            f"who scores {milburn_design.SEVERE_DL_POINTS} or more PIP daily living points (about a fifth "
            "of young PIP recipients) keeps the element. "
            + SEVERE_KEPT_BRIEFING_NOTE
        ),
        simulation_modifier=uc_health_element_removed_under_25_severe_kept,
    )


def _create_pip_halved_under_25() -> Reform:
    return Reform(
        id=PIP_HALVED_ID,
        name=f"PIP at half rate for {_PIP_PEOPLE}",
        description=(
            f"{_FROM} people aged {_PIP_BAND} receive half their current "
            "Personal Independence Payment. This is an illustrative stand-in "
            "for the report's Additional Cost Allowance, for which the report "
            "gives no rates; Scottish Adult "
            "Disability Payment, recorded as PIP, is included. Half an award "
            "can fall below the amounts that some disability rules read, "
            "such as severe disability status, so those can be lost too; a "
            "new allowance could carry its own qualifying rules. Carer's "
            "Allowance is not linked to PIP in the model and does not "
            "change."
        ),
        simulation_modifier=pip_halved_ages_18_to_24,
    )
PIP_16_TO_24_ID = "pip_removed_16_to_24"
MILBURN_PHASED_ID = "milburn_package_phased"
MILBURN_ENTRY_ID = "milburn_package_entry_25pct"


def _create_pip_removed_16_to_24() -> Reform:
    return Reform(
        id=PIP_16_TO_24_ID,
        name="PIP removed for 16 to 24-year-olds",
        description=(
            f"As the PIP removal for {_PIP_PEOPLE}, but from age 16: "
            "'under 25' read literally. Disability Living Allowance for "
            "children under 16 is unchanged."
        ),
        simulation_modifier=pip_removed_ages_16_to_24,
    )


def _phasing_text(
    rate=milburn_design.REASSESSED_EACH_YEAR,
    cohort_start=milburn_design.COHORT_START_YEAR,
    entrant_age=milburn_design.NEW_ENTRANT_AGE,
) -> str:
    """The phased runs' rule in words. It states the rule only: the share
    reached in a year comes from the run (the page computes it)."""
    return (
        f"people who turned {entrant_age} since "
        f"{milburn_design.start_date_text(cohort_start)} at once, and "
        "existing claimants as they are reassessed, at an assumed "
        f"{milburn_design.percent_text(rate)} of those remaining each "
        "year. Who is reassessed is "
        "a random draw, as the data hold no reassessment dates."
    )


def _create_milburn_package_phased() -> Reform:
    return Reform(
        id=MILBURN_PHASED_ID,
        name="Health element and PIP removal from April 2027, phased as claimants are reassessed",
        description=(
            "The health element and PIP removals for young people, reaching "
            + _phasing_text()
        ),
        simulation_modifier=milburn_package_phased,
    )


def _create_milburn_package_entry_25pct() -> Reform:
    return Reform(
        id=MILBURN_ENTRY_ID,
        name="Health element and PIP removal from April 2027, with an illustrative move into work",
        description=(
            "The full package, with a randomly chosen quarter of affected "
            f"young people who do not work (aged {_PIP_BAND}, with PIP or "
            "limited capability for work and work-related activity) moving "
            "into 16 hours a week at their minimum wage. An illustrative "
            "scenario, not an estimate of how people would respond."
        ),
        simulation_modifier=milburn_package_with_entry_25pct,
    )


# The registry's combined run and its parts, under the names the rest of the
# package imports (geography's PACKAGES, the household calculation).
COMBINED_ID = MILBURN_PACKAGE_ID
COMBINED_COMPONENTS = MILBURN_PACKAGE_COMPONENTS
# Kept for importers written for the Autumn Budget registry: they now name
# the Milburn package.
AUTUMN_BUDGET_2026_COMBINED_ID = COMBINED_ID
AUTUMN_BUDGET_2026_COMBINED_COMPONENTS = COMBINED_COMPONENTS

_MEASURE_FACTORIES = (
    _create_uc_health_element_removed_under_25,
    _create_uc_health_element_removed_under_25_new_claims,
    _create_pip_removed_under_25,
    _create_youth_allowance_at_25_plus_rate,
    _create_employer_nics_zero_under_25,
    _create_uc_health_element_removed_under_22,
    _create_uc_health_element_removed_under_25_severe_kept,
    _create_pip_halved_under_25,
    _create_pip_removed_16_to_24,
    _create_milburn_package_phased,
    _create_milburn_package_entry_25pct,
)


def _create_milburn_package(
    members: list[Reform],
    package_id: str = None,
    name: str = "Health element and PIP removal for young people, from April 2027 (combined)",
    description: str = None,
) -> Reform:
    """One simulation of the package's measures.

    Built by ``publication.combine.combine_measures``, as a combined run
    is: the members' merged parameter changes (it refuses two members
    changing one parameter) and each member's modifier, in order of
    measure id.
    """
    from uk_budget_data.models import DataConfig
    from uk_budget_data.publication.combine import combine_measures

    combined = combine_measures(members, DataConfig())
    return Reform(
        id=package_id or MILBURN_PACKAGE_ID,
        name=name,
        description=description
        or (
            f"The health element removal for {_UNDER} (all claimants) and "
            f"the PIP removal for {_PIP_PEOPLE} simulated together, "
            "with their interactions."
        ),
        parameter_changes=combined.parameter_changes,
        simulation_modifier=combined.simulation_modifier,
        baseline_parameter_changes=combined.baseline_parameter_changes,
        baseline_simulation_modifier=combined.baseline_simulation_modifier,
    )


# =============================================================================
# RESERVED MEASURES (resolvable by id, not listed)
# =============================================================================
#
# Registered so that ``generate --reforms <id>`` (and ``get_reform``) finds
# them, but left out of ``get_milburn_reforms`` / ``list_reform_ids``: the
# page lists every computable measure in ``milburn_measures.json`` (as "Not
# yet run" until its folder exists), and that file, the summary and a
# ``generate`` with no ``--reforms`` are all built from the listed registry.
# To put one on the page, add its id to ``MILBURN_PROMOTED_IDS`` and
# regenerate ``milburn_measures.json`` (then the frontend lists and the
# registry test, docs/report-day/01-pipeline-runbook.md section 5).
#
# ``milburn_report_*`` are the final report's design, written from the
# REPORT_* constants in ``budget_measures/milburn_design.py``: edit those,
# then run these ids. The others are alternatives on the 15 November
# designs: the package with PIP from 16, and PIP removal leaving Scottish
# Adult Disability Payment alone.

MILBURN_REPORT_PACKAGE_ID = "milburn_report_package"
MILBURN_REPORT_PIP_ID = "milburn_report_pip"
MILBURN_REPORT_UC_HEALTH_ID = "milburn_report_uc_health"
MILBURN_REPORT_PHASED_ID = "milburn_report_package_phased"
MILBURN_REPORT_ENTRY_ID = "milburn_report_package_entry_25pct"
MILBURN_REPORT_YOUTH_ALLOWANCE_ID = "milburn_report_youth_allowance"
# Exists only while REPORT_EMPLOYER_NICS_UNDER_25_RATE is set, and then
# joins the report package.
MILBURN_REPORT_EMPLOYER_NICS_ID = "milburn_report_employer_nics"
MILBURN_REPORT_PACKAGE_COMPONENTS = (
    MILBURN_REPORT_UC_HEALTH_ID,
    MILBURN_REPORT_PIP_ID,
)
MILBURN_PACKAGE_16_TO_24_ID = "milburn_package_16_to_24"
MILBURN_PACKAGE_16_TO_24_COMPONENTS = (UC_HEALTH_UNDER_25_ID, PIP_16_TO_24_ID)
PIP_UNDER_25_EXCLUDING_SCOTLAND_ID = "pip_removed_under_25_excluding_scotland"
PIP_16_TO_24_EXCLUDING_SCOTLAND_ID = "pip_removed_16_to_24_excluding_scotland"
# Reserved ids to list on the page (empty until their runs exist).
# milburn_report_child_dla_to_18 stays reserved but unlisted: its run is
# all zeros (the paired rates are equal), so the page lists child DLA to 18
# as not computable instead.
MILBURN_PROMOTED_IDS: tuple[str, ...] = (
    "milburn_report_package",
    "milburn_report_uc_health",
    "milburn_report_pip",
    "milburn_report_employer_nics_threshold",
    "milburn_report_youth_allowance_independent",
    "milburn_report_package_phased",
    "milburn_report_employer_nics_threshold_glide_path",
    "milburn_report_youth_allowance_work_allowance",
    "milburn_report_youth_allowance_combined",
    "milburn_report_package_with_youth_allowance",
)

_SCOTLAND_INCLUDED = (
    "Scottish "
    "recipients of Adult Disability Payment, which the data record "
    "as PIP, are included."
)
_SCOTLAND_EXCLUDED = (
    "Scottish recipients of Adult Disability Payment, which the data "
    "record as PIP, are left as they are."
)


def _report_uc_health_text() -> tuple[str, str]:
    d = milburn_design
    low, high = d.REPORT_UC_HEALTH_LOWER_AGE, d.REPORT_UC_HEALTH_UPPER_AGE
    start = d.start_text(d.REPORT_START_YEAR, d.REPORT_START_MONTH)
    if low > 0:
        people = d.age_band_people_text(low, high)
        who = f"aged {d.age_band_text(low, high)}"
    else:
        people = d.under_text(high)
        who = f"under {high}"
    name = f"UC health element removed for {people}"
    severe = ""
    if d.REPORT_UC_HEALTH_SEVERE_KEPT:
        name += ", severe cases kept"
        severe = (
            "A young claimant with that capability who scores "
            f"{d.REPORT_SEVERE_DL_POINTS} or more PIP daily living points "
            "keeps the element: the points stand in for the report's rule "
            "for the most severe conditions, which the data cannot "
            "identify. "
        )
    description = (
        f"{start} Universal Credit awards no longer include the "
        "health (LCWRA) element where the claimant with limited "
        f"capability for work and work-related activity is {who}, for "
        "existing and new claimants alike; an award keeps it where a "
        f"joint claimant aged {high} or over has that capability. "
        f"{severe}The "
        "assessment itself is unchanged, so the work allowance still "
        "applies, but an award without the element loses the benefit "
        "cap exception that rests on it."
    )
    return name, description


def _with_article(label: str) -> str:
    """'an additional cost allowance'."""
    return f"{'an' if label[0].lower() in 'aeiou' else 'a'} {label}"


def _report_pip_tier_text(shares: dict, people: str) -> tuple[str, str]:
    """The name and the 'receive ...' clause of a tiered PIP replacement
    (``REPORT_PIP_REPLACEMENT_SHARES``)."""
    d = milburn_design

    def paid(share):
        if share == 0:
            return "no longer paid"
        if share == 1:
            return "paid in full"
        return f"paid at {d.rate_text(share)} of its current amount"

    values = [shares[key] for key in d.REPORT_PIP_SHARE_KEYS]
    enhanced = (shares["daily_living_enhanced"], shares["mobility_enhanced"])
    standard = (shares["daily_living_standard"], shares["mobility_standard"])
    if all(value == 1 for value in values):
        name = f"PIP unchanged for {people}"
    elif all(value == 0 for value in values):
        name = f"PIP removed for {people}"
    elif enhanced == (1, 1) and standard == (0, 0):
        name = f"PIP kept only at the enhanced rate for {people}"
    else:
        name = f"PIP replaced by tiered support for {people}"
    label = d.REPORT_PIP_REPLACEMENT_NAME
    if label and any(value != 1 for value in values):
        name = f"PIP replaced by {_with_article(label)} for {people}"
    stand_in = f"the report's {label}" if label else (
        "the report's replacement support"
    )
    receive = (
        "receive Personal Independence Payment at a share of its current "
        "amount set by component and award level: the daily living "
        f"component is {paid(shares['daily_living_enhanced'])} at the "
        f"enhanced rate and {paid(shares['daily_living_standard'])} at the "
        "standard rate; the mobility component is "
        f"{paid(shares['mobility_enhanced'])} at the enhanced rate and "
        f"{paid(shares['mobility_standard'])} at the standard rate. The "
        f"shares stand in for {stand_in}, whose rates and "
        "eligibility rules the data cannot identify, and no local health "
        "and disability fund is modelled"
    )
    return name, receive


def _report_pip_text() -> tuple[str, str]:
    d = milburn_design
    low, high = d.REPORT_PIP_LOWER_AGE, d.REPORT_PIP_UPPER_AGE
    start = d.start_text(d.REPORT_START_YEAR, d.REPORT_START_MONTH)
    people = d.age_band_people_text(low, high)
    share = d.REPORT_PIP_REPLACEMENT_SHARE
    shares = d.REPORT_PIP_REPLACEMENT_SHARES
    if shares is not None:
        name, receive = _report_pip_tier_text(shares, people)
    elif share:
        kept = d.percent_text(share)
        name = f"PIP at {kept} of its rate for {people}"
        receive = f"receive {kept} of their current Personal Independence Payment"
        if d.REPORT_PIP_REPLACEMENT_NAME:
            label = d.REPORT_PIP_REPLACEMENT_NAME
            name = f"PIP replaced by {_with_article(label)} for {people}"
            receive += (
                f", which stands in for the report's {label}, whose rates "
                "and eligibility rules the data cannot identify"
            )
    else:
        name = f"PIP removed for {people}"
        receive = "receive neither component of Personal Independence Payment"
    if low >= 18:
        younger = "; 16 and 17-year-olds keep it and "
    elif low == 17:
        younger = "; 16-year-olds keep it and "
    else:
        younger = "; "
    description = (
        f"{start} people aged {d.age_band_text(low, high)} {receive}"
        f"{younger}Disability Living Allowance for children is unchanged. "
        + (
            "Entitlements that depend on receiving a component stay where "
            "any of it is still paid and go where none is. Carer's "
            "Allowance is not linked to PIP in the model and does not "
            "change. "
            if shares is not None
            else "Universal Credit amounts that depend on receiving PIP go "
            "with it; Carer's Allowance is not linked to PIP in the model "
            "and does not change. "
        )
        + (
            _SCOTLAND_INCLUDED
            if d.REPORT_PIP_INCLUDE_SCOTLAND
            else _SCOTLAND_EXCLUDED
        )
    )
    return name, description


def _create_milburn_report_uc_health() -> Reform:
    name, description = _report_uc_health_text()
    return Reform(
        id=MILBURN_REPORT_UC_HEALTH_ID,
        name=name,
        description=description,
        simulation_modifier=milburn_report_uc_health,
    )


def _create_milburn_report_pip() -> Reform:
    name, description = _report_pip_text()
    return Reform(
        id=MILBURN_REPORT_PIP_ID,
        name=name,
        description=description,
        simulation_modifier=milburn_report_pip,
    )


def _report_employer_nics_text() -> tuple[str, str]:
    d = milburn_design
    rate = d.rate_text(d.REPORT_EMPLOYER_NICS_UNDER_25_RATE)
    limit = d.REPORT_EMPLOYER_NICS_AGE_LIMIT
    start = d.start_text(d.REPORT_START_YEAR, d.REPORT_START_MONTH)
    name = f"Employer NICs at {rate} for under-{limit}s"
    description = (
        f"{start} employers pay Class 1 National Insurance at {rate}, not "
        "the main 15%, on earnings between the secondary threshold and the "
        "upper secondary threshold (£50,270 a year) for employees under "
        f"{limit}; earnings above it bear the main rate. Under-21s and "
        "apprentices under 25 keep their zero rate. The model passes "
        "employers' National Insurance through to wages, so the saving "
        "shows as higher pay for these employees."
    )
    return name, description


def _report_replacements_text() -> str:
    """Said of the report package while it removes both benefits with
    nothing in their place: the report's replacement payments (Additional
    Cost Allowance, Health and Disability Fund, Severe and Complex Needs
    Insurance) are not in the run. Empty once a stand-in is set."""
    d = milburn_design
    stand_in = (
        d.REPORT_PIP_REPLACEMENT_SHARE
        or d.REPORT_PIP_REPLACEMENT_SHARES is not None
        or d.REPORT_UC_HEALTH_SEVERE_KEPT
    )
    return "" if stand_in else " and without its replacement payments"


def _report_without_employer_nics_text() -> str:
    """A sentence for the report variants that leave the employer rate
    out; empty while no rate is set."""
    if milburn_design.REPORT_EMPLOYER_NICS_UNDER_25_RATE is None:
        return ""
    return (
        " The report's employer National Insurance rate is not part of "
        "this run."
    )


def _create_milburn_report_employer_nics() -> Optional[Reform]:
    """The report's reduced employer rate for young employees; None while
    ``REPORT_EMPLOYER_NICS_UNDER_25_RATE`` is None (nothing to run)."""
    d = milburn_design
    if d.REPORT_EMPLOYER_NICS_UNDER_25_RATE is None:
        return None
    d.check_report_design()
    name, description = _report_employer_nics_text()
    return Reform(
        id=MILBURN_REPORT_EMPLOYER_NICS_ID,
        name=name,
        description=description,
        simulation_modifier=milburn_report_employer_nics,
    )


def _create_milburn_report_package_phased() -> Reform:
    d = milburn_design
    if d.REPORT_REASSESSED_EACH_YEAR:
        reach = _phasing_text(
            d.REPORT_REASSESSED_EACH_YEAR,
            d.REPORT_START_YEAR - 1,
            d.REPORT_NEW_ENTRANT_AGE,
        )
    else:
        reach = (
            f"only people who turned {d.REPORT_NEW_ENTRANT_AGE} since "
            f"{d.start_date_text(d.REPORT_START_YEAR - 1)}: existing "
            "claimants keep their awards. New claims at older ages are "
            "not identified, as the data hold no claim dates."
        )
    return Reform(
        id=MILBURN_REPORT_PHASED_ID,
        name="Health element and PIP removal from April 2029, phased as claimants are reassessed",
        description=(
            "The report's health element and PIP changes for young people, "
            "reaching " + reach + _report_without_employer_nics_text()
        ),
        simulation_modifier=milburn_report_package_phased,
    )


def _create_milburn_report_package_entry_25pct() -> Reform:
    d = milburn_design
    band = d.age_band_text(
        d.REPORT_PIP_LOWER_AGE,
        max(d.REPORT_PIP_UPPER_AGE, d.REPORT_UC_HEALTH_UPPER_AGE),
    )
    return Reform(
        id=MILBURN_REPORT_ENTRY_ID,
        name="Health element and PIP removal from April 2029, with an illustrative move into work",
        description=(
            "The report package, with a randomly chosen quarter of affected "
            f"young people who do not work (aged {band}, with PIP or "
            "limited capability for work and work-related activity) moving "
            f"into {d.ENTRY_HOURS} hours a week at their minimum wage. An "
            "illustrative scenario, not an estimate of how people would "
            "respond." + _report_without_employer_nics_text()
        ),
        simulation_modifier=milburn_report_package_with_entry_25pct,
    )


def _create_milburn_report_youth_allowance() -> Optional[Reform]:
    """The report's youth allowance at given amounts; None while
    ``REPORT_YOUTH_ALLOWANCE_MONTHLY`` is None (at the under-25 rate no
    award changes, so there is nothing to run)."""
    d = milburn_design
    monthly = d.REPORT_YOUTH_ALLOWANCE_MONTHLY
    if monthly is None:
        return None
    d.check_report_design()
    first = d.REPORT_START_YEAR
    single, couple = monthly[first]
    return Reform(
        id=MILBURN_REPORT_YOUTH_ALLOWANCE_ID,
        name="Youth allowance at the report's rates",
        description=(
            f"{d.start_text(first, d.REPORT_START_MONTH)} single Universal "
            "Credit claimants under 25 receive a standard allowance of "
            f"£{single:,.2f} a month and couples in which both are under "
            f"25 £{couple:,.2f} a month (the {d.fiscal_year_text(first)} "
            "amounts). The protected health element is held at its "
            "current-law amount, which the law otherwise links to the "
            "under-25 allowances."
        ),
        parameter_changes={
            **youth_allowance_rates(monthly),
            **uc_health_element_change(
                protected=current_law_protected_health_element()
            ),
        },
    )


def _create_pip_removed_under_25_excluding_scotland() -> Reform:
    return Reform(
        id=PIP_UNDER_25_EXCLUDING_SCOTLAND_ID,
        name=f"PIP removed for {_PIP_PEOPLE}, excluding Scotland",
        description=(
            f"As the PIP removal for {_PIP_PEOPLE}, except that "
            + _SCOTLAND_EXCLUDED
        ),
        simulation_modifier=pip_removed_ages_18_to_24_excluding_scotland,
    )


def _create_pip_removed_16_to_24_excluding_scotland() -> Reform:
    return Reform(
        id=PIP_16_TO_24_EXCLUDING_SCOTLAND_ID,
        name="PIP removed for 16 to 24-year-olds, excluding Scotland",
        description=(
            "As the PIP removal for 16 to 24-year-olds, except that "
            + _SCOTLAND_EXCLUDED
        ),
        simulation_modifier=pip_removed_ages_16_to_24_excluding_scotland,
    )



# The final report's employer National Insurance proposal (paras 269-270):
# the secondary threshold rises from £5,000 to £10,000 for employees aged 21
# to 24 whose main job is in retail (SIC division 47) or hospitality (55, 56).
# The report gives no start date or costing; this is its end state, modelled
# in every year (milburn_employer_nics_report.py).
from uk_budget_data.budget_measures.milburn_employer_nics_report import (  # noqa: E402
    milburn_employer_nics_report,
)

MILBURN_REPORT_EMPLOYER_NICS_THRESHOLD_ID = "milburn_report_employer_nics_threshold"


def _create_milburn_report_employer_nics_threshold() -> Reform:
    return Reform(
        id=MILBURN_REPORT_EMPLOYER_NICS_THRESHOLD_ID,
        name="Employer NI threshold of £10,000 for 21 to 24s in retail and hospitality",
        description=(
            "The report's end state: employers pay Class 1 National Insurance on "
            "earnings above £10,000 a year, not £5,000, for employees aged 21 to "
            "24 whose main job is in retail (SIC division 47) or hospitality "
            "(divisions 55 and 56). The 15% rate is unchanged, and under-21s and "
            "apprentices under 25 keep their zero rate. The report gives no start "
            "date or costing and proposes a five-year glide path; the end state "
            "is shown in every year. policyengine-uk holds each employer's total "
            "cost of employment fixed, so the saving passes to employees as "
            "higher pay; hiring does not respond."
        ),
        simulation_modifier=milburn_employer_nics_report,
    )


# The report's Youth Allowance at the review's own modelling (annex section
# 8): the 25-and-over standard allowance for under-25 claims with a UC
# housing costs element, the annex's proxy for living independently (para
# 748); from April 2029; no work allowance change (the report gives no
# amount). milburn_youth_allowance_report.py
from uk_budget_data.budget_measures.milburn_youth_allowance_report import (  # noqa: E402
    milburn_report_youth_allowance as _youth_allowance_independent,
)
from uk_budget_data.budget_measures.milburn_employer_nics_report import (  # noqa: E402
    milburn_employer_nics_report_glide_path,
)

MILBURN_REPORT_YOUTH_ALLOWANCE_INDEPENDENT_ID = "milburn_report_youth_allowance_independent"
MILBURN_REPORT_EMPLOYER_NICS_GLIDE_PATH_ID = "milburn_report_employer_nics_threshold_glide_path"


def _create_milburn_report_youth_allowance_independent() -> Reform:
    return Reform(
        id=MILBURN_REPORT_YOUTH_ALLOWANCE_INDEPENDENT_ID,
        name="Higher Youth Allowance for under-25s living independently",
        description=(
            "From April 2029 Universal Credit claims in which every adult is "
            "under 25 and that include a housing costs element are paid the "
            "standard allowance for those aged 25 and over, the review's own "
            "proxy for living independently (analytical annex, section 8). "
            "Other young claims keep the under-25 rate, which the report "
            "proposes as the Youth Allowance's base level. The report gives no amount "
            "for its work allowance, so none is modelled."
        ),
        simulation_modifier=_youth_allowance_independent,
    )


def _create_milburn_report_employer_nics_threshold_glide_path() -> Reform:
    return Reform(
        id=MILBURN_REPORT_EMPLOYER_NICS_GLIDE_PATH_ID,
        name="Employer NI threshold for 21 to 24s in retail and hospitality, phased in",
        description=(
            "The report's five-year glide path, in assumed equal steps from "
            "April 2027: the employer National Insurance threshold for "
            "employees aged 21 to 24 whose main job is in retail (SIC 47) or "
            "hospitality (SIC 55 and 56) is £6,000 in 2027-28, rising £1,000 "
            "a year to £10,000 in 2031-32. The report gives no start date or "
            "steps. The 15% rate is unchanged; the saving passes to pay."
        ),
        simulation_modifier=milburn_employer_nics_report_glide_path,
    )


# The report's child DLA to 18 (para 760) and, illustratively, its work
# allowance for young people in work (para 749, which gives no amount: the
# current Universal Credit work allowance is our assumption). Both from
# April 2029. milburn_child_dla_report.py, milburn_youth_allowance_report.py
from uk_budget_data.budget_measures.milburn_child_dla_report import (  # noqa: E402
    milburn_child_dla_report,
)
from uk_budget_data.budget_measures.milburn_youth_allowance_report import (  # noqa: E402
    milburn_report_youth_allowance_work_allowance as _youth_work_allowance,
)

MILBURN_REPORT_CHILD_DLA_ID = "milburn_report_child_dla_to_18"
MILBURN_REPORT_YOUTH_WORK_ALLOWANCE_ID = (
    "milburn_report_youth_allowance_work_allowance"
)


def _create_milburn_report_child_dla_to_18() -> Reform:
    return Reform(
        id=MILBURN_REPORT_CHILD_DLA_ID,
        name="Child Disability Living Allowance extended to 18",
        description=(
            "From April 2029, 16 and 17-year-olds stay on child Disability "
            "Living Allowance (DLA) instead of moving to Personal "
            "Independence Payment (PIP) at 16 (report para 760). Modelled as "
            "a swap at the equivalent award level: PIP daily living at the "
            "standard or enhanced rate becomes the DLA care component at "
            "the middle or highest rate, and PIP mobility at the standard "
            "or enhanced rate becomes DLA mobility at the lower or higher "
            "rate. Each pair has the same weekly amount, so awards do not "
            "change in the model. The data do not record who would keep, "
            "lose or change an award without the reassessment at 16, so "
            "that effect is not estimated. Scottish records are left as "
            "they are: Child Disability Payment is already paid to 18."
        ),
        simulation_modifier=milburn_child_dla_report,
    )


def _create_milburn_report_youth_allowance_work_allowance() -> Reform:
    return Reform(
        id=MILBURN_REPORT_YOUTH_WORK_ALLOWANCE_ID,
        name="Work allowance for under-25s in work (illustrative)",
        description=(
            "From April 2029 every Universal Credit claim in which all "
            "claimants are under 25 has a work allowance: earnings below it "
            "do not reduce the award. The report proposes a work allowance "
            "for everyone on the Youth Allowance who is in employment (para "
            "749) and gives no amount. The amount here is our assumption: "
            "the current Universal Credit work allowance, the lower rate "
            "for claims with a housing costs element and the higher rate "
            "for those without, uprated each year. Claims that already "
            "have a work allowance (with a child or limited capability for "
            "work) keep it, and the 55% taper and the standard allowance "
            "are unchanged."
        ),
        simulation_modifier=_youth_work_allowance,
    )


# Our combined designs (not the report's package): the two Youth
# Allowance changes together, and those with the health element and PIP
# removal, each simulated as one run with their interactions.
MILBURN_REPORT_YOUTH_ALLOWANCE_COMBINED_ID = "milburn_report_youth_allowance_combined"
MILBURN_REPORT_YOUTH_ALLOWANCE_COMBINED_COMPONENTS = (
    MILBURN_REPORT_YOUTH_ALLOWANCE_INDEPENDENT_ID,
    MILBURN_REPORT_YOUTH_WORK_ALLOWANCE_ID,
)
MILBURN_REPORT_PACKAGE_WITH_YOUTH_ALLOWANCE_ID = (
    "milburn_report_package_with_youth_allowance"
)
MILBURN_REPORT_PACKAGE_WITH_YOUTH_ALLOWANCE_COMPONENTS = (
    *MILBURN_REPORT_PACKAGE_COMPONENTS,
    *MILBURN_REPORT_YOUTH_ALLOWANCE_COMBINED_COMPONENTS,
)


_RESERVED_IDS = frozenset(
    {
        MILBURN_REPORT_PACKAGE_ID,
        MILBURN_REPORT_PIP_ID,
        MILBURN_REPORT_UC_HEALTH_ID,
        MILBURN_REPORT_PHASED_ID,
        MILBURN_REPORT_ENTRY_ID,
        MILBURN_REPORT_YOUTH_ALLOWANCE_ID,
        MILBURN_REPORT_EMPLOYER_NICS_ID,
        MILBURN_PACKAGE_16_TO_24_ID,
        PIP_UNDER_25_EXCLUDING_SCOTLAND_ID,
        PIP_16_TO_24_EXCLUDING_SCOTLAND_ID,
        MILBURN_REPORT_EMPLOYER_NICS_THRESHOLD_ID,
        MILBURN_REPORT_YOUTH_ALLOWANCE_INDEPENDENT_ID,
        MILBURN_REPORT_EMPLOYER_NICS_GLIDE_PATH_ID,
        MILBURN_REPORT_CHILD_DLA_ID,
        MILBURN_REPORT_YOUTH_WORK_ALLOWANCE_ID,
        MILBURN_REPORT_YOUTH_ALLOWANCE_COMBINED_ID,
        MILBURN_REPORT_PACKAGE_WITH_YOUTH_ALLOWANCE_ID,
    }
)

_RESERVED_FACTORIES = (
    _create_milburn_report_pip,
    _create_milburn_report_uc_health,
    _create_milburn_report_package_phased,
    _create_milburn_report_package_entry_25pct,
    _create_milburn_report_youth_allowance,
    _create_milburn_report_employer_nics,
    _create_pip_removed_under_25_excluding_scotland,
    _create_pip_removed_16_to_24_excluding_scotland,
    _create_milburn_report_employer_nics_threshold,
    _create_milburn_report_youth_allowance_independent,
    _create_milburn_report_employer_nics_threshold_glide_path,
    _create_milburn_report_child_dla_to_18,
    _create_milburn_report_youth_allowance_work_allowance,
)


# =============================================================================
# REFORM COLLECTIONS (lazy-loaded to avoid import-time work)
# =============================================================================

_REFORMS_CACHE: list[Reform] | None = None
_REFORM_LOOKUP_CACHE: dict[str, Reform] | None = None
_RESERVED_CACHE: dict[str, Reform] | None = None


def _get_reforms() -> list[Reform]:
    global _REFORMS_CACHE
    if _REFORMS_CACHE is None:
        members = [factory() for factory in _MEASURE_FACTORIES]
        package = [
            member
            for member in members
            if member.id in MILBURN_PACKAGE_COMPONENTS
        ]
        central = [m for m in members if m.id in MILBURN_CENTRAL_COMPONENTS]
        _REFORMS_CACHE = [
            _create_milburn_package(package),  # Combined first
            _create_milburn_package(
                central,
                package_id=MILBURN_CENTRAL_ID,
                name="Health element removal with severe cases kept and PIP at half rate, from April 2027 (combined)",
                description=(
                    f"The health element removal for {_UNDER} with severe "
                    f"cases kept, and PIP at half rate for {_PIP_PEOPLE} "
                    "in place of a new additional cost allowance, simulated "
                    "together with their interactions."
                ),
            ),
            *members,
        ]
        _REFORMS_CACHE += [
            _get_reserved()[reform_id] for reform_id in MILBURN_PROMOTED_IDS
        ]
    return _REFORMS_CACHE


def _get_reserved() -> dict[str, Reform]:
    """The reserved measures, by id: built on first use from the design
    constants as they are then (``reset_reserved_reforms`` rebuilds)."""
    global _RESERVED_CACHE
    if _RESERVED_CACHE is None:
        milburn_design.check_report_design()
        singles = [factory() for factory in _RESERVED_FACTORIES]
        reserved = {r.id: r for r in singles if r is not None}
        name, _ = _report_uc_health_text()
        pip_name, _ = _report_pip_text()
        # The health element and PIP changes, with the employer rate when
        # one is set (the youth allowance stays a measure of its own).
        members = [reserved[i] for i in MILBURN_REPORT_PACKAGE_COMPONENTS]
        names = [name, pip_name]
        if MILBURN_REPORT_EMPLOYER_NICS_ID in reserved:
            members.append(reserved[MILBURN_REPORT_EMPLOYER_NICS_ID])
            names.append(reserved[MILBURN_REPORT_EMPLOYER_NICS_ID].name)
        report = _create_milburn_package(
            members,
            package_id=MILBURN_REPORT_PACKAGE_ID,
            name="Health element and PIP removal for young people, from April 2029 (combined)",
            description=(
                "Two of the report's benefit changes, simulated together "
                f"with their interactions{_report_replacements_text()}: "
                f"{'; '.join(names)}. The report's other modelled measures, "
                "such as the higher Youth Allowance, are separate runs."
            ),
        )
        # Not the cached lookup: this can run while _get_reforms is still
        # adding promoted ids, and the lookup must be built after that.
        listed = {r.id: r for r in _get_reforms()}
        from_16 = _create_milburn_package(
            [listed[i] for i in MILBURN_PACKAGE_16_TO_24_COMPONENTS],
            package_id=MILBURN_PACKAGE_16_TO_24_ID,
            name="Health element removal and PIP removal from age 16, from April 2027 (combined)",
            description=(
                f"The health element removal for {_UNDER} (all claimants) "
                "and the PIP removal for 16 to 24-year-olds simulated "
                "together, with their interactions."
            ),
        )
        youth = _create_milburn_package(
            [
                reserved[i]
                for i in MILBURN_REPORT_YOUTH_ALLOWANCE_COMBINED_COMPONENTS
            ],
            package_id=MILBURN_REPORT_YOUTH_ALLOWANCE_COMBINED_ID,
            name="Higher Youth Allowance and work allowance (illustrative) for under-25s, from April 2029 (combined)",
            description=(
                "Our combination of two of the report's Youth Allowance "
                "proposals, simulated together with their interactions: "
                "the 25-and-over standard allowance for under-25 claims "
                "with a housing costs element (the review's proxy for "
                "living independently), and a work allowance for every "
                "Universal Credit claim in which all claimants are under "
                "25. The report gives no work allowance amount; the current "
                "Universal Credit work allowance is our assumption, so the "
                "run is illustrative."
            ),
        )
        with_youth = _create_milburn_package(
            [
                reserved[i]
                for i in MILBURN_REPORT_PACKAGE_WITH_YOUTH_ALLOWANCE_COMPONENTS
            ],
            package_id=MILBURN_REPORT_PACKAGE_WITH_YOUTH_ALLOWANCE_ID,
            name="Health element and PIP removal with higher Youth Allowance and work allowance (illustrative), from April 2029 (combined)",
            description=(
                "Our combination, simulated together with their "
                f"interactions: {name}; {pip_name}; the higher Youth "
                "Allowance for under-25s living independently; and the "
                "illustrative work allowance for under-25s (the current "
                "Universal Credit work allowance, our assumption: the report "
                "gives no amount). The report's replacement payments are "
                "not modelled."
            ),
        )
        _RESERVED_CACHE = {
            report.id: report,
            from_16.id: from_16,
            youth.id: youth,
            with_youth.id: with_youth,
            **reserved,
        }
    return _RESERVED_CACHE


def reset_reserved_reforms() -> None:
    """Forget the reserved measures, so the next lookup rebuilds their
    names and descriptions from the design constants (tests; a long-lived
    process after a constant changed)."""
    global _RESERVED_CACHE
    _RESERVED_CACHE = None


def get_reserved_reforms() -> list[Reform]:
    """The reserved measures: resolvable by id, not listed."""
    return list(_get_reserved().values())


def list_reserved_reform_ids() -> list[str]:
    return list(_get_reserved())


def _get_reform_lookup() -> dict[str, Reform]:
    global _REFORM_LOOKUP_CACHE
    if _REFORM_LOOKUP_CACHE is None:
        _REFORM_LOOKUP_CACHE = {r.id: r for r in _get_reforms()}
    return _REFORM_LOOKUP_CACHE


def get_milburn_reforms() -> list[Reform]:
    """The combined package, then the registered (computable) measures."""
    return _get_reforms()


# The name the pipeline, CLI and household code call: the active registry.
get_autumn_budget_2026_reforms = get_milburn_reforms


def get_all_reforms() -> list[Reform]:
    """Every registered reform: the same list."""
    return _get_reforms()


def get_reform(reform_id: str) -> Optional[Reform]:
    """Get a reform by its ID, or None if not found: a listed measure,
    or a reserved one (resolvable, not listed)."""
    found = _get_reform_lookup().get(reform_id)
    if found is None and reform_id in _RESERVED_IDS:
        found = _get_reserved().get(reform_id)
    return found


def list_reform_ids() -> list[str]:
    """The listed reform ids (the reserved ones are in
    ``list_reserved_reform_ids``)."""
    return list(_get_reform_lookup().keys())
