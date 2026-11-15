"""The Milburn review measures on single households in 2027-28.

Each test builds the household as the national run builds its simulations
(``personal_impact.household_simulations``: current law on the forecast,
and the measure's scenario) and checks the annual change against hand
arithmetic on the engine's 2027-28 parameters (policyengine-uk 2.177.7,
OBR October 2026 forecast), whose values are written out here.
"""

import warnings

import pytest

from uk_budget_data import local_build
from uk_budget_data.forecast import forecast_parameters
from uk_budget_data.models import DataConfig
from uk_budget_data.personal_impact import household_simulations
from uk_budget_data.reforms import (
    EMPLOYER_NICS_UNDER_25_ID,
    MILBURN_PACKAGE_COMPONENTS,
    MILBURN_PACKAGE_ID,
    NOT_COMPUTABLE_MEASURES,
    PIP_UNDER_25_ID,
    UC_HEALTH_UNDER_25_ID,
    UC_HEALTH_UNDER_25_NEW_CLAIMS_ID,
    YOUTH_ALLOWANCE_ID,
    get_reform,
    list_reform_ids,
)

YEAR = 2027
DAY = f"{YEAR}-04-30"
# 2027-28, monthly (UC) or weekly (PIP), read from the engine below.
PROTECTED_LCWRA = 442.103151  # s. 4 floor, from £429.80 in 2026-27
NEW_CLAIMANT_LCWRA = 217.26  # frozen to 2029-30 (UC Act 2025 s. 3)
SINGLE_UNDER_25 = 353.170149
SINGLE_25_PLUS = 443.209866
PIP_DL_STANDARD = 79.384373
PIP_M_ENHANCED = 82.799868
EMPLOYER_RATE = 0.15
SECONDARY_THRESHOLD = 5_000

pytestmark = pytest.mark.skipif(
    not local_build.engine_matches(),
    reason="pins policyengine-uk 2.177.7's 2027-28 amounts",
)


def single(
    age,
    lcwra=False,
    rent=6_000,
    employment_income=0,
    region="NORTH_WEST",
    new_claimant=None,
    pip=False,
):
    person = {
        "age": {YEAR: age},
        "employment_income": {YEAR: employment_income},
        "uc_limited_capability_for_WRA": {YEAR: lcwra},
    }
    if pip:
        person["pip_dl_category"] = {YEAR: "STANDARD"}
        person["pip_m_category"] = {YEAR: "ENHANCED"}
    benunit = {"members": ["p"]}
    if new_claimant is not None:
        benunit["uc_receives_new_claimant_health_element"] = {
            YEAR: new_claimant
        }
    return {
        "people": {"p": person},
        "benunits": {"b": benunit},
        "households": {
            "h": {
                "members": ["p"],
                "rent": {YEAR: rent},
                "tenure_type": {YEAR: "RENT_PRIVATELY"},
                "region": {YEAR: region},
            }
        },
    }


