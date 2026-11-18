"""Which of the Modal household service's run answers ``fan_out`` keeps,
and the build both ``Household.run`` and ``fan_out`` read. Kept apart from
``modal_household`` so it can be tested without Modal installed.

Each run reports the build commit of the container that ran it. A deploy's
change-over leaves containers of the previous version answering for a
while, and the response carries the commit of the container that serves it
(``runtime_identity``), not of the runs'. So a request any of whose runs
another build answered is refused: the page then asks Cloud Run for that
part, and no breakdown run partly by other code carries this build's
commit."""

import os
import time
from collections.abc import Callable, Iterable, Mapping


class OtherBuildError(RuntimeError):
    """A run was answered by a container of another build."""


def container_build(environ: Mapping[str, str] = os.environ) -> str | None:
    """This container's build: the commit its image reports (``GIT_SHA``),
    or None when it reports none (a deploy whose files are not exactly its
    checkout's commit). ``Household.run`` reports it with each run and
    ``fan_out`` compares the runs' with its own, so both read it here."""
    return environ.get("GIT_SHA") or None


def run_answer(
    result: object, seconds: float, container: str, build: str | None
) -> dict:
    """What ``Household.run`` returns: the run's result, its time and
    container for ``fan_out``'s log line, and the container's build."""
    return {
        "result": result,
        "seconds": seconds,
        "container": container,
        "git_sha": build,
    }


def _is_run_answer(answer: object) -> bool:
    return isinstance(answer, dict) and {
        "result",
        "seconds",
        "container",
        "git_sha",
    } <= set(answer)


def kept_results(answers: list, build: str | None) -> tuple[list, str]:
    """The runs' results, in order, and the log line's detail, when every
    run was answered by a container of ``build`` (this container's).

    Raises:
        OtherBuildError: when any answer comes from another build: another
            commit, or a container from before runs reported one (its
            answer is the bare result).
    """
    other = [
        index
        for index, answer in enumerate(answers)
        if not _is_run_answer(answer) or answer["git_sha"] != build
    ]
    if other:
        raise OtherBuildError(
            f"{len(other)} of {len(answers)} runs were answered by another "
            f"build than {build!r} (a deploy's change-over): ask Cloud Run"
        )
    runs = ", ".join(f"{float(answer['seconds']):.1f}" for answer in answers)
    containers = len({answer["container"] for answer in answers})
    detail = f"on {containers} containers (each run, s: {runs})"
    return [answer["result"] for answer in answers], detail


def fan_out_answers(
    run_map: Callable[[list], Iterable],
    jobs: list,
    environ: Mapping[str, str] = os.environ,
) -> list:
    """What ``fan_out`` does, given the map that sends each job to its own
    ``Household`` container (``Household().run.map``) and this container's
    environment: the runs' results, in order, logged with their times.

    Raises:
        OtherBuildError: when a container of another build than this
            container's (``container_build``) answered any run; the page
            then asks Cloud Run.
    """
    started = time.perf_counter()
    try:
        results, detail = kept_results(
            list(run_map(jobs)), container_build(environ)
        )
    except OtherBuildError as error:
        print(f"household fan-out refused: {error}")
        raise
    print(
        f"household fan-out: {len(jobs)} runs in "
        f"{time.perf_counter() - started:.1f} s {detail}"
    )
    return results


def job_groups(count: int, groups: int) -> list[list[int]]:
    """``count`` jobs' indices dealt round-robin into at most ``groups``
    batches, none empty: the first job (a request's current-law side) and
    every ``groups``-th after it in the first batch, and so on."""
    groups = max(1, min(groups, count))
    return [list(range(start, count, groups)) for start in range(groups)]


# Seconds each side's run last took in a batch, by side (``side_key``): a
# side's cost is much the same for every household (a measure's modifier
# can cost several runs' worth), so batches are balanced on it
_SIDE_SECONDS: dict = {}


def side_key(job) -> str:
    """A ``run_scenario`` job's side (its fifth item) and whether it has
    the sweep's axes, as text; the whole job for anything else."""
    import json

    if isinstance(job, (list, tuple)) and len(job) > 4:
        axes = job[5] if len(job) > 5 else None
        return json.dumps(
            [job[4], axes is not None], sort_keys=True, default=str
        )
    return json.dumps(job, sort_keys=True, default=str)


def note_seconds(jobs: list, answers: list) -> None:
    """Keep each job's side's time from its run's answer."""
    for job, answer in zip(jobs, answers):
        if isinstance(answer, dict) and "seconds" in answer:
            _SIDE_SECONDS[side_key(job)] = float(answer["seconds"])


def balanced_groups(jobs: list, groups: int) -> list[list[int]]:
    """The jobs' indices in at most ``groups`` batches with about equal
    total time: longest first, each to the batch with least so far, by
    each side's last time (``_SIDE_SECONDS``; a side not yet timed counts
    as the mean of these jobs' timed ones). With no side timed, ``job_groups``.
    """
    known = [
        _SIDE_SECONDS[k] for k in map(side_key, jobs) if k in _SIDE_SECONDS
    ]
    if not known:
        return job_groups(len(jobs), groups)
    default = sum(known) / len(known)
    cost = [_SIDE_SECONDS.get(side_key(job), default) for job in jobs]
    groups = max(1, min(groups, len(jobs)))
    batches: list = [[] for _ in range(groups)]
    totals = [0.0] * groups
    for index in sorted(range(len(jobs)), key=lambda i: (-cost[i], i)):
        target = min(range(groups), key=lambda b: (totals[b], b))
        batches[target].append(index)
        totals[target] += cost[index]
    # The batch with least time last: the Web runs it (WEB_BATCH)
    order = sorted(range(groups), key=lambda b: -totals[b])
    return [sorted(batches[b]) for b in order]


def fan_out_grouped_answers(
    batch_map: Callable[[list], Iterable],
    jobs: list,
    groups: int,
    environ: Mapping[str, str] = os.environ,
) -> list:
    """``fan_out_answers`` with the jobs in at most ``groups`` batches,
    each run in turn in one ``Household`` container
    (``Household().run_batch.map``), which answers a list, one answer per
    job: the runs' results in the jobs' order, logged with their times.

    A batch of one household's runs shares that household's current-law
    simulation (``household_impact.shared_baselines``), and as many batches
    as warm containers start no cold ones.

    Raises:
        OtherBuildError: as ``fan_out_answers``.
    """
    started = time.perf_counter()
    batches = balanced_groups(jobs, groups)
    answers: list = [None] * len(jobs)
    for indices, batch in zip(
        batches, batch_map([[jobs[i] for i in group] for group in batches])
    ):
        batch = list(batch) if isinstance(batch, (list, tuple)) else [batch]
        for index, answer in zip(indices, batch):
            answers[index] = answer
    try:
        results, detail = kept_results(answers, container_build(environ))
    except OtherBuildError as error:
        print(f"household fan-out refused: {error}")
        raise
    note_seconds(jobs, answers)
    print(
        f"household fan-out: {len(jobs)} runs in {len(batches)} batches "
        f"{batches} in {time.perf_counter() - started:.1f} s {detail}"
    )
    return results
