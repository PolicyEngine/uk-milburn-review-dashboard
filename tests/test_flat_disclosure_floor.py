"""The flat route's floor of survey households (disclosure_floor
``apply_flat_floor``): thin statistics and their partners are blanked and
the count columns never reach the published tables."""

import math

import numpy as np
import pandas as pd

from uk_budget_data.calculators import AgeImpactCalculator
from uk_budget_data.publication.disclosure_floor import (
    apply_flat_floor,
    flat_age_withholding,
    flat_decile_withholding,
    flat_metrics_withholding,
)


def age_row(label, changed=50, worse=50, better=0, direct=0, **extra):
    row = {
        "reform_id": "r",
        "reform_name": "R",
        "year": 2029,
        "age_band": label,
        "people": 1000.0,
        "sample_size": 500,
        "mean_change": -10.0,
        "mean_equivalised_change": -7.0,
        "pct_better_off": 0.0,
        "pct_worse_off": 5.0,
        "pct_unchanged": 95.0,
        "people_directly_affected": 0.0,
        "mean_change_worse_off": -200.0,
        "mean_change_better_off": None,
        "n_survey_households_changed": changed,
        "n_survey_households_worse": worse,
        "n_survey_households_better": better,
        "n_survey_households_direct": direct,
    }
    row.update(extra)
    return row


def test_thin_better_share_takes_unchanged_and_other_mean():
    rows = [age_row("16-24", better=2), age_row("all", better=10)]
    plan = flat_age_withholding(rows)
    assert plan["16-24"] == {
        "pct_better_off",
        "mean_change_better_off",
        "pct_unchanged",
        "mean_change_worse_off",
    }
    # A thin band leaves only "all"
    assert "all" not in plan


def test_thin_single_age_takes_its_band_single_ages():
    rows = [
        age_row("16-24"),
        age_row("all"),
        age_row("20", changed=1, worse=1),
        age_row("21"),
        age_row("30"),
    ]
    plan = flat_age_withholding(rows)
    assert set(plan) == {"20", "21"}
    assert {"mean_change", "pct_worse_off", "pct_unchanged"} <= plan["21"]


def test_thin_other_ages_withhold_band_single_ages():
    rows = [
        age_row("16-24", n_survey_households_changed_other_ages=2),
        age_row("all"),
        age_row("20"),
    ]
    plan = flat_age_withholding(rows)
    assert set(plan) == {"20"}
    assert "mean_change" in plan["20"]


def test_no_change_is_not_thin():
    rows = [age_row("16-24", changed=0, worse=0), age_row("all")]
    assert flat_age_withholding(rows) == {}


def test_decile_thin_takes_all():
    rows = [
        {"decile": "1", "n_survey_households_changed": 2},
        {"decile": "2", "n_survey_households_changed": 40},
        {"decile": "all", "n_survey_households_changed": 42},
    ]
    assert flat_decile_withholding(rows) == {"1", "all"}
    rows[0]["n_survey_households_changed"] = 0
    assert flat_decile_withholding(rows) == set()


def test_metrics_children_and_legacy():
    row = {
        "n_survey_households_poverty_abs_bhc": 2,
        "n_survey_households_child_poverty_rel_ahc": 1,
        "n_survey_households_poverty_rel_ahc": 30,
    }
    assert flat_metrics_withholding(row) == {
        "poverty_abs_bhc_change_pp",
        "poverty_abs_bhc_change_pct",
        "poverty_change_pp",
        "poverty_change_pct",
        "child_poverty_rel_ahc_change_pp",
        "child_poverty_rel_ahc_change_pct",
    }


def test_apply_blanks_cells_and_cuts_counts():
    data = {
        "age_impact": pd.DataFrame(
            [age_row("16-24", better=2), age_row("all", better=10)]
        ),
        "distributional_impact": pd.DataFrame(
            [
                {
                    "reform_id": "r",
                    "reform_name": "R",
                    "year": 2029,
                    "decile": f"{n}th",
                    "value": -0.1,
                    "n_survey_households_changed": 1 if n == 4 else 30,
                }
                for n in range(4, 6)
            ]
        ),
        "winners_losers": pd.DataFrame(
            [
                {
                    "reform_id": "r",
                    "reform_name": "R",
                    "year": 2029,
                    "decile": label,
                    "avg_change": -5.0,
                    "n_survey_households_changed": count,
                }
                for label, count in (("4", 1), ("5", 30), ("all", 31))
            ]
        ),
        "metrics": pd.DataFrame(
            [
                {
                    "reform_id": "r",
                    "reform_name": "R",
                    "year": 2029,
                    "people_affected": 1.0,
                    "poverty_change_pp": 0.1,
                    "poverty_change_pct": 0.5,
                    "poverty_abs_bhc_change_pp": 0.1,
                    "poverty_abs_bhc_change_pct": 0.5,
                    "n_survey_households_poverty_abs_bhc": 2,
                }
            ]
        ),
        "budgetary_impact": pd.DataFrame([{"reform_id": "r", "value": 1.0}]),
    }
    out, counts, withheld = apply_flat_floor(data)
    for table in ("age_impact", "distributional_impact", "metrics"):
        assert not [c for c in out[table] if c.startswith("n_survey")]
    young = out["age_impact"].set_index("age_band").loc["16-24"]
    assert math.isnan(young["pct_better_off"])
    assert math.isnan(young["pct_unchanged"])
    assert young["pct_worse_off"] == 5.0
    assert young["mean_change"] == -10.0
    deciles = out["winners_losers"].set_index("decile")["avg_change"]
    assert math.isnan(deciles["4"]) and math.isnan(deciles["all"])
    assert deciles["5"] == -5.0
    assert math.isnan(out["distributional_impact"]["value"].iloc[0])
    assert math.isnan(out["metrics"]["poverty_change_pp"].iloc[0])
    assert out["metrics"]["people_affected"].iloc[0] == 1.0
    assert out["budgetary_impact"] is data["budgetary_impact"]
    assert set(withheld["table"]) == {
        "age_impact",
        "distributional_impact",
        "winners_losers",
        "metrics",
    }
    assert (withheld[withheld["row"] == "all"]["count"] == "partner").any()
    assert len(counts) > 0


def test_tables_without_counts_pass_unchanged():
    data = {"age_impact": pd.DataFrame([{"reform_id": "r", "year": 1}])}
    out, counts, withheld = apply_flat_floor(data)
    assert counts is None and withheld is None
    assert out["age_impact"] is data["age_impact"]


def test_age_calculator_counts_survey_households_once():
    # Four records cloned from two survey households, one losing
    frame = pd.DataFrame(
        {
            "age": [20, 20, 40, 40],
            "weight": [1.0, 1.0, 1.0, 1.0],
            "decile": [1, 1, 1, 1],
            "baseline_income": [100.0, 100.0, 100.0, 100.0],
            "reform_income": [50.0, 50.0, 100.0, 100.0],
            "baseline_equivalised": [100.0] * 4,
            "reform_equivalised": [100.0] * 4,
            "own_change": [0.0] * 4,
            "survey_household": np.array([7, 7, 8, 8]),
        }
    )
    rows = AgeImpactCalculator().calculate_from_dataframe(
        "r", "R", 2029, frame
    )
    by = {row["age_band"]: row for row in rows}
    assert by["16-24"]["n_survey_households_worse"] == 1
    assert by["all"]["n_survey_households_changed"] == 1
    assert by["35-49"]["n_survey_households_changed"] == 0
