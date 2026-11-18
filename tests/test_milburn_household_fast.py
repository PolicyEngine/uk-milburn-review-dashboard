"""The Milburn household calculator's speed-ups: one request for the tab's
chosen run, or the four it showed before (``/api/milburn-household``, ``milburn_household.run_household``),
the runs in batches on Modal (``household_runs.job_groups``), lazy parameter
trees (``lazy_parameters``) and one current-law simulation per household
batch (``household_impact.shared_baselines``), which give the same answers.
"""

import pytest
from fastapi.testclient import TestClient
from policyengine_core.errors import ParameterNotFoundError
from policyengine_core.parameters import ParameterNode

from uk_budget_data import household_impact as hi
from uk_budget_data import household_runs, lazy_parameters
from uk_budget_data import milburn_household as mh
from uk_budget_data.household_runs import (
    OtherBuildError,
    balanced_groups,
    fan_out_grouped_answers,
    job_groups,
    run_answer,
)


def fake_run_scenario(calls):
    def run_scenario(
        people, benunit, household, year, side, axes=None, only=False
    ):
        calls.append(hi._run_key((people, benunit, household, year, side)))
        net = 20_000.0 + 10 * len(side["modifiers"])
        if only:
            return {"household_net_income": net}
        return {
            "household_net_income": net,
            "rows": {row.id: 0.0 for row in hi._all_rows()},
            "dependants": [{v: True for v in hi.DEPENDANT_VARIABLES}],
            "brma": "X",
            "local_authority": "Y",
        }

    return run_scenario


@pytest.fixture
def counted_runs(monkeypatch):
    calls = []
    hi.clear_runs()
    monkeypatch.setattr(hi, "run_scenario", fake_run_scenario(calls))
    yield calls
    hi.clear_runs()


def example(id_):
    return next(e for e in mh.EXAMPLES if e["id"] == id_)["household"]


def test_four_runs_share_their_current_law_side(counted_runs):
    """The four runs' simulations go out once, together: the current-law
    side every run compares with is run once, not once a run."""
    results = mh.run_household(example("renting_health"))
    assert list(results) == [run["key"] for run in mh.LEGACY_RUNS]
    # Current law, the package and its two parts, and the three other runs
    assert len(counted_runs) == len(set(counted_runs)) == 7


def test_each_run_answers_as_its_own_request(counted_runs):
    """The answers are each run's own request's, as before the runs were
    sent together."""
    together = mh.run_household(example("hospitality_health"))
    for run in mh.LEGACY_RUNS:
        hi.clear_runs()
        request = dict(mh.run_requests(example("hospitality_health")))[
            run["key"]
        ]
        alone = hi.calculate_household_impact(
            request.household.answers(),
            request.policies,
            request.year,
            include=tuple(request.include),
        )
        alone["by_policy"]["method"] = mh.BY_POLICY_METHOD
        assert together[run["key"]] == alone


