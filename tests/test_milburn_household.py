"""The Milburn Household impact tab: the household answers it adds, its
runs and its stored examples (public/data/milburn_household_presets.json)."""

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from uk_budget_data import household_impact as hi
from uk_budget_data import milburn_household as mh
from uk_budget_data.api import HouseholdAnswersRequest, HouseholdImpactRequest

ROOT = Path(__file__).resolve().parents[1]
PRESETS = ROOT / "public" / "data" / "milburn_household_presets.json"
MILBURN_FIELDS = {
    "uc_limited_capability_for_WRA",
    "pip_dl_category",
    "pip_m_category",
    "sic_industry_division",
    "hours_worked",
}


def _answers(**household) -> hi.HouseholdAnswers:
    return HouseholdAnswersRequest.model_validate(household).answers()


def test_default_answers_set_none_of_the_milburn_inputs():
    people, benunit, household = hi.household_entities(
        hi.HouseholdAnswers(has_partner=True), 2029
    )
    assert not MILBURN_FIELDS & {key for person in people for key in person}
    assert "uc_receives_new_claimant_health_element" not in benunit
    assert household["tenure_type"] == "OWNED_WITH_MORTGAGE"


def test_health_answers_reach_both_adults():
    people, benunit, _ = hi.household_entities(
        _answers(
            has_partner=True,
            limited_capability_for_work_related_activity=True,
            pip_daily_living="ENHANCED",
            partner_limited_capability_for_work_related_activity=True,
            partner_pip_mobility="STANDARD",
            new_claimant_health_element=True,
        ),
        2029,
    )
    assert people[0]["uc_limited_capability_for_WRA"] is True
    assert people[0]["pip_dl_category"] == "ENHANCED"
    assert "pip_m_category" not in people[0]
    assert people[1]["uc_limited_capability_for_WRA"] is True
    assert people[1]["pip_m_category"] == "STANDARD"
    assert benunit["uc_receives_new_claimant_health_element"] is True


def test_new_claim_needs_a_health_element():
    _, benunit, _ = hi.household_entities(
        _answers(new_claimant_health_element=True), 2029
    )
    assert "uc_receives_new_claimant_health_element" not in benunit


def test_living_with_parents_has_no_rent_council_tax_or_tenure():
    _, _, household = hi.household_entities(
        _answers(
            lives_with_parents=True,
            tenure="RENT_PRIVATELY",
            monthly_rent=500,
        ),
        2029,
    )
    assert household["rent"] == 0
    assert household["council_tax"] == 0
    assert "tenure_type" not in household


def test_sector_and_hours():
    people, _, _ = hi.household_entities(
        _answers(employment_sector="HOSPITALITY", hours_worked_per_week=20),
        2029,
    )
    assert people[0]["sic_industry_division"] == 56
    assert people[0]["hours_worked"] == 20 * 52
    people, _, _ = hi.household_entities(
        _answers(employment_sector="RETAIL"), 2029
    )
    assert people[0]["sic_industry_division"] == 47


def test_minimum_wage_pay_is_the_engines_wage_for_the_hours():
    answers = _answers(
        age=23,
        hours_worked_per_week=16,
        earnings_at_minimum_wage=True,
        employment_income=50_000,
    )
    wage = hi.minimum_wage(23, 2029)
    assert 10 < wage < 20
    head, _ = hi.salaries_in(answers, 2029)
    assert head == pytest.approx(wage * 16 * 52, abs=0.01)


def test_request_takes_16_year_olds_and_refuses_bad_answers():
    assert _answers(age=16, pip_daily_living="STANDARD").age == 16
    with pytest.raises(ValidationError):
        HouseholdAnswersRequest.model_validate({"pip_daily_living": "HIGH"})
    with pytest.raises(ValidationError):
        HouseholdAnswersRequest.model_validate(
            {"employment_sector": "FARMING"}
        )
    with pytest.raises(ValidationError, match="hours_worked_per_week"):
        HouseholdAnswersRequest.model_validate(
            {"earnings_at_minimum_wage": True}
        )


def test_the_package_runs_as_its_two_removals():
    sides = hi.measure_sides(["milburn_report_package"])
    assert sides.included == [
        "milburn_report_pip",
        "milburn_report_uc_health",
    ]
    assert len(sides.after["modifiers"]) == 2


def test_every_covered_run_is_a_measure_the_api_takes():
    for run in mh.run_entries(mh.covered_run_ids()):
        request = HouseholdImpactRequest.model_validate(
            {"year": mh.YEAR, "policies": run["policies"]}
        )
        assert request.policies == run["policies"]
        hi.measure_sides(run["policies"])


def test_every_published_run_is_covered_or_has_a_reason():
    measures = json.loads(
        (ROOT / "public" / "data" / "milburn_measures.json").read_text()
    )["measures"]
    computable = {m["id"] for m in measures if m["status"] == "computable"}
    assert computable == set(mh.published_run_ids())
    assert set(mh.NOT_COVERED) <= computable
    assert set(mh.NOTES) <= set(mh.covered_run_ids())
    for entry in mh.coverage():
        assert entry["covered"] == (entry["id"] not in mh.NOT_COVERED)
        if not entry["covered"]:
            assert entry["reason"]


def test_combined_runs_run_as_their_members():
    # Their own modifier is a closure no worker can find
    sides = hi.measure_sides(["milburn_report_package_with_youth_allowance"])
    assert sorted(sides.included) == sorted(
        [
            "milburn_report_uc_health",
            "milburn_report_pip",
            "milburn_report_youth_allowance_independent",
            "milburn_report_youth_allowance_work_allowance",
        ]
    )
    assert hi.measure_sides(["milburn_package"]).included == [
        "pip_removed_under_25",
        "uc_health_element_removed_under_25",
    ]


