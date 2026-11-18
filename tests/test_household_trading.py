"""The household calculator's self-employment answers: the head's gross
receipts (turnover) and allowable expenses a year, given to
policyengine-uk as ``self_employment_gross_receipts`` and
``self_employment_income`` (receipts less expenses), so its
``trading_allowance_deduction`` chooses between the trading allowance and
the actual expenses. Household simulations only, no dataset.
"""

import pytest
from fastapi.testclient import TestClient

from uk_budget_data import api, household_impact
from uk_budget_data.api import HouseholdAnswersRequest

MEASURE = "trading_allowance_raise"


def Answers(**values):
    return household_impact.HouseholdAnswers(**values)


@pytest.fixture(autouse=True)
def _fresh_runs():
    household_impact.clear_runs()
    yield
    household_impact.clear_runs()


def test_no_self_employment_by_default_and_the_household_is_built_as_before():
    assert HouseholdAnswersRequest().answers() == Answers()
    for answers in (Answers(), Answers(has_partner=True)):
        people, _, _ = household_impact.household_entities(answers, 2027)
        for person in people:
            assert "self_employment_income" not in person
            assert "self_employment_gross_receipts" not in person


def test_receipts_and_expenses_give_profit_and_receipts():
    people, _, _ = household_impact.household_entities(
        Answers(self_employment_receipts=3_000, self_employment_expenses=500),
        2027,
    )
    assert people[0]["self_employment_gross_receipts"] == 3_000
    assert people[0]["self_employment_income"] == 2_500


@pytest.mark.parametrize(
    "field", ["self_employment_receipts", "self_employment_expenses"]
)
def test_a_negative_amount_is_refused_naming_the_field(field):
    response = TestClient(api.app).post(
        "/api/household-impact",
        json={
            "year": 2027,
            "policies": [MEASURE],
            "household": {field: -1},
            "include": [],
        },
    )
    assert response.status_code == 422
    assert ["body", "household", field] in [
        error["loc"] for error in response.json()["detail"]
    ]


@pytest.mark.parametrize(
    "answers, year, expected",
    [
        ({}, 2027, True),
        ({"self_employment_receipts": 3_000}, 2026, True),
        ({"self_employment_receipts": 3_000}, 2027, False),
        ({"self_employment_expenses": 100}, 2031, False),
    ],
)
def test_the_trading_allowance_is_skipped_only_without_self_employment(
    answers, year, expected
):
    assert (
        household_impact.provably_unaffected(MEASURE, Answers(**answers), year)
        is expected
    )


def _run(year=2027, **values):
    return household_impact.calculate_household_impact(
        Answers(employment_income=30_000, **values),
        [MEASURE],
        year,
        include=("by_policy",),
    )


def _row(result, id_):
    return next(row for row in result["programmes"] if row["id"] == id_)