def test_milburn_route_answers_every_run(counted_runs):
    from uk_budget_data.api import app

    client = TestClient(app)
    response = client.post(
        "/api/milburn-household", json={"household": example("lone_parent")}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["year"] == mh.YEAR
    assert body["fiscal_year"] == mh.FISCAL_YEAR
    assert list(body["runs"]) == [run["key"] for run in mh.LEGACY_RUNS]
    package = body["runs"]["package"]
    assert package["by_policy"]["method"] == mh.BY_POLICY_METHOD
    assert sorted(package["included"]) == [
        "milburn_report_pip",
        "milburn_report_uc_health",
    ]
    # The same household again (in another key order) is answered from the
    # runs kept: nothing more is run
    ran = len(counted_runs)
    again = client.post(
        "/api/milburn-household",
        json={"household": dict(reversed(example("lone_parent").items()))},
    )
    assert again.json()["runs"] == body["runs"]
    assert len(counted_runs) == ran


def test_milburn_route_answers_the_runs_named(counted_runs):
    from uk_budget_data.api import app

    client = TestClient(app)
    household = example("renting_health")
    body = client.post(
        "/api/milburn-household",
        json={"household": household, "runs": ["milburn_report_pip"]},
    ).json()
    assert list(body["runs"]) == ["milburn_report_pip"]
    # Another run for the same household is its own answer, not the first
    # run's kept one
    other = client.post(
        "/api/milburn-household",
        json={
            "household": household,
            "runs": ["milburn_report_package_with_youth_allowance"],
        },
    ).json()
    assert list(other["runs"]) == [
        "milburn_report_package_with_youth_allowance"
    ]
    assert (
        len(
            other["runs"]["milburn_report_package_with_youth_allowance"][
                "by_policy"
            ]["measures"]
        )
        == 4
    )


@pytest.mark.parametrize(
    "runs, words",
    [
        (["milburn_report_package_phased"], "does not cover"),
        (["child_dla_to_18"], "Not a published run"),
        ([], None),
        (["a", "b", "c", "d"], None),
    ],
)
def test_milburn_route_refuses_runs_it_does_not_cover(
    counted_runs, runs, words
):
    from uk_budget_data.api import app

    response = TestClient(app).post(
        "/api/milburn-household",
        json={"household": example("lone_parent"), "runs": runs},
    )
    assert response.status_code == 422
    if words:
        assert words in response.text
    assert counted_runs == []


def test_milburn_route_refuses_bad_answers(counted_runs):
    from uk_budget_data.api import app

    client = TestClient(app)
    response = client.post(
        "/api/milburn-household",
        json={"household": {**example("lone_parent"), "age": -1}},
    )
    assert response.status_code == 422
    assert counted_runs == []


def test_milburn_route_is_watched_for_the_starting_up_deadline():
    from uk_budget_data.household_deadline import WATCHED_PATHS

    assert "/api/milburn-household" in WATCHED_PATHS
    assert "/api/household-impact" in WATCHED_PATHS


@pytest.mark.parametrize(
    "count, groups, expected",
    [
        (7, 3, [[0, 3, 6], [1, 4], [2, 5]]),
        (7, 1, [[0, 1, 2, 3, 4, 5, 6]]),
        (2, 3, [[0], [1]]),
        (1, 0, [[0]]),
    ],
)
def test_job_groups(count, groups, expected):
    assert job_groups(count, groups) == expected


def side_job(name):
    return ([], {}, {}, 2029, {"parameter_changes": {}, "modifiers": [name]})


def test_batches_balance_on_each_sides_last_time(monkeypatch):
    """Longest first, each to the batch with least time so far; the batch
    with least time last (the Web's)."""
    monkeypatch.setattr(household_runs, "_SIDE_SECONDS", {})
    jobs = [side_job(name) for name in "abcdefg"]
    # No side timed yet: round-robin
    assert balanced_groups(jobs, 3) == job_groups(7, 3)
    seconds = dict(zip("abcdefg", (5, 14, 11, 2.5, 7, 5, 2.5)))
    household_runs.note_seconds(
        jobs,
        [run_answer(None, seconds[name], "c", "x") for name in "abcdefg"],
    )
    batches = balanced_groups(jobs, 3)
    assert sorted(i for batch in batches for i in batch) == list(range(7))
    totals = [sum(seconds["abcdefg"[i]] for i in batch) for batch in batches]
    assert totals == sorted(totals, reverse=True)
    assert max(totals) <= 16.5
    # A side not timed counts as the mean of the request's timed ones (9.5)
    assert balanced_groups([side_job("new"), *jobs[:2]], 2) == [[0, 1], [2]]


def test_grouped_fan_out_answers_in_the_jobs_order(monkeypatch):
    monkeypatch.setattr(household_runs, "_SIDE_SECONDS", {})
    batches = []

    def batch_map(groups):
        batches.extend(groups)
        return [
            [run_answer(job * 10, 0.5, f"c{index}", "abc") for job in group]
            for index, group in enumerate(groups)
        ]

    results = fan_out_grouped_answers(
        batch_map, list(range(7)), 3, environ={"GIT_SHA": "abc"}
    )
    assert results == [0, 10, 20, 30, 40, 50, 60]
    assert batches == [[0, 3, 6], [1, 4], [2, 5]]


def test_grouped_fan_out_refuses_another_builds_runs(monkeypatch):
    monkeypatch.setattr(household_runs, "_SIDE_SECONDS", {})

    def batch_map(groups):
        return [
            [run_answer(job, 0.5, "c", "old") for job in group]
            for group in groups
        ]

    with pytest.raises(OtherBuildError):
        fan_out_grouped_answers(
            batch_map, [1, 2], 2, environ={"GIT_SHA": "new"}
        )


def test_fast_runs_are_off_by_default(monkeypatch):
    """The Autumn Budget routes build simulations as before: no lazy
    parameters, no shared baseline."""
    import policyengine_uk.simulation as engine

    monkeypatch.delenv(lazy_parameters.ENV, raising=False)
    assert not lazy_parameters.enabled()
    original = engine.Simulation
    with hi.shared_baselines():
        assert engine.Simulation is original


@pytest.fixture
def lazy():
    lazy_parameters.install()
    yield
    lazy_parameters.uninstall()


def tree():
    return ParameterNode(
        "root",
        data={
            "a": {
                "x": {"values": {"2020-01-01": 1, "2025-01-01": 2}},
                "y": {"values": {"2024-01-01": 3}},
            },
            "b": {"values": {"2020-01-01": 5}},
        },
    )


def test_lazy_nodes_read_as_eager_ones(lazy):
    root = tree()
    at = root("2021-06-01")
    assert at.a.x == 1
    assert at.b == 5
    # No value at that date: missing, as the eager build left it out
    with pytest.raises(ParameterNotFoundError):
        at.a.y
    assert sorted(at.a._children) == ["x"]
    assert root("2026-01-01").a.x == 2
    assert root("2026-01-01").a.y == 3
    assert root("2026-01-01")["a"]["y"] == 3


def test_an_eager_node_built_before_install_still_reads():
    root = tree()
    eager = root("2026-01-01")
    lazy_parameters.install()
    try:
        assert eager.a.x == 2
        assert sorted(eager._children) == ["a", "b"]
        with pytest.raises(ParameterNotFoundError):
            eager.missing
    finally:
        lazy_parameters.uninstall()


@pytest.mark.slow
def test_fast_runs_give_the_same_answers(monkeypatch):
    """The real engine, the 21-year-old in retail (whose employer NI runs
    read the current-law simulation's employer cost), under every covered
    run and each combined run's parts: the runs with lazy parameters and
    one shared current-law simulation are exactly the runs without them."""
    answers = mh.run_requests(example("retail_part_time"))[0][1].household
    people, benunit, household = hi.household_entities(
        answers.answers(), mh.YEAR
    )
    job = (people, benunit, household, mh.YEAR)
    jobs = []
    for run in mh.run_entries(mh.covered_run_ids()):
        sides = hi.measure_sides(run["policies"])
        if not jobs:
            jobs.append((*job, sides.before))
        jobs.append((*job, sides.after))
        if len(sides.included) > 1:
            jobs += [(*job, sides.singles[id_]) for id_ in sides.included]
    jobs = list({hi._run_key(j): j for j in jobs}.values())
    monkeypatch.delenv(lazy_parameters.ENV, raising=False)
    plain = hi.run_batch(jobs)
    monkeypatch.setenv(lazy_parameters.ENV, "1")
    lazy_parameters.install()
    try:
        fast = hi.run_batch(jobs)
    finally:
        lazy_parameters.uninstall()
    assert fast == plain


def test_milburn_modal_app_sends_batches_and_checks_their_build():
    """modal_household needs Modal to import, so its source is read: the
    batches go through fan_out_grouped_answers (which refuses another
    build's runs), each run answered with the container's build, and the
    Milburn app turns the batches and the speed-ups on in its image."""
    import ast
    from pathlib import Path

    source = (
        Path(__file__).resolve().parents[1]
        / "src"
        / "uk_budget_data"
        / "modal_household.py"
    ).read_text(encoding="utf-8")
    tree = ast.parse(source)
    functions = {
        node.name: node
        for node in ast.walk(tree)
        if isinstance(node, ast.FunctionDef)
    }

    def calls(node):
        return {
            call.func.id if isinstance(call.func, ast.Name) else call.func.attr
            for call in ast.walk(node)
            if isinstance(call, ast.Call)
            and isinstance(call.func, (ast.Name, ast.Attribute))
        }

    assert "fan_out_grouped_answers" in calls(functions["fan_out_batches"])
    assert {"run_answer", "container_build"} <= calls(functions["timed_batch"])
    assert "timed_batch" in calls(functions["run_batch"])
    for name in (
        "HOUSEHOLD_FAST_RUNS",
        "HOUSEHOLD_MODAL_GROUPS",
        "HOUSEHOLD_MODAL_WEB_BATCH",
    ):
        assert f'"{name}":' in source