def test_a_run_not_covered_or_not_published_is_refused():
    with pytest.raises(ValueError, match="does not cover"):
        mh.run_entries(["milburn_report_package_phased"])
    with pytest.raises(ValueError, match="Not a published run"):
        mh.run_entries(["child_dla_to_18"])
    assert mh.run_entries(["milburn_report_pip", "milburn_report_pip"]) == (
        {"key": "milburn_report_pip", "policies": ["milburn_report_pip"]},
    )


def test_every_example_is_a_valid_request():
    assert len(mh.EXAMPLES) == 8
    assert len({example["id"] for example in mh.EXAMPLES}) == 8
    for example in mh.EXAMPLES:
        HouseholdAnswersRequest.model_validate(example["household"])


@pytest.fixture(scope="module")
def presets():
    return json.loads(PRESETS.read_text())


def _change(presets, example_id, run):
    example = next(e for e in presets["examples"] if e["id"] == example_id)
    return example["results"][run]["net_income"]["change"]


def _row(result, row_id):
    for row in result["programmes"]:
        if row["id"] == row_id:
            return row
        for child in row.get("children", []):
            if child["id"] == row_id:
                return child
    return None


def test_presets_hold_the_examples_as_defined(presets):
    assert presets["year"] == mh.YEAR
    assert presets["runs"] == mh.coverage()
    assert [e["id"] for e in presets["examples"]] == [
        e["id"] for e in mh.EXAMPLES
    ]
    for stored, example in zip(presets["examples"], mh.EXAMPLES):
        assert stored["household"] == example["household"]
        assert set(stored["results"]) == set(mh.covered_run_ids())
        current = {
            r["net_income"]["baseline"] for r in stored["results"].values()
        }
        # Every run is against the same current law
        assert len(current) == 1


def test_presets_match_the_earlier_household_examples(presets):
    # The earlier examples (scripts/milburn_household_examples.py, removed
    # with the Measures tab's section) had the same inputs as examples 1,
    # 2 and 6, with no Council Tax
    assert _change(
        presets, "with_parents_health", "milburn_report_package"
    ) == (pytest.approx(-6960.84, abs=0.02))
    assert _change(
        presets, "renting_health", "milburn_report_package"
    ) == pytest.approx(-13095.73, abs=0.02)
    assert _change(
        presets, "renting_health", "milburn_report_youth_allowance_independent"
    ) == pytest.approx(1158.35, abs=0.02)
    assert _change(
        presets,
        "retail_part_time",
        "milburn_report_youth_allowance_independent",
    ) == pytest.approx(1158.35, abs=0.02)
    assert _change(
        presets, "retail_part_time", "milburn_report_employer_nics_threshold"
    ) == (pytest.approx(293.47, abs=0.02))


def test_presets_pass_their_sanity_checks(presets):
    # Above the age limit, and a 17-year-old (PIP removal is for 18 to 24)
    assert _change(presets, "renting_health_25", "milburn_report_package") == 0
    assert _change(presets, "college_17", "milburn_report_package") == 0
    # A couple whose partner is 25 or over keeps the health element
    couple = next(
        e for e in presets["examples"] if e["id"] == "couple_partner_health"
    )["results"]["milburn_report_package"]
    assert _row(couple, "uc_lcwra_element")["baseline"] > 0
    assert _row(couple, "uc_lcwra_element")["change"] == 0
    # The package removes the health element and PIP
    renter = next(
        e for e in presets["examples"] if e["id"] == "renting_health"
    )["results"]["milburn_report_package"]
    assert _row(renter, "uc_lcwra_element")["reform"] == 0
    assert _row(renter, "pip")["reform"] == 0
    # The part-time retail worker gains from the work allowance
    assert (
        _change(
            presets,
            "retail_part_time",
            "milburn_report_youth_allowance_work_allowance",
        )
        > 0
    )


def test_presets_carry_no_record_level_ids(presets):
    text = PRESETS.read_text()
    for name in ("household_id", "person_id", "benunit_id", "_weight"):
        assert name not in text


def test_default_answers_show_no_health_or_pip_rows():
    result = hi.calculate_household_impact(
        hi.HouseholdAnswers(),
        ["milburn_report_uc_health"],
        2029,
        include=(),
    )
    assert _row(result, "pip") is None
    assert _row(result, "uc_lcwra_element") is None
    assert _row(result, "uc_standard_allowance") is not None


def test_the_employer_ni_saving_shows_as_higher_pay(presets):
    worker = next(
        e for e in presets["examples"] if e["id"] == "retail_part_time"
    )["results"]["milburn_report_employer_nics_threshold"]
    assert _row(worker, "employment_income")["change"] > 0
    assert _row(worker, "universal_credit")["change"] < 0


def test_presets_follow_each_run(presets):
    # The package equals its two removals' split; the pre-report package
    # (from April 2027) matches the report's in 2029-30
    assert _change(presets, "renting_health", "milburn_package") == (
        pytest.approx(
            _change(presets, "renting_health", "milburn_report_package"),
            abs=0.02,
        )
    )
    # Health element removal under 22 leaves a 22-year-old alone
    assert (
        _change(
            presets, "renting_health", "uc_health_element_removed_under_22"
        )
        == 0
    )
    # The zero rate for under-25s passes the employer's saving to pay
    assert (
        _change(presets, "retail_part_time", "employer_nics_zero_under_25") > 0
    )
    # The glide path's 2029-30 step is below the end state
    assert (
        0
        < _change(
            presets,
            "retail_part_time",
            "milburn_report_employer_nics_threshold_glide_path",
        )
        < _change(
            presets,
            "retail_part_time",
            "milburn_report_employer_nics_threshold",
        )
    )
