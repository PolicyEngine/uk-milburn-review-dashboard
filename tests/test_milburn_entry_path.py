"""The phased move into work (docs/milburn-phased-scenario-design.md): the
shares by year, and who moves in the everyone-moves runs, on single
households in the report's first year."""

import pytest

from tests.test_milburn_measures import change, single
from uk_budget_data import local_build, reforms
from uk_budget_data.budget_measures import milburn_design as design
from uk_budget_data.forecast import forecast_parameters

YEAR = 2029
UC_ONLY = reforms.MILBURN_REPORT_ENTRY_ALL_UC_HEALTH_ID
WITH_PIP = reforms.MILBURN_REPORT_ENTRY_ALL_WITH_PIP_ID
PHASED = reforms.MILBURN_REPORT_PHASED_ENTRY_ALL_UC_HEALTH_ID
CHECK = reforms.MILBURN_REPORT_ENTRY_CHECK_ID
COMPLEMENT = reforms.MILBURN_REPORT_ENTRY_CHECK_COMPLEMENT_ID

engine = pytest.mark.skipif(
    not local_build.engine_matches(),
    reason="household checks pin policyengine-uk 2.177.7",
)


def test_the_shares_follow_table_3_and_start_in_april_2029():
    central = [design.report_entry_share(y) for y in range(2027, 2032)]
    assert central[:2] == [0.0, 0.0]
    assert central[2:] == pytest.approx(
        [0.09 * 0.8 / 5.7, 0.09 * 1.8 / 5.7, 0.09 * 2.8 / 5.7]
    )
    assert central == sorted(central)
    assert all(s <= design.REPORT_ENTRY_EFFECT for s in central)
    unrebased = [
        design.report_entry_share(y, "table3_unrebased")
        for y in range(2029, 2032)
    ]
    assert unrebased == pytest.approx(
        [0.09 * 1.7 / 6.6, 0.09 * 2.7 / 6.6, 0.09 * 3.7 / 6.6]
    )
    assert [design.report_entry_share(y, "flat") for y in (2028, 2029)] == [
        0.0,
        0.09,
    ]
    with pytest.raises(ValueError):
        design.report_entry_share(2029, "no_such_path")


def test_the_design_refuses_a_rebase_year_out_of_step(monkeypatch):
    monkeypatch.setattr(design, "REPORT_ENTRY_REBASE_YEAR", 2027)
    with pytest.raises(ValueError, match="REBASE"):
        design.check_report_design()


def test_the_entry_runs_are_reserved_and_never_listed():
    listed = set(reforms.list_reform_ids())
    for reform_id in reforms.MILBURN_REPORT_ENTRY_RUN_IDS:
        assert reforms.get_reform(reform_id) is not None
        assert reform_id not in listed
        assert reform_id not in reforms.MILBURN_PROMOTED_IDS


def hours_pay(age):
    """16 hours a week for a year at the minimum wage for ``age``, from
    the engine (the run's own arithmetic)."""
    _, earnings = change(
        UC_ONLY, single(age, lcwra=True, year=YEAR), "employment_income", YEAR
    )
    return earnings


@engine
def test_everyone_losing_the_health_element_moves_into_16_hours():
    before, after = change(
        UC_ONLY, single(21, lcwra=True, year=YEAR), "employment_income", YEAR
    )
    assert before == 0
    assert after > 16 * 52 * 10  # above £10 an hour
    for reform_id in (UC_ONLY, WITH_PIP):
        # Before April 2029 nobody moves
        assert change(
            reform_id,
            single(21, lcwra=True, year=2028),
            "employment_income",
            2028,
        ) == (0, 0)


@engine
def test_who_does_not_move():
    cases = {
        "25 or over": single(30, lcwra=True, year=YEAR),
        "in work": single(21, lcwra=True, employment_income=5_000, year=YEAR),
        "no health element, no PIP": single(21, year=YEAR),
        "PIP only, in the health element run": single(21, pip=True, year=YEAR),
    }
    for label, situation in cases.items():
        before, after = change(UC_ONLY, situation, "employment_income", YEAR)
        assert after == before, label


