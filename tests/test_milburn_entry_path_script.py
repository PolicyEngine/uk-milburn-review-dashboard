"""scripts/milburn_entry_path.py on made-up runs: the scaling, the floor
on derived figures, the linearity check and the refusals."""

import csv
import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "milburn_entry_path", ROOT / "scripts" / "milburn_entry_path.py"
)
script = importlib.util.module_from_spec(spec)
spec.loader.exec_module(script)

BUILD = {
    "label": "build x",
    "build": "x",
    "dataset_sha256": "abc",
    "engine": {"policyengine-uk": "1"},
    "certified": True,
    "policyengine": "1",
}


def write(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def make_run(folder, saving, pp, losing, movers, counts, build=BUILD):
    """A run whose figures are ``saving``, ``pp`` (both poverty measures),
    ``losing`` (16-24 % worse off) and ``movers`` from 2029 (zero before),
    and whose private counts are ``counts`` (direct, poverty, worse)."""
    folder.mkdir(parents=True)
    (folder / "model_build.json").write_text(json.dumps(build))
    years = range(2027, 2032)
    on = lambda y, v: v if y >= 2029 else 0  # noqa: E731
    write(
        folder / "budgetary_impact.csv",
        [
            {"reform_id": folder.name, "year": y, "value": on(y, saving)}
            for y in years
        ],
    )
    write(
        folder / "metrics.csv",
        [
            {
                "reform_id": folder.name,
                "year": y,
                "poverty_abs_bhc_change_pp": on(y, pp),
                "poverty_rel_ahc_change_pp": on(y, pp),
            }
            for y in years
        ],
    )
    age = []
    for y in years:
        for band in ("all", "16-24"):
            age.append(
                {
                    "reform_id": folder.name,
                    "year": y,
                    "age_band": band,
                    "people": 70_000_000 if band == "all" else 7_500_000,
                    "pct_worse_off": on(y, losing),
                    "people_directly_affected": on(y, movers),
                }
            )
    write(folder / "age_impact.csv", age)
    direct, poverty, worse = counts
    rows = []
    for y in years:
        live = y >= 2029
        rows += [
            {
                "table": "age_impact",
                "reform_id": folder.name,
                "year": y,
                "row": "all",
                "column": "direct",
                "count": direct if live else 0,
            },
            {
                "table": "age_impact",
                "reform_id": folder.name,
                "year": y,
                "row": "16-24",
                "column": "worse",
                "count": worse if live else 0,
            },
        ]
        for m in ("abs_bhc", "rel_ahc"):
            rows.append(
                {
                    "table": "metrics",
                    "reform_id": folder.name,
                    "year": y,
                    "row": "all",
                    "column": f"poverty_{m}",
                    "count": poverty if live else 0,
                }
            )
    write(folder / script.COUNTS_FILE, rows)


@pytest.fixture
def staged(tmp_path):
    static = tmp_path / "s" / "milburn_report_package"
    phased = tmp_path / "s" / "milburn_report_package_phased"
    make_run(static, 4.0, 1.0, 10.0, 0, (0, 50, 170))
    make_run(phased, 2.0, 0.5, 6.0, 0, (0, 30, 100))
    runs = tmp_path / "r"
    make_run(runs / script.UC_ONLY, 5.0, 0.6, 8.0, 100_000, (60, 40, 150))
    make_run(runs / script.WITH_PIP, 5.5, 0.4, 7.0, 300_000, (160, 35, 140))
    make_run(runs / script.PHASED, 2.5, 0.3, 5.0, 40_000, (25, 20, 90))
    # 25% and the complement: increments 0.25 and 0.75 of the with-PIP one
    make_run(runs / script.CHECK, 4.375, 0.85, 9.25, 75_000, (40, 45, 160))
    make_run(
        runs / script.COMPLEMENT, 5.125, 0.55, 7.75, 225_000, (120, 38, 145)
    )
    return tmp_path, static, phased, runs


def run_script(staged):
    tmp_path, static, phased, runs = staged
    out = tmp_path / "out.json"
    script.main(
        [
            "--static",
            str(static),
            "--static-phased",
            str(phased),
            "--runs",
            str(runs),
            "--output",
            str(out),
        ]
    )
    return json.loads(out.read_text())


def path(data, path_id):
    return next(p for p in data["paths"] if p["id"] == path_id)


def test_figures_are_static_plus_share_times_the_increment(staged):
    data = run_script(staged)
    central = path(data, "central")["years"]
    share = central["2029"]["share"]
    assert share == pytest.approx(0.09 * 0.8 / 5.7, abs=1e-6)
    assert central["2029"]["exchequer_bn"]["scenario"] == pytest.approx(
        4.0 + share * 1.0, abs=1e-5
    )
    assert central["2029"]["poverty_pp_abs_bhc"]["scenario"] == pytest.approx(
        1.0 - share * 0.4, abs=1e-5
    )
    assert central["2029"]["movers"] == round(share * 100_000 / 1000) * 1000
    assert central["2028"] == {"share": 0.0, "movers": 0, "no_change": True}
    flat = path(data, "flat")["years"]["2030"]
    assert flat["exchequer_bn"]["scenario"] == pytest.approx(4.09)
    rollout = path(data, "rollout")["years"]["2031"]
    assert rollout["exchequer_bn"]["scenario"] == pytest.approx(
        2.0 + 0.09 * 0.5
    )
    assert data["linearity_check"]["failed"] == []


def test_a_thin_difference_is_withheld(staged):
    tmp_path, static, phased, runs = staged
    # The with-PIP run's poverty counts within 2 of the health element run's
    counts = runs / script.WITH_PIP / script.COUNTS_FILE
    text = counts.read_text().replace(
        ",poverty_abs_bhc,35", ",poverty_abs_bhc,41"
    )
    counts.write_text(text)
    data = run_script(staged)
    with_pip = path(data, "with_pip")["years"]["2029"]
    assert with_pip["poverty_pp_abs_bhc"]["scenario"] is None
    assert with_pip["poverty_pp_rel_ahc"]["scenario"] is not None
    assert any(
        w["path"] == "with_pip" and w["figure"] == "poverty_pp_abs_bhc"
        for w in data["withheld"]
    )


def test_a_failed_linearity_check_withholds_the_figure(staged):
    tmp_path, static, phased, runs = staged
    budget = runs / script.CHECK / "budgetary_impact.csv"
    budget.write_text(budget.read_text().replace(",4.375", ",4.6"))
    data = run_script(staged)
    assert data["linearity_check"]["failed"] == ["exchequer_bn"]
    assert (
        path(data, "central")["years"]["2029"]["exchequer_bn"]["scenario"]
        is None
    )
    # The rollout path is on the phased package, not checked
    assert (
        path(data, "rollout")["years"]["2029"]["exchequer_bn"]["scenario"]
        is not None
    )


def test_it_refuses_runs_on_different_builds(staged):
    tmp_path, static, phased, runs = staged
    build = runs / script.PHASED / "model_build.json"
    build.write_text(json.dumps({**BUILD, "dataset_sha256": "other"}))
    with pytest.raises(SystemExit, match="dataset_sha256"):
        run_script(staged)


def test_it_refuses_missing_counts(staged):
    tmp_path, static, phased, runs = staged
    (static / script.COUNTS_FILE).unlink()
    with pytest.raises(SystemExit, match="counts"):
        run_script(staged)
