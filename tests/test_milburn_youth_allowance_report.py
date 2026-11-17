"""The final report's Youth Allowance
(``budget_measures/milburn_youth_allowance_report.py``) on single
households in 2027-28.

The report (chapter 6, para 748; annex section 8) keeps young people in
Universal Credit: the Youth Allowance is the under-25 standard allowance,
raised to the 25-and-over amount for a claim with a housing costs element
(the annex's proxy for living independently). The tests pass the start
year themselves (2027, the year the shared amounts are pinned for), so
they do not move with the REPORT_* constants.
"""

import warnings

import pytest

from tests.test_milburn_measures import (
    PROTECTED_LCWRA,
    SINGLE_25_PLUS,
    SINGLE_UNDER_25,
    YEAR,
    single,
)
from uk_budget_data import local_build
from uk_budget_data.budget_measures import milburn_design as design
from uk_budget_data.budget_measures import milburn_youth_allowance_report as ya
from uk_budget_data.budget_measures.uc_health_element_removed_under_25 import (
    uc_health_element_removed_under_25,
)
from uk_budget_data.forecast import forecast_parameters
from uk_budget_data.models import DataConfig
from uk_budget_data.personal_impact import household_simulations
from uk_budget_data.reforms import Reform

pytestmark = pytest.mark.skipif(
    not local_build.engine_matches(),
    reason="pins policyengine-uk 2.177.7's 2027-28 amounts",
)

# 12 x (£443.21 - £353.17) = £1,080.48 a year.
SINGLE_GAIN = 12 * (SINGLE_25_PLUS - SINGLE_UNDER_25)


def allowance(sim, **arguments):
    arguments.setdefault("start_year", YEAR)
    return ya.youth_allowance_report(sim, **arguments)


def health(sim):
    return uc_health_element_removed_under_25(sim, start_year=YEAR)


def change(
    situation, *modifiers, variable="household_net_income", **arguments
):
    """(current law, measure) annual values of ``variable`` in 2027-28,
    built as the national run builds a household."""

    def modifier(sim):
        for step in modifiers or (allowance,):
            sim = step(sim, **arguments) if step is allowance else step(sim)
        return sim

    reform = Reform(
        id="test_youth_allowance",
        name="Test",
        description="Test",
        simulation_modifier=modifier,
    )
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        baseline, reformed = household_simulations(
            situation, reform, DataConfig()
        )
        return (
            float(baseline.calculate(variable, YEAR).sum()),
            float(reformed.calculate(variable, YEAR).sum()),
        )


def with_child(situation):
    situation["people"]["c"] = {"age": {YEAR: 2}}
    situation["benunits"]["b"]["members"].append("c")
    situation["households"]["h"]["members"].append("c")
    return situation


def couple(first_age, second_age, rent=6_000):
    situation = single(first_age, rent=rent)
    situation["people"]["q"] = {
        "age": {YEAR: second_age},
        "employment_income": {YEAR: 0},
    }
    situation["benunits"]["b"]["members"].append("q")
    situation["households"]["h"]["members"].append("q")
    return situation


def test_a_22_year_old_renter_gets_the_25_plus_allowance():
    before, after = change(single(22))
    assert after - before == pytest.approx(SINGLE_GAIN, abs=0.05)
    assert after - before == pytest.approx(1_080.48, abs=0.05)
    allowances = change(single(22), variable="uc_standard_allowance")
    assert allowances == pytest.approx(
        (12 * SINGLE_UNDER_25, 12 * SINGLE_25_PLUS)
    )
    # Housing support itself is untouched.
    housing = change(single(22), variable="uc_housing_costs_element")
    assert housing[0] == housing[1] > 0


def test_a_22_year_old_with_no_housing_element_stays_at_the_base_level():
    before, after = change(single(22, rent=0))
    assert before == after
    allowances = change(single(22, rent=0), variable="uc_standard_allowance")
    assert allowances == pytest.approx(
        (12 * SINGLE_UNDER_25, 12 * SINGLE_UNDER_25)
    )


