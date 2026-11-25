"""The Milburn report's employer National Insurance threshold for 21 to
24-year-olds in retail and hospitality, on single households.

Each test builds the household as the national run builds its simulations
(``personal_impact.household_simulations``) and checks the annual change
against hand arithmetic on the engine's amounts (policyengine-uk 2.179.2,
OBR October 2026 forecast): a 15% employer rate and a £5,000 secondary
threshold to 2030-31, £5,100 in 2031-32.
"""

import warnings

import pytest

from uk_budget_data import local_build
from uk_budget_data.budget_measures.milburn_employer_nics_report import (
    END_STATE_THRESHOLDS,
    REPORT_THRESHOLDS,
    SECTIONS_G_AND_I,
    employer_nics_threshold_ages_21_to_24,
    milburn_employer_nics_report,
    milburn_employer_nics_report_all_sectors,
    milburn_employer_nics_report_glide_path,
    threshold_in,
)
from uk_budget_data.models import DataConfig, Reform
from uk_budget_data.personal_impact import household_simulations

EMPLOYER_RATE = 0.15
SECONDARY_THRESHOLD = 5_000
SECONDARY_THRESHOLD_2031 = 5_100
RETAIL = 47
FOOD_SERVICE = 56
ACCOMMODATION = 55
COMPUTING = 62

pytestmark = pytest.mark.skipif(
    not local_build.engine_matches(),
    reason="pins policyengine-uk 2.179.2's amounts",
)

REPORT = Reform(
    id="test_milburn_report_employer_nics_threshold",
    name="Employer NI threshold for 21 to 24s in retail and hospitality",
    simulation_modifier=milburn_employer_nics_report_glide_path,
)
END_STATE = Reform(
    id="test_milburn_report_employer_nics_end_state",
    name="Employer NI threshold of 10,000 for 21 to 24s in retail and hospitality",
    simulation_modifier=milburn_employer_nics_report,
)
ALL_SECTORS = Reform(
    id="test_milburn_report_employer_nics_threshold_all_sectors",
    name="Employer NI threshold for 21 to 24s",
    simulation_modifier=milburn_employer_nics_report_all_sectors,
)


def employee(age, pay, division=RETAIL, year=2027, apprentice=False):
    return {
        "people": {
            "p": {
                "age": {year: age},
                "employment_income": {year: pay},
                "sic_industry_division": {year: division},
                "is_apprentice": {year: apprentice},
            }
        },
        "benunits": {"b": {"members": ["p"]}},
        "households": {
            "h": {"members": ["p"], "region": {year: "NORTH_WEST"}}
        },
    }


