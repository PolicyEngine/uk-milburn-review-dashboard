"""The final report's child DLA to 18
(``budget_measures/milburn_child_dla_report.py``) on single households in
2027-28.

The report (para 760) keeps 16 and 17-year-olds on child Disability Living
Allowance instead of moving them to PIP. The measure swaps a PIP award for
DLA at the equivalent level, whose weekly amounts are the same, so the
tests check the swap, that the household's income does not move, and who
is left alone. They pass the start year themselves (2027), so they do not
move with the REPORT_* constants.
"""

import warnings

import pytest

from tests.test_milburn_measures import YEAR
from uk_budget_data import local_build
from uk_budget_data.budget_measures import milburn_child_dla_report as dla
from uk_budget_data.budget_measures import milburn_design as design
from uk_budget_data.forecast import forecast_parameters
from uk_budget_data.models import DataConfig
from uk_budget_data.personal_impact import household_simulations
from uk_budget_data.reforms import Reform

pytestmark = pytest.mark.skipif(
    not local_build.engine_matches(),
    reason="pins policyengine-uk 2.179.2's DLA and PIP variables",
)

WEEKS = 52
DAY = f"{YEAR}-04-30"


def rates():
    return forecast_parameters().gov.dwp


def family(
    age, daily_living="NONE", mobility="NONE", region="NORTH_WEST", **child
):
    """A lone parent on Universal Credit with one young person."""
    young = {
        "age": {YEAR: age},
        "pip_dl_category": {YEAR: daily_living},
        "pip_m_category": {YEAR: mobility},
    }
    young.update({name: {YEAR: value} for name, value in child.items()})
    return {
        "people": {
            "p": {"age": {YEAR: 45}, "employment_income": {YEAR: 0}},
            "c": young,
        },
        "benunits": {"b": {"members": ["p", "c"]}},
        "households": {
            "h": {
                "members": ["p", "c"],
                "rent": {YEAR: 6_000},
                "tenure_type": {YEAR: "RENT_PRIVATELY"},
                "region": {YEAR: region},
            }
        },
    }


def change(situation, *variables, modifier=None, **arguments):
    """{variable: (current law, measure)} household totals in 2027-28."""
    arguments.setdefault("start_year", YEAR)

    def default(sim):
        return dla.child_dla_report(sim, **arguments)

    reform = Reform(
        id="test_child_dla",
        name="Test",
        description="Test",
        simulation_modifier=modifier or default,
    )
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        baseline, reformed = household_simulations(
            situation, reform, DataConfig()
        )
        return {
            variable: (
                float(baseline.calculate(variable, YEAR).sum()),
                float(reformed.calculate(variable, YEAR).sum()),
            )
            for variable in variables
        }


AMOUNTS = ("pip_dl", "pip_m", "dla_sc", "dla_m", "household_net_income")


def test_the_paired_levels_have_the_same_weekly_amounts():
    dwp = rates()
    assert dwp.dla.self_care.middle(DAY) == dwp.pip.daily_living.standard(DAY)
    assert dwp.dla.self_care.higher(DAY) == dwp.pip.daily_living.enhanced(DAY)
    assert dwp.dla.mobility.lower(DAY) == dwp.pip.mobility.standard(DAY)
    assert dwp.dla.mobility.higher(DAY) == dwp.pip.mobility.enhanced(DAY)


def test_a_17_year_olds_enhanced_and_standard_pip_becomes_highest_and_lower_dla():
    dwp = rates()
    found = change(family(17, "ENHANCED", "STANDARD"), *AMOUNTS)
    care = WEEKS * dwp.dla.self_care.higher(DAY)
    mobility = WEEKS * dwp.dla.mobility.lower(DAY)
    assert found["pip_dl"] == pytest.approx((care, 0), abs=0.05)
    assert found["pip_m"] == pytest.approx((mobility, 0), abs=0.05)
    assert found["dla_sc"] == pytest.approx((0, care), abs=0.05)
    assert found["dla_m"] == pytest.approx((0, mobility), abs=0.05)
    before, after = found["household_net_income"]
    assert after == pytest.approx(before, abs=0.05)