def change(reform_id, situation, variable="household_net_income"):
    """(current law, measure) annual values of ``variable`` in 2027-28."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        baseline, reformed = household_simulations(
            situation, get_reform(reform_id), DataConfig()
        )
        return (
            float(baseline.calculate(variable, YEAR).sum()),
            float(reformed.calculate(variable, YEAR).sum()),
        )


def test_the_hand_arithmetic_uses_the_engines_2027_amounts():
    p = forecast_parameters()
    uc = p.gov.dwp.universal_credit
    amounts = uc.standard_allowance.amount
    assert amounts.SINGLE_YOUNG(DAY) == pytest.approx(SINGLE_UNDER_25)
    assert amounts.SINGLE_OLD(DAY) == pytest.approx(SINGLE_25_PLUS)
    assert uc.rebalancing.new_claimant_health_element(DAY) == pytest.approx(
        NEW_CLAIMANT_LCWRA
    )
    assert p.gov.dwp.pip.daily_living.standard(DAY) == pytest.approx(
        PIP_DL_STANDARD
    )
    assert p.gov.dwp.pip.mobility.enhanced(DAY) == pytest.approx(
        PIP_M_ENHANCED
    )
    # The protected amount is the UC Act 2025 s. 4 floor: the 2026-27
    # amount (£429.80) plus a standard allowance, raised by September 2026
    # CPI, less 2027-28's allowance; the single under-25 pair binds.
    cpi = 1 + float(
        p.gov.economic_assumptions.statutory_uprating_inputs.cpi_september(
            "2026-09-01"
        )
    )
    assert (429.80 + 338.58) * cpi - SINGLE_UNDER_25 == pytest.approx(
        PROTECTED_LCWRA, abs=0.01
    )


# Health element removed for under-25s, every claimant


def test_a_22_year_old_lcwra_renter_loses_the_protected_element():
    before, after = change(UC_HEALTH_UNDER_25_ID, single(22, lcwra=True))
    # 12 x £442.10 = £5,305.24 a year, all of it lost.
    assert before - after == pytest.approx(12 * PROTECTED_LCWRA, abs=0.05)
    assert before - after == pytest.approx(5_305.24, abs=0.05)
    assert (
        change(
            UC_HEALTH_UNDER_25_ID, single(22, lcwra=True), "uc_LCWRA_element"
        )[1]
        == 0
    )


def test_the_same_claimant_aged_26_is_unchanged():
    before, after = change(UC_HEALTH_UNDER_25_ID, single(26, lcwra=True))
    assert after == pytest.approx(before)
    element = change(
        UC_HEALTH_UNDER_25_ID, single(26, lcwra=True), "uc_LCWRA_element"
    )
    assert element[1] == pytest.approx(12 * PROTECTED_LCWRA, abs=0.05)


def test_a_new_claimant_aged_22_loses_the_new_claimant_rate():
    situation = single(22, lcwra=True, new_claimant=True)
    before, after = change(UC_HEALTH_UNDER_25_ID, situation)
    # 12 x £217.26 = £2,607.12
    assert before - after == pytest.approx(2_607.12, abs=0.05)


# Health element removed for under-25s, new claims only


def test_new_claims_only_spares_a_protected_claimant():
    before, after = change(
        UC_HEALTH_UNDER_25_NEW_CLAIMS_ID, single(22, lcwra=True)
    )
    assert after == pytest.approx(before)


def test_new_claims_only_removes_the_new_claimant_rate():
    situation = single(22, lcwra=True, new_claimant=True)
    before, after = change(UC_HEALTH_UNDER_25_NEW_CLAIMS_ID, situation)
    assert before - after == pytest.approx(12 * NEW_CLAIMANT_LCWRA, abs=0.05)
    older = single(26, lcwra=True, new_claimant=True)
    before, after = change(UC_HEALTH_UNDER_25_NEW_CLAIMS_ID, older)
    assert after == pytest.approx(before)


# PIP removed for 18 to 24-year-olds


@pytest.mark.parametrize("region", ["NORTH_WEST", "SCOTLAND"])
def test_a_20_year_old_loses_standard_daily_living_and_enhanced_mobility(
    region,
):
    situation = single(20, rent=0, region=region, pip=True)
    before, after = change(PIP_UNDER_25_ID, situation)
    # 52 x (£79.38 + £82.80) = £8,433.58; Scotland's records too.
    assert before - after == pytest.approx(
        52 * (PIP_DL_STANDARD + PIP_M_ENHANCED), abs=0.05
    )
    assert before - after == pytest.approx(8_433.58, abs=0.05)
    assert change(PIP_UNDER_25_ID, situation, "pip")[1] == 0


def test_a_17_year_old_keeps_pip():
    situation = single(17, rent=0, pip=True)
    before, after = change(PIP_UNDER_25_ID, situation, "pip")
    assert after == pytest.approx(before) and before > 0


# Employer NICs zero rate extended to under-25s


def test_a_23_year_old_on_20000_pays_no_employer_nics():
    situation = single(23, rent=0, employment_income=20_000)
    before, after = change(
        EMPLOYER_NICS_UNDER_25_ID, situation, "ni_class_1_employer"
    )
    # 15% x (£20,000 - £5,000) = £2,250, now nil.
    assert before == pytest.approx(
        EMPLOYER_RATE * (20_000 - SECONDARY_THRESHOLD), abs=0.5
    )
    assert after == 0
    # The engine passes employer NICs through to pay: £2,250 more pay, less
    # 20% income tax and 8% employee NICs, is £1,620 more net income.
    pay = change(EMPLOYER_NICS_UNDER_25_ID, situation, "employment_income")
    assert pay[1] - pay[0] == pytest.approx(2_250, abs=0.5)
    before, after = change(EMPLOYER_NICS_UNDER_25_ID, situation)
    assert after - before == pytest.approx(2_250 * (1 - 0.20 - 0.08), abs=1)


def test_a_26_year_old_employee_is_unchanged():
    situation = single(26, rent=0, employment_income=20_000)
    before, after = change(
        EMPLOYER_NICS_UNDER_25_ID, situation, "ni_class_1_employer"
    )
    assert after == pytest.approx(before) and before > 0


# Youth allowance at the 25-and-over rate


def test_a_21_year_old_jobseeker_gets_the_25_plus_standard_allowance():
    situation = single(21)
    before, after = change(YOUTH_ALLOWANCE_ID, situation)
    # 12 x (£443.21 - £353.17) = £1,080.48
    assert after - before == pytest.approx(
        12 * (SINGLE_25_PLUS - SINGLE_UNDER_25), abs=0.05
    )
    assert after - before == pytest.approx(1_080.48, abs=0.05)


@pytest.mark.parametrize("lcwra", [False, True])
def test_a_26_year_old_is_unchanged_by_the_youth_allowance(lcwra):
    """The protected element's s. 4 floor reads the under-25 allowances;
    the measure holds it at current law's, so older claimants are
    untouched."""
    before, after = change(YOUTH_ALLOWANCE_ID, single(26, lcwra=lcwra))
    assert after == pytest.approx(before, abs=0.01)


# The package and the registry


def test_the_package_removes_both_for_a_20_year_old():
    situation = single(20, lcwra=True, pip=True)
    before, after = change(MILBURN_PACKAGE_ID, situation)
    # PIP daily living exempts a single renter under 35 from the shared
    # accommodation rate, so the housing element falls too: from the rent
    # (£6,000) to the shared accommodation rate (£4,938.96).
    housing = change(MILBURN_PACKAGE_ID, situation, "uc_housing_costs_element")
    assert housing == pytest.approx((6_000, 4_938.96), abs=0.05)
    assert before - after == pytest.approx(
        12 * PROTECTED_LCWRA
        + 52 * (PIP_DL_STANDARD + PIP_M_ENHANCED)
        + (6_000 - 4_938.96),
        abs=0.1,
    )
    assert before - after == pytest.approx(14_799.86, abs=0.1)


def test_the_registry_holds_the_milburn_measures_only():
    assert list_reform_ids() == [
        MILBURN_PACKAGE_ID,
        "milburn_package_central",
        UC_HEALTH_UNDER_25_ID,
        UC_HEALTH_UNDER_25_NEW_CLAIMS_ID,
        PIP_UNDER_25_ID,
        YOUTH_ALLOWANCE_ID,
        EMPLOYER_NICS_UNDER_25_ID,
        "uc_health_element_removed_under_22",
        "uc_health_element_removed_under_25_severe_kept",
        "pip_halved_under_25",
    ]
    assert MILBURN_PACKAGE_COMPONENTS == (
        UC_HEALTH_UNDER_25_ID,
        PIP_UNDER_25_ID,
    )


def test_not_computable_measures_carry_a_reason_and_no_reform():
    ids = {m.id for m in NOT_COMPUTABLE_MEASURES}
    assert ids == {
        "severe_conditions_higher_rate",
        "additional_cost_allowance",
        "youth_conditionality",
        "youth_guarantee_expansion",
    }
    for measure in NOT_COMPUTABLE_MEASURES:
        assert measure.status == "not_computable" and measure.reason
        assert get_reform(measure.id) is None


def test_the_entry_to_work_scenarios():
    from uk_budget_data.milburn_scenarios import milburn_scenarios

    result = milburn_scenarios()
    assert result["year"] == 2027
    assert [c["id"] for c in result["entry_cases"]] == ["h16", "h25"]
    for case in result["entry_cases"]:
        # The National Living Wage for 2027-28 (from age 21): £13.21.
        assert case["hourly_wage"] == 13.21
        assert case["annual_earnings"] == pytest.approx(
            13.21 * case["hours"] * 52
        )
        assert case["net_income_gain_current_law"] > 0
        assert case["exchequer_gain_current_law"] > 0
        # The element is lost in and out of work while UC stays in payment.
        assert case["net_income_gain_package"] == pytest.approx(
            case["net_income_gain_current_law"], abs=0.05
        )
    h16 = result["entry_cases"][0]
    # Employer NICs, 15% above £5,000, are in the Exchequer gain.
    assert h16["exchequer_gain_current_law"] > EMPLOYER_RATE * (
        h16["annual_earnings"] - SECONDARY_THRESHOLD
    )


def couple(older_has_lcwra):
    return {
        "people": {
            "young": {
                "age": {YEAR: 22},
                "uc_limited_capability_for_WRA": {YEAR: True},
            },
            "older": {
                "age": {YEAR: 30},
                "uc_limited_capability_for_WRA": {YEAR: older_has_lcwra},
            },
        },
        "benunits": {
            "b": {"members": ["young", "older"], "is_married": {YEAR: True}}
        },
        "households": {
            "h": {
                "members": ["young", "older"],
                "rent": {YEAR: 6_000},
                "tenure_type": {YEAR: "RENT_PRIVATELY"},
                "region": {YEAR: "NORTH_WEST"},
            }
        },
    }


@pytest.mark.parametrize("older_has_lcwra", [False, True])
def test_a_couple_keeps_the_element_only_through_a_claimant_aged_25_plus(
    older_has_lcwra,
):
    before, after = change(
        UC_HEALTH_UNDER_25_ID, couple(older_has_lcwra), "uc_LCWRA_element"
    )
    assert before == pytest.approx(12 * PROTECTED_LCWRA, abs=0.05)
    assert after == pytest.approx(before if older_has_lcwra else 0)


# Variants added 15 Nov 2026: under-22 age limit, severe cases kept,
# PIP at half rate.


def test_under_22_removes_the_element_at_21_but_not_at_23():
    lost_21 = change("uc_health_element_removed_under_22", single(21, lcwra=True))
    assert lost_21[0] - lost_21[1] == pytest.approx(12 * PROTECTED_LCWRA, abs=0.05)
    lost_23 = change("uc_health_element_removed_under_22", single(23, lcwra=True))
    assert lost_23[0] == pytest.approx(lost_23[1], abs=0.01)


def _with_dl(situation, category):
    situation["people"]["p"]["pip_dl_category"] = {YEAR: category}
    situation["people"]["p"]["pip_m_category"] = {YEAR: "NONE"}
    return situation


def test_severe_cases_kept_spares_an_enhanced_daily_living_award():
    rid = "uc_health_element_removed_under_25_severe_kept"
    kept = change(rid, _with_dl(single(22, lcwra=True), "ENHANCED"), "uc_LCWRA_element")
    assert kept[1] == pytest.approx(kept[0], abs=0.01) and kept[0] > 0
    lost = change(rid, _with_dl(single(22, lcwra=True), "STANDARD"), "uc_LCWRA_element")
    assert lost[1] == 0 and lost[0] > 0


def test_pip_at_half_rate_halves_a_20_year_olds_award():
    before, after = change("pip_halved_under_25", single(20, rent=0, pip=True))
    assert before - after == pytest.approx(8_433.58 / 2, abs=0.05)


def test_the_central_package_is_registered():
    assert "milburn_package_central" in list_reform_ids()
