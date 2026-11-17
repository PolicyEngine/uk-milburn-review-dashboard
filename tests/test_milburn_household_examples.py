"""scripts/milburn_household_examples.py: one household case, recomputed,
and the published file's shape."""

import importlib.util
import json
from pathlib import Path

import pytest

from uk_budget_data import local_build

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "milburn_household_examples.py"
PUBLISHED = ROOT / "public" / "data" / "milburn_households.json"
PACKAGE = "milburn_report_package"


def _script():
    spec = importlib.util.spec_from_file_location("household_examples", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_breakdown_lines_add_up_to_the_change_in_net_income():
    script = _script()
    current = dict.fromkeys(script.COMPONENTS, 0.0)
    current.update(
        net_income=14_000.0,
        universal_credit=10_000.0,
        uc_health_element=5_000.0,
        uc_standard_allowance=4_000.0,
        pip=4_000.0,
    )
    reformed = dict(
        current,
        net_income=5_000.0,
        universal_credit=5_000.0,
        uc_health_element=0.0,
        pip=0.0,
    )
    lines = script.breakdown(current, reformed)
    assert [(line["id"], line["change"]) for line in lines] == [
        ("uc_health_element", -5_000.0),
        ("pip", -4_000.0),
    ]
    # Anything the named lines miss is shown, not dropped
    reformed["net_income"] = 4_900.0
    assert script.breakdown(current, reformed)[-1] == {
        "id": "other",
        "label": "Other",
        "change": -100.0,
    }


def test_published_file_shape():
    script = _script()
    published = json.loads(PUBLISHED.read_text())
    assert published["year"] == script.YEAR
    assert published["label"] == script.LABEL
    assert published["package_id"] == PACKAGE
    assert published["runs"] == script.run_list()
    assert [
        run["id"] for run in published["runs"] if not run["part_of_package"]
    ] == [
        "milburn_report_youth_allowance_independent",
        "milburn_report_employer_nics_threshold",
    ]
    assert [h["id"] for h in published["households"]] == [
        case["id"] for case in script.CASES
    ]
    for household in published["households"]:
        assert set(household["runs"]) == {run_id for run_id, _ in script.RUNS}
        for run in household["runs"].values():
            total = sum(line["change"] for line in run["breakdown"])
            assert total == pytest.approx(run["net_income_change"], abs=0.05)
            assert all(
                abs(line["change"]) >= 0.05 for line in run["breakdown"]
            )
            assert run["applies"] == (abs(run["net_income_change"]) >= 0.005)


@pytest.mark.skipif(
    not local_build.engine_matches(),
    reason="recomputes on policyengine-uk 2.177.7",
)
def test_one_case_recomputed_matches_the_published_file():
    """The 20-year-old living with parents under the package: the health
    element and PIP go, and nothing else changes."""
    script = _script()
    case = script.CASES[0]
    example = script.household_example(case, run_ids=(PACKAGE,))
    current = example["current_law"]
    run = example["runs"][PACKAGE]
    assert current["uc_health_element"] > 0 and current["pip"] > 0
    assert run["applies"] is True
    assert run["components"]["uc_health_element"] == 0
    assert run["components"]["pip"] == 0
    assert run["net_income_change"] == pytest.approx(
        -(current["uc_health_element"] + current["pip"]), abs=0.02
    )
    assert [line["id"] for line in run["breakdown"]] == [
        "uc_health_element",
        "pip",
    ]
    published = next(
        household
        for household in json.loads(PUBLISHED.read_text())["households"]
        if household["id"] == case["id"]
    )
    assert published["current_law"] == current
    assert published["runs"][PACKAGE] == run