def change(
    situation, variable="ni_class_1_employer", year=2027, reform=REPORT
):
    """(current law, measure) annual values of ``variable`` in ``year``."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        baseline, reformed = household_simulations(
            situation, reform, DataConfig()
        )
        return (
            float(baseline.calculate(variable, year).sum()),
            float(reformed.calculate(variable, year).sum()),
        )


def charge_after(pay, current, new_threshold):
    """The measure's employer charge once the saving has gone to pay: the
    engine holds the employer's cost, pay + 15% x (pay - current), so the
    new pay x solves x + 15% x (x - new threshold) = that cost, and the
    charge is 15% x (x - new threshold). With pay of £20,000 the charge
    falls by 15% x the rise in the threshold / 1.15."""
    cost = pay + EMPLOYER_RATE * (pay - current)
    new_pay = (cost + EMPLOYER_RATE * new_threshold) / (1 + EMPLOYER_RATE)
    return EMPLOYER_RATE * (new_pay - new_threshold)


# £20,000 in 2027-28: £2,250 falls to £2,119.57.
SAVING_2027 = 150 / 1.15


def test_the_schedule_is_five_equal_steps_to_10000():
    assert REPORT_THRESHOLDS == {
        2027: 6_000,
        2028: 7_000,
        2029: 8_000,
        2030: 9_000,
        2031: 10_000,
    }
    assert threshold_in(2026, REPORT_THRESHOLDS) is None
    assert threshold_in(2029, REPORT_THRESHOLDS) == 8_000
    # Held at the last step afterwards.
    assert threshold_in(2032, REPORT_THRESHOLDS) == 10_000


def test_a_23_year_old_in_retail_on_20000_gets_130_more_pay_in_2027():
    situation = employee(23, 20_000)
    before, after = change(situation)
    # 15% x (£20,000 - £5,000) = £2,250. A £6,000 threshold takes £150
    # off at unchanged pay.
    assert before == pytest.approx(
        EMPLOYER_RATE * (20_000 - SECONDARY_THRESHOLD), abs=0.5
    )
    # The engine holds the employer's cost (£22,250) and passes the saving
    # to pay: x + 15% (x - £6,000) = £22,250, so x = £20,130.43, and the
    # charge is 15% x £14,130.43 = £2,119.57.
    pay = change(situation, "employment_income")
    assert pay[1] - pay[0] == pytest.approx(150 / 1.15, abs=0.5)
    assert after == pytest.approx(2_250 - 150 / 1.15, abs=0.5)
    assert after == pytest.approx(charge_after(20_000, 5_000, 6_000), abs=0.5)
    # Less 20% income tax and 8% employee NICs.
    net = change(situation, "household_net_income")
    assert net[1] - net[0] == pytest.approx(150 / 1.15 * 0.72, abs=1)


@pytest.mark.parametrize(
    "year, new_threshold, current",
    [
        (2028, 7_000, SECONDARY_THRESHOLD),
        (2030, 9_000, SECONDARY_THRESHOLD),
        (2031, 10_000, SECONDARY_THRESHOLD_2031),
        # After the schedule: held at £10,000 against 2032-33's £5,202.
        (2032, 10_000, 5_202),
    ],
)
def test_the_threshold_rises_each_year(year, new_threshold, current):
    situation = employee(23, 20_000, year=year)
    # Current law's pay, read from the engine: £20,000 to 2028-29 and
    # £19,968 from 2029-30, when it takes 0.16% off pay in both runs.
    pay = change(situation, "employment_income", year=year)[0]
    assert pay == pytest.approx(20_000 if year < 2029 else 19_968, abs=0.5)
    before, after = change(situation, year=year)
    assert before == pytest.approx(EMPLOYER_RATE * (pay - current), abs=0.5)
    assert after == pytest.approx(
        charge_after(pay, current, new_threshold), abs=0.5
    )


def test_the_end_state_is_10000_from_2027():
    assert END_STATE_THRESHOLDS == {2027: 10_000}
    situation = employee(23, 20_000)
    before, after = change(situation, reform=END_STATE)
    # £2,250 at current law. £750 off at unchanged pay; passed to pay,
    # x + 15% (x - £10,000) = £22,250, so x = £20,652.17 and the charge
    # is £1,597.83.
    assert before == pytest.approx(2_250, abs=0.5)
    assert after == pytest.approx(2_250 - 750 / 1.15, abs=0.5)
    pay = change(situation, "employment_income", reform=END_STATE)
    assert pay[1] - pay[0] == pytest.approx(750 / 1.15, abs=0.5)
    # Outside the two sectors, and at 25: unchanged.
    for other in (employee(23, 20_000, COMPUTING), employee(25, 20_000)):
        before, after = change(other, reform=END_STATE)
        assert after == pytest.approx(before) and before > 0


def test_a_saturday_job_under_the_new_threshold_bears_no_employer_nics():
    # £8,000 in 2031-32 (£7,987.20 in the engine's current law):
    # 15% x (£7,987.20 - £5,100) = £433.08, now nil. The employer's cost,
    # £8,420.28, is under £10,000, so all of it becomes pay.
    situation = employee(22, 8_000, FOOD_SERVICE, year=2031)
    before, after = change(situation, year=2031)
    assert before == pytest.approx(433.08, abs=0.5)
    assert after == 0
    pay = change(situation, "employment_income", year=2031)
    assert pay[1] - pay[0] == pytest.approx(433.08, abs=0.5)


def test_pay_just_under_the_new_threshold_leaves_a_small_charge():
    # £9,500 (£9,484.80): £657.72 at current law. The cost, £10,142.52,
    # is over £10,000, so pay rises to (£10,142.52 + £1,500) / 1.15 =
    # £10,123.93 and 15% of the £123.93 over the threshold is charged.
    situation = employee(22, 9_500, FOOD_SERVICE, year=2031)
    before, after = change(situation, year=2031)
    assert before == pytest.approx(657.72, abs=0.5)
    assert after == pytest.approx(0.15 * 123.93, abs=0.5)


def test_earnings_below_the_current_threshold_are_unchanged():
    before, after = change(employee(22, 4_000))
    assert before == after == 0


@pytest.mark.parametrize("division", [RETAIL, ACCOMMODATION, FOOD_SERVICE])
def test_retail_and_hospitality_are_in(division):
    before, after = change(employee(24, 20_000, division))
    assert before - after == pytest.approx(SAVING_2027, abs=0.5)


@pytest.mark.parametrize("division", [COMPUTING, 45, 46, 0])
def test_other_sectors_are_out_unless_all_sectors(division):
    situation = employee(23, 20_000, division)
    before, after = change(situation)
    assert after == pytest.approx(before) and before > 0
    assert change(situation, "employment_income")[1] == 20_000
    before, after = change(situation, reform=ALL_SECTORS)
    assert before - after == pytest.approx(750 / 1.15, abs=0.5)


def test_the_wider_sector_reading_adds_wholesale_and_motor_trades():
    def wider(sim):
        return employer_nics_threshold_ages_21_to_24(
            sim, sic_divisions=SECTIONS_G_AND_I
        )

    reform = Reform(
        id="test_wider_sectors", name="Wider", simulation_modifier=wider
    )
    assert SECTIONS_G_AND_I == (45, 46, 47, 55, 56)
    before, after = change(employee(23, 20_000, 46), reform=reform)
    assert before - after == pytest.approx(SAVING_2027, abs=0.5)
    before, after = change(employee(23, 20_000, COMPUTING), reform=reform)
    assert after == pytest.approx(before)


@pytest.mark.parametrize("age", [25, 26, 40])
def test_employees_aged_25_and_over_are_unchanged(age):
    before, after = change(employee(age, 20_000))
    assert after == pytest.approx(before) and before > 0


def test_a_21_year_old_is_in():
    before, after = change(employee(21, 20_000))
    assert before - after == pytest.approx(SAVING_2027, abs=0.5)


def test_under_21s_and_apprentices_keep_their_zero_rate():
    assert change(employee(20, 20_000)) == (0, 0)
    assert change(employee(23, 20_000, apprentice=True)) == (0, 0)


def test_before_april_2027_nothing_changes():
    before, after = change(employee(23, 20_000, year=2026), year=2026)
    assert after == pytest.approx(before) and before > 0


def test_a_threshold_at_current_laws_changes_nothing():
    def same(sim):
        return employer_nics_threshold_ages_21_to_24(
            sim, thresholds={2027: 5_000}
        )

    reform = Reform(
        id="test_same_threshold", name="Same", simulation_modifier=same
    )
    before, after = change(employee(23, 20_000), reform=reform)
    assert after == pytest.approx(before, abs=0.01)


def test_a_bad_design_is_refused():
    with pytest.raises(ValueError):
        employer_nics_threshold_ages_21_to_24(None, thresholds={})
    with pytest.raises(ValueError):
        employer_nics_threshold_ages_21_to_24(None, sic_divisions=())
    with pytest.raises(ValueError):
        employer_nics_threshold_ages_21_to_24(None, lowest_age=25)
