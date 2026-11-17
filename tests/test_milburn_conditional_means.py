"""Conditional household income changes for young people, on synthetic records."""

import csv
import json
import runpy
from pathlib import Path

import pandas as pd
import pytest
from hypothesis import given
from hypothesis import strategies as st

from uk_budget_data.calculators import AgeImpactCalculator

summarise = runpy.run_path(
    str(Path(__file__).resolve().parents[1] / "scripts" / "milburn_summary.py")
)["summarise"]


def young_row(records):
    # Each synthetic record describes one young person and their household.
    frame = pd.DataFrame(
        records, columns=["survey_household", "weight", "change"]
    )
    frame["age"] = 22
    frame["decile"] = 5
    frame["baseline_income"] = 20_000
    frame["reform_income"] = frame["baseline_income"] + frame["change"]
    frame["baseline_equivalised"] = frame["baseline_income"]
    frame["reform_equivalised"] = frame["reform_income"]
    frame["own_change"] = 0
    rows = AgeImpactCalculator().calculate_from_dataframe(
        "test", "Test", 2029, frame
    )
    return next(row for row in rows if row["age_band"] == "16-24")


@given(scale=st.integers(1, 12), large_gain=st.integers(100, 5000))
def test_conditional_means_follow_each_group_and_person_weights(
    scale, large_gain
):
    # Two young people share household A; the household's income change is
    # attributed in full to each. Uniform weight scaling leaves both means fixed.
    records = [
        ("A", 2, -100),
        ("A", 2, -100),
        ("B", 1, -400),
        ("C", 3, -200),
        ("D", 2, 50),
        ("E", 2, 50),
        ("F", 1, large_gain),
        ("G", 1, 1),
        ("H", 1, 1),
        ("I", 1, 1),
    ]
    young = young_row(
        [
            (source, weight * scale, amount)
            for source, weight, amount in records
        ]
    )
    assert young["mean_change_worse_off"] == pytest.approx(-1400 / 8)
    assert young["mean_change_better_off"] == pytest.approx(
        (200 + large_gain) / 5
    )
    assert young["mean_change"] * 16 == pytest.approx(
        8 * young["mean_change_worse_off"]
        + 5 * young["mean_change_better_off"]
        + 3
    )


def test_one_thin_group_cannot_be_recovered_by_subtraction():
    # Six gaining people are clones of just two survey households.
    base = [
        ("A", 1, -100),
        ("B", 1, -200),
        ("C", 1, -300),
        ("D", 1, 40),
        ("E", 1, 60),
        ("D", 3, 40),
        ("E", 1, 60),
    ]
    young = young_row(base)
    assert young["mean_change_better_off"] is None
    assert young["mean_change_worse_off"] is None
    # With a third independent contributor to the hidden residual (a £1
    # change inside the unchanged band), the losing mean can be released.
    young = young_row(base + [("F", 2, 1)])
    assert young["mean_change_better_off"] is None
    assert young["mean_change_worse_off"] == -200


def test_empty_groups_and_thin_subthreshold_residual():
    losses = [("A", 1, -100), ("B", 1, -200), ("C", 1, -300)]
    young = young_row(losses + [("D", 0, 70)])
    assert young["mean_change_worse_off"] == -200
    assert young["mean_change_better_off"] is None
    young = young_row(
        losses + [("D", 2, 100), ("E", 2, 200), ("F", 2, 300), ("G", 1, 1)]
    )
    # Both directions clear the floor, but publishing both would reveal G's £1.
    assert young["mean_change_worse_off"] is None
    assert young["mean_change_better_off"] == 200


def test_summary_uses_only_verified_conditional_fields(tmp_path):
    def write_csv(name, rows):
        with (tmp_path / name).open("w", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)

    (tmp_path / "model_build.json").write_text(
        json.dumps({"label": "Synthetic"})
    )
    write_csv("budgetary_impact.csv", [{"year": 2029, "value": 1}])
    metrics = {
        f"{group}poverty_{basis}_change_pp": 0
        for group in ("", "child_")
        for basis in ("rel_bhc", "rel_ahc", "abs_bhc", "abs_ahc")
    }
    write_csv("metrics.csv", [{"year": 2029, **metrics}])
    cases = {
        "entry_cases": [
            {
                "id": "h16",
                "net_income_gain_package": 1000,
                "exchequer_gain_package": 100,
            }
        ]
    }

    def from_ages(young):
        write_csv("age_impact.csv", [young, {**young, "age_band": "all"}])
        return summarise(tmp_path, cases)

    young = {
        "age_band": "16-24",
        "year": 2029,
        "people": 100,
        "mean_change": -80,
        "pct_worse_off": 50,
        "pct_better_off": 10,
    }
    key = "mean_household_change_for_young_people_in_selected_group"
    old = from_ages(young)
    assert old[key] is None
    assert old["young_people_in_losing_households"] == 50
    assert "entrants_to_match_exchequer_saving" not in old
    new = from_ages(
        {
            **young,
            "mean_change_worse_off": -200.25,
            "mean_change_better_off": 200,
        }
    )
    assert new[key] == -200
    assert (
        from_ages(
            {**young, "pct_better_off": 60, "mean_change_better_off": 200}
        )[key]
        == 200
    )
    one_direction = from_ages({**young, "pct_better_off": 0})
    assert (
        one_direction[key] is None
    )  # A nonzero subthreshold change is still possible.
    assert (
        one_direction["entrants_to_match_exchequer_saving"]["h16"] == 1_000_000
    )