@engine
def test_pip_recipients_move_only_in_the_with_pip_run():
    situation = single(21, pip=True, year=YEAR)
    before, after = change(WITH_PIP, situation, "employment_income", YEAR)
    assert before == 0 and after > 0


@engine
def test_the_move_is_calculated_afresh_not_from_values_read_before_it():
    """The everyone-moves run's household matches the static package's for
    the same household given those earnings: nothing read before the move
    (claimant status, the award) is reused after it. A situation's annual
    earnings come back a little different from the input, so the two are
    compared through the UC taper: the net incomes differ by the earnings
    difference less the taper's share of it (no tax at these earnings)."""
    pay = hours_pay(21)
    moved = [
        change(UC_ONLY, single(21, lcwra=True, year=YEAR), v, YEAR)[1]
        for v in ("household_net_income", "employment_income")
    ]
    given = [
        change(
            "milburn_report_package",
            single(21, lcwra=True, employment_income=pay, year=YEAR),
            v,
            YEAR,
        )[1]
        for v in ("household_net_income", "employment_income")
    ]
    taper = forecast_parameters().gov.dwp.universal_credit.means_test.reduction_rate(
        f"{YEAR}-04-30"
    )
    gap = moved[1] - given[1]
    assert abs(gap) < 0.01 * pay
    assert moved[0] - given[0] == pytest.approx((1 - taper) * gap, abs=0.5)
    # And the health element is removed
    assert (
        change(
            UC_ONLY,
            single(21, lcwra=True, year=YEAR),
            "uc_LCWRA_element",
            YEAR,
        )[1]
        == 0
    )


@engine
def test_the_check_and_its_complement_split_the_group():
    situation = single(21, pip=True, year=YEAR)
    moved = [
        change(reform_id, situation, "employment_income", YEAR)[1] > 0
        for reform_id in (CHECK, COMPLEMENT)
    ]
    assert sorted(moved) == [False, True]


@engine
def test_a_new_entrant_is_reached_and_moves_in_the_phased_run():
    before, after = change(
        PHASED, single(18, lcwra=True, year=YEAR), "employment_income", YEAR
    )
    assert before == 0 and after > 0


def couple(older_has_lcwra, year=YEAR):
    """A married couple on UC, 22 with LCWRA and 30 with or without it."""
    return {
        "people": {
            "young": {
                "age": {year: 22},
                "employment_income": {year: 0},
                "uc_limited_capability_for_WRA": {year: True},
            },
            "older": {
                "age": {year: 30},
                "employment_income": {year: 0},
                "uc_limited_capability_for_WRA": {year: older_has_lcwra},
            },
        },
        "benunits": {
            "b": {"members": ["young", "older"], "is_married": {year: True}}
        },
        "households": {
            "h": {
                "members": ["young", "older"],
                "rent": {year: 6_000},
                "tenure_type": {year: "RENT_PRIVATELY"},
                "region": {year: "NORTH_WEST"},
            }
        },
    }


@engine
@pytest.mark.parametrize("older_has_lcwra", [False, True])
def test_a_young_partner_moves_only_where_the_unit_loses_the_element(
    older_has_lcwra,
):
    """The element is the benefit unit's: a 22-year-old with LCWRA whose
    30-year-old partner also has it keeps the element, so does not move;
    the 30-year-old never moves. (Two people, one benefit unit: person and
    benefit unit arrays are combined correctly.)"""
    for reform_id in (UC_ONLY, WITH_PIP, PHASED):
        before, after = change(
            reform_id, couple(older_has_lcwra), "employment_income", YEAR
        )
        assert before == 0
        if older_has_lcwra:
            assert after == 0, reform_id
        elif reform_id != PHASED:
            assert 0 < after < 16 * 52 * 20, reform_id  # one person's hours
