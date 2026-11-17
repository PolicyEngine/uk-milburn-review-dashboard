"""The flat files the page reads a package from carry the published
package's combined run, under the manifest's key (#228).

``income_distribution.csv``, ``income_mobility.csv`` and
``income_growth_with_measures.csv`` are read directly by the page. Their
package rows used to be the registry's ``autumn_budget_2026_combined``
(every candidate), whatever the manifest published. Now ``generate --only
income_distribution|income_growth --published-package`` (or ``--combined
ID...``) writes the combined run of exactly the published measures under
``combine.combined_key`` of them, the key the page selects.
"""

import json
from pathlib import Path

import pytest

from uk_budget_data import cli, pipeline
from uk_budget_data.models import DataConfig
from uk_budget_data.publication.combine import combined_key
from uk_budget_data.reforms import AUTUMN_BUDGET_2026_COMBINED_ID

FIXTURE = (
    Path(__file__).resolve().parents[1]
    / "src/test/fixtures/publication/manifest.json"
)
# The eight released measures in the package (Budget day, 28 October 2026:
# the savings and property rates split in two, the savings rates held
# back; the £2 bus fare cap from 29 October), sorted by id.
EIGHT = [
    "bus_fare_cap_2027",
    "carers_allowance_earnings_taper",
    "domestic_electricity_zero_vat",
    "fuel_duty_rise_deferral",
    "household_energy_payment_2026",
    "property_income_rates_up",
    "state_pension_income_tax_protection",
    "trading_allowance_raise",
]


class CapturingRunner:
    """Records the units and returns one distribution row per unit."""

    def __init__(self):
        self.units = []

    def map(self, function, units, on_result=lambda i, r: None):
        assert function is pipeline.run_flat_unit
        self.units = list(units)
        return [
            pipeline.FlatOutcome(
                reform_id=unit.reform.id,
                distribution_rows=[
                    {
                        "reform_id": unit.reform.id,
                        "reform_name": "x",
                        "year": 2027,
                        "side": "baseline",
                        "percentile": 50,
                        "equivalised_net_income": 1,
                    }
                ],
            )
            for unit in self.units
        ]


def test_without_a_package_the_registry_is_run_as_before(tmp_path):
    runner = CapturingRunner()
    pipeline.generate_income_distribution(
        config=DataConfig(output_dir=tmp_path, years=[2027]), runner=runner
    )
    assert runner.units[0].reform.id == AUTUMN_BUDGET_2026_COMBINED_ID


# -- the manifest's package -------------------------------------------------


def manifest_for(ids, *, statuses=None, combined=True, stale_member=None):
    """The fixture manifest with its two approved measures copied to ``ids``
    and its approved combined run copied to their package."""
    fixture = json.loads(FIXTURE.read_text())
    template = fixture["measures"]["alpha"]
    measures = {}
    for i, measure_id in enumerate(ids):
        entry = dict(template, name=measure_id)
        entry["status"] = (statuses or {}).get(measure_id, "provisional")
        entry["outputs_sha256"] = f"{i:064x}"
        measures[measure_id] = entry
    fixture["measures"] = measures
    fixture["combined"] = {}
    if combined:
        entry = dict(
            json.loads(FIXTURE.read_text())["combined"]["combined--alpha+beta"]
        )
        shown = sorted(
            i
            for i in ids
            if measures[i]["status"] in ("approved", "provisional")
        )
        entry["status"] = "provisional"
        entry["measures"] = shown
        entry["member_outputs_sha256"] = {
            i: measures[i]["outputs_sha256"] for i in shown
        }
        if stale_member:
            entry["member_outputs_sha256"][stale_member] = "f" * 64
        fixture["combined"][combined_key(shown)] = entry
    return fixture


def parse(document):
    from uk_budget_data.publication.manifest import parse_manifest

    return parse_manifest(json.dumps(document).encode())


def test_the_published_package_is_the_displayable_measures_and_their_run():
    # A staged measure is not displayable, so not in the package
    ids = [*EIGHT, "alpha"]
    document = manifest_for(ids, statuses={"alpha": "staged"})
    assert cli.published_package(parse(document)) == (EIGHT, EIGHT)


def test_no_package_for_the_displayable_set_is_refused():
    with pytest.raises(ValueError, match="no displayable combined run"):
        cli.published_package(parse(manifest_for(EIGHT, combined=False)))


def test_a_package_whose_member_has_changed_since_is_not_the_package():
    document = manifest_for(EIGHT, stale_member=EIGHT[0])
    with pytest.raises(ValueError, match="no displayable combined run"):
        cli.published_package(parse(document))


def test_one_published_measure_has_no_package():
    assert cli.published_package(
        parse(manifest_for(EIGHT[:1], combined=False))
    ) == (EIGHT[:1], [])


def run_cli(monkeypatch, tmp_path, args):
    calls = {}

    def fake(name):
        def record(reforms=None, config=None, runner=None, **kwargs):
            calls[name] = {
                "reforms": [r.id for r in reforms] if reforms else None,
                "combined_sets": [
                    [r.id for r in members]
                    for members in kwargs.get("combined_sets") or []
                ],
            }

        return record

    for name in (
        "generate_income_distribution",
        "generate_income_growth",
        "generate_age_impact",
    ):
        monkeypatch.setattr(cli, name, fake(name))
    parsed = cli.parse_args(["generate", "--output-dir", str(tmp_path), *args])
    return cli.run_generate(parsed), calls


@pytest.mark.parametrize(
    "args",
    [
        ["--only", "age_impact", "--combined", *EIGHT],
        ["--only", "age_impact", "--published-package"],
        ["--published-package"],
        # Without the manifest's package or --combined, the package rows
        # would be the registry's alias, which the page never reads (#228)
        ["--only", "income_distribution"],
        ["--only", "income_growth"],
        ["--only", "income_growth", "--reforms", EIGHT[0]],
        ["--only", "income_distribution", "--combined", "nonexistent", "x"],
        [
            "--only",
            "income_distribution",
            "--published-package",
            "--reforms",
            EIGHT[0],
        ],
        [
            "--only",
            "income_distribution",
            "--published-package",
            "--manifest",
            "/nonexistent/manifest.json",
        ],
    ],
)
def test_cli_refuses(monkeypatch, tmp_path, args):
    code, calls = run_cli(monkeypatch, tmp_path, args)
    assert code == 1
    assert not calls
