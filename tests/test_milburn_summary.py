"""scripts/milburn_summary.py: the break-even arithmetic is written only for
runs where no 16-24 gains (a withheld gain side counts as none)."""

import csv
import importlib.util
import json
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "milburn_summary.py"
spec = importlib.util.spec_from_file_location("milburn_summary", SCRIPT)
milburn_summary = importlib.util.module_from_spec(spec)
spec.loader.exec_module(milburn_summary)

YEAR = milburn_summary.YEAR
SCENARIOS = {
    "entry_cases": [
        {
            "id": "h16",
            "net_income_gain_package": 5000.0,
            "exchequer_gain_package": 4000.0,
        },
        {
            "id": "h25",
            "net_income_gain_package": 8000.0,
            "exchequer_gain_package": 9000.0,
        },
    ]
}
METRIC_COLUMNS = [
    f"poverty_{k}_change_pp"
    for k in ("rel_bhc", "rel_ahc", "abs_bhc", "abs_ahc")
] + ["child_poverty_rel_ahc_change_pp", "child_poverty_rel_bhc_change_pp"]


def write_csv(path, rows):
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def make_run(tmp_path, better):
    run = tmp_path / "some_run"
    run.mkdir()
    (run / "model_build.json").write_text(
        json.dumps({"label": "test build", "years": [YEAR]})
    )
    write_csv(run / "budgetary_impact.csv", [{"year": YEAR, "value": 2.0}])
    young = {
        "year": YEAR,
        "age_band": "16-24",
        "people": 1_000_000,
        "pct_worse_off": 10.0,
        "pct_better_off": better,
        "mean_change": -100.0,
        "mean_change_worse_off": -1000.0,
    }
    everyone = {
        **young,
        "age_band": "all",
        "people": 60_000_000,
        "pct_better_off": "",
    }
    write_csv(run / "age_impact.csv", [young, everyone])
    write_csv(
        run / "metrics.csv",
        [{"year": YEAR, **{column: 0.1 for column in METRIC_COLUMNS}}],
    )
    return run


@pytest.mark.parametrize("better", [0.0, ""])
def test_break_even_for_runs_where_nobody_gains(tmp_path, better):
    # No 16-24 gains, or the gain side withheld (an empty cell)
    out = milburn_summary.summarise(make_run(tmp_path, better), SCENARIOS)
    assert out["direction"] == "loss"
    # £2bn over 100,000 young people in losing households
    assert out["entrants_to_match_income_loss"] == {
        "h16": 400000,
        "h25": 250000,
    }
    assert out["break_even_share_in_work_pct"] == {"h16": 400.0, "h25": 250.0}
    assert out["exchequer_gain_per_entrant"] == {"h16": 4000.0, "h25": 9000.0}


def test_no_break_even_for_runs_with_gains_as_well_as_losses(tmp_path):
    out = milburn_summary.summarise(make_run(tmp_path, 2.0), SCENARIOS)
    assert out["direction"] == "loss"
    for key in (
        "break_even_share_in_work_pct",
        "entrants_to_match_income_loss",
        "exchequer_gain_per_entrant",
    ):
        assert key not in out