def test_the_allowance_alone_leaves_the_health_element_in_place():
    situation = single(22, lcwra=True)
    before, after = change(situation)
    assert after - before == pytest.approx(SINGLE_GAIN, abs=0.05)
    element = change(situation, variable="uc_LCWRA_element")
    assert element[0] == element[1] == pytest.approx(12 * PROTECTED_LCWRA)


@pytest.mark.parametrize(
    "order", [(allowance, health), (health, allowance)], ids=["ya", "health"]
)
def test_with_the_health_element_removed_in_either_order(order):
    before, after = change(single(22, lcwra=True), *order)
    # +£1,080.48 allowance, -£5,305.24 health element.
    assert after - before == pytest.approx(
        SINGLE_GAIN - 12 * PROTECTED_LCWRA, abs=0.05
    )
    assert (
        change(single(22, lcwra=True), *order, variable="uc_LCWRA_element")[1]
        == 0
    )


def test_a_23_year_old_lone_parent_renter_keeps_the_child_element():
    situation = with_child(single(23))
    before, after = change(situation)
    assert after - before == pytest.approx(SINGLE_GAIN, abs=0.05)
    child = change(situation, variable="uc_child_element")
    assert child[0] == child[1] > 0


@pytest.mark.parametrize("lcwra", [False, True])
def test_a_26_year_old_is_unchanged(lcwra):
    for modifiers in ((allowance,), (allowance, health)):
        before, after = change(single(26, lcwra=lcwra), *modifiers)
        assert before == after


def test_a_couple_with_one_partner_25_or_over_is_unchanged():
    before, after = change(couple(23, 27))
    assert before == after
    amounts = forecast_parameters().gov.dwp.universal_credit
    allowances = change(couple(23, 27), variable="uc_standard_allowance")
    assert (
        allowances[0]
        == allowances[1]
        == pytest.approx(
            12 * amounts.standard_allowance.amount.COUPLE_OLD(f"{YEAR}-04-30")
        )
    )


def test_a_couple_both_under_25_gets_the_couple_25_plus_allowance():
    amounts = forecast_parameters().gov.dwp.universal_credit
    table = amounts.standard_allowance.amount
    day = f"{YEAR}-04-30"
    gain = 12 * (table.COUPLE_OLD(day) - table.COUPLE_YOUNG(day))
    assert gain > 0
    before, after = change(couple(22, 23))
    assert after - before == pytest.approx(gain, abs=0.05)
    assert change(couple(22, 23, rent=0)) == pytest.approx(
        change(couple(22, 23, rent=0))[:1] * 2
    )


def test_no_change_before_the_start_year_and_the_default_is_2029():
    before, after = change(single(22), start_year=YEAR + 1)
    assert before == after
    assert ya.REPORT_FIRST_WELFARE_YEAR == 2029
    before, after = change(single(22), start_year=ya.REPORT_FIRST_WELFARE_YEAR)
    assert before == after


def test_the_base_level_alone_changes_nothing():
    before, after = change(single(22), independent_at_25_plus_rate=False)
    assert before == after


def test_a_work_allowance_is_off_unless_amounts_are_given():
    earner = single(22, employment_income=8_000)
    before, after = change(earner, independent_at_25_plus_rate=False)
    assert before == after
    # £400 a month with a housing element: 55% of 12 x £400 = £2,640 more.
    before, after = change(
        earner,
        independent_at_25_plus_rate=False,
        work_allowance_monthly=(400, 700),
    )
    assert after - before == pytest.approx(0.55 * 12 * 400, abs=0.05)
    # With no housing element the other amount applies, up to earnings.
    home = single(22, rent=0, employment_income=6_000)
    before, after = change(
        home,
        independent_at_25_plus_rate=False,
        work_allowance_monthly=(400, 700),
    )
    assert after - before == pytest.approx(0.55 * 6_000, abs=0.05)