def test_a_16_year_olds_standard_and_enhanced_pip_becomes_middle_and_higher_dla():
    dwp = rates()
    found = change(family(16, "STANDARD", "ENHANCED"), *AMOUNTS)
    care = WEEKS * dwp.dla.self_care.middle(DAY)
    mobility = WEEKS * dwp.dla.mobility.higher(DAY)
    assert found["dla_sc"] == pytest.approx((0, care), abs=0.05)
    assert found["dla_m"] == pytest.approx((0, mobility), abs=0.05)
    assert found["pip_dl"][1] == found["pip_m"][1] == 0
    before, after = found["household_net_income"]
    assert after == pytest.approx(before, abs=0.05)


def test_the_passports_that_read_the_dla_category_follow_the_switch():
    found = change(
        family(17, "ENHANCED"),
        "dla_sc_middle_plus",
        "receives_highest_dla_sc",
        "has_highest_dla_sc_award",
        "uc_child_element",
        "universal_credit",
    )
    assert found["dla_sc_middle_plus"] == (0, 1)
    assert found["receives_highest_dla_sc"] == (0, 1)
    assert found["has_highest_dla_sc_award"] == (0, 1)
    # The higher disabled child addition is kept, not gained or lost.
    assert found["uc_child_element"][0] == found["uc_child_element"][1] > 0
    assert found["universal_credit"][0] == pytest.approx(
        found["universal_credit"][1], abs=0.05
    )
    standard = change(
        family(17, "STANDARD"), "dla_sc_middle_plus", "receives_highest_dla_sc"
    )
    assert standard["dla_sc_middle_plus"] == (0, 1)
    assert standard["receives_highest_dla_sc"] == (0, 0)


def test_the_enhanced_disabled_flag_is_not_gained_through_the_switch():
    found = change(family(17, "ENHANCED"), "is_enhanced_disabled_for_benefits")
    assert found["is_enhanced_disabled_for_benefits"] == (0, 0)


@pytest.mark.parametrize("age", [15, 18])
def test_other_ages_are_left_alone(age):
    found = change(family(age, "ENHANCED", "ENHANCED"), *AMOUNTS)
    for variable in AMOUNTS:
        assert found[variable][0] == found[variable][1]


def test_a_17_year_old_already_on_dla_or_with_no_award_is_unchanged():
    on_dla = family(17, dla_sc_category="MIDDLE", dla_m_category="LOWER")
    found = change(on_dla, *AMOUNTS)
    for variable in AMOUNTS:
        assert found[variable][0] == found[variable][1]
    assert found["dla_sc"][0] > 0
    none = change(family(17), *AMOUNTS)
    assert none["dla_sc"] == none["dla_m"] == (0, 0)


def test_scottish_records_are_left_alone_unless_included():
    scotland = family(17, "ENHANCED", "STANDARD", region="SCOTLAND")
    found = change(scotland, *AMOUNTS)
    for variable in AMOUNTS:
        assert found[variable][0] == found[variable][1]
    included = change(scotland, *AMOUNTS, include_scotland=True)
    assert included["pip_dl"][1] == 0 and included["dla_sc"][1] > 0


def test_no_change_before_the_start_year_and_the_default_is_2029():
    found = change(family(17, "ENHANCED"), *AMOUNTS, start_year=YEAR + 1)
    for variable in AMOUNTS:
        assert found[variable][0] == found[variable][1]
    assert dla.REPORT_FIRST_WELFARE_YEAR == 2029


def test_the_report_measure_reads_the_design_start_year(monkeypatch):
    monkeypatch.setattr(design, "REPORT_START_YEAR", YEAR)
    found = change(
        family(17, "ENHANCED"),
        "pip_dl",
        "dla_sc",
        modifier=dla.milburn_child_dla_report,
    )
    assert found["pip_dl"][1] == 0 and found["dla_sc"][1] > 0


@pytest.mark.parametrize("ages", [(15, 18), (16, 16), (16.0, 18)])
def test_ages_below_16_or_out_of_order_are_refused(ages):
    with pytest.raises(ValueError, match="ages"):
        dla.child_dla_report(None, lowest_age=ages[0], age_limit=ages[1])