def test_a_work_allowance_leaves_statutory_ones_and_over_25s_alone():
    arguments = dict(
        independent_at_25_plus_rate=False, work_allowance_monthly=(400, 700)
    )
    parent = with_child(single(23, employment_income=8_000))
    assert change(parent, **arguments)[0] == change(parent, **arguments)[1]
    older = single(26, employment_income=8_000)
    assert change(older, **arguments)[0] == change(older, **arguments)[1]


def test_the_illustrative_work_allowance_is_the_years_statutory_one(
    monkeypatch,
):
    table = forecast_parameters().gov.dwp.universal_credit.means_test
    day = f"{YEAR}-04-30"
    with_housing = table.work_allowance.with_housing(day)
    without_housing = table.work_allowance.without_housing(day)
    assert 0 < with_housing < without_housing
    monkeypatch.setattr(design, "REPORT_START_YEAR", YEAR)
    measure = ya.milburn_report_youth_allowance_work_allowance
    # Renting: the lower amount, all of it below £8,000 of earnings.
    before, after = change(single(22, employment_income=8_000), measure)
    assert after - before == pytest.approx(0.55 * 12 * with_housing, abs=0.05)
    allowances = change(
        single(22, employment_income=8_000),
        measure,
        variable="uc_work_allowance",
    )
    assert allowances == pytest.approx((0, 12 * with_housing), abs=0.05)
    # No housing costs element: the higher amount; no standard allowance
    # change with it.
    home = single(22, rent=0, employment_income=8_000)
    assert change(
        home, measure, variable="uc_work_allowance"
    ) == pytest.approx((0, 12 * without_housing), abs=0.05)
    standard = change(home, measure, variable="uc_standard_allowance")
    assert standard[0] == standard[1]
    # No earnings, a child (a statutory allowance already) and 26: unchanged.
    for other in (
        single(22),
        with_child(single(23, employment_income=8_000)),
        single(26, employment_income=8_000),
    ):
        assert change(other, measure)[0] == change(other, measure)[1]


def test_the_15_hour_work_allowance_is_15_hours_at_the_minimum_wage(
    monkeypatch,
):
    parameters = forecast_parameters()
    day = f"{YEAR}-04-30"
    hourly = parameters.gov.hmrc.minimum_wage.non_apprentice(day).calc(21)
    monthly = 15 * hourly * 52 / 12
    statutory = parameters.gov.dwp.universal_credit.means_test.work_allowance
    assert monthly > statutory.without_housing(day)
    monkeypatch.setattr(design, "REPORT_START_YEAR", YEAR)
    measure = ya.milburn_report_youth_allowance_work_allowance_15h
    # The same amount with or without a housing costs element.
    for rent in (6_000, 0):
        earner = single(22, rent=rent, employment_income=20_000)
        assert change(
            earner, measure, variable="uc_work_allowance"
        ) == pytest.approx((0, 12 * monthly), abs=0.05)
        standard = change(earner, measure, variable="uc_standard_allowance")
        assert standard[0] == standard[1]
    # A young parent's statutory allowance is raised to it; 26 and no
    # earnings are unchanged.
    parent = with_child(single(23, employment_income=20_000))
    assert change(parent, measure, variable="uc_work_allowance")[
        1
    ] == pytest.approx(12 * monthly, abs=0.05)
    for other in (single(22), single(26, employment_income=8_000)):
        assert change(other, measure)[0] == change(other, measure)[1]


def test_hours_and_amounts_are_not_both_given():
    with pytest.raises(ValueError, match="not both"):
        ya.youth_allowance_report(
            None, work_allowance_monthly=(1, 1), work_allowance_hours=15
        )


def test_the_report_measure_reads_the_design_start_year(monkeypatch):
    monkeypatch.setattr(design, "REPORT_START_YEAR", YEAR)
    before, after = change(single(22), ya.milburn_report_youth_allowance)
    assert after - before == pytest.approx(SINGLE_GAIN, abs=0.05)


@pytest.mark.parametrize("age_limit", [18, 26, 22.5])
def test_an_age_limit_outside_19_to_25_is_refused(age_limit):
    with pytest.raises(ValueError, match="age_limit"):
        ya.youth_allowance_report(None, age_limit=age_limit)
