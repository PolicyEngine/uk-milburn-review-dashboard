"""The household route on Modal: the API as one web app, its simulations
fanned out, one container each, all at once.

On Cloud Run a household's detail (the split by policy, nine simulations,
and the earnings sweep, two) queues on the instance's few worker slots. Here
``_run_all`` sends each simulation to its own ``Household`` container
(``HOUSEHOLD_RUNNER=modal``), so the detail takes about one simulation's
time. The route builds one synthetic household from the answers: no survey
data and no Hugging Face token, so the data licence question does not arise.

Cost (Modal's published rates, 25 October 2026: $0.0473 per core-hour,
$0.008 per GiB-hour): the deploy itself keeps no container warm
(``MIN_CONTAINERS`` 0); the warm schedule below then keeps some warm until
17 November. A container lives ``SCALEDOWN_SECONDS`` after its last call.
Keeping containers warm is a decision with a price (see the runbook).

    uv run --with modal modal deploy src/uk_budget_data/modal_household.py
    uv run --with modal modal app stop uk-budget-household   # when done

Deploy from a clean checkout of the commit Cloud Run serves. The image
reports the checkout's commit (``GIT_SHA``) only when every file it copies
has exactly that commit's bytes and it copies nothing else (compared with
HEAD's tree, not git's status), and the page uses this service's sweep and
split by policy only under a headline that reports the same commit;
otherwise it asks Cloud Run for them.

After a deploy, send one request (any household) and wait for it: the
first containers take the memory snapshots (about two minutes), and later
cold starts restore them. A deploy's change-over leaves containers of the
previous version answering for a while; ``fan_out`` refuses a request any
of whose runs they answered, and the page asks Cloud Run for that part
(``household_runs``).

A test app (same code, no warm schedule, scales to zero):

    HOUSEHOLD_MODAL_APP=uk-budget-household-speedtest \
        uv run --with modal modal deploy src/uk_budget_data/modal_household.py
    uv run --with modal modal app stop -y uk-budget-household-speedtest

The Milburn review dashboard's calculator (the Household impact tab) is
its own app, ``uk-milburn-household``: the same code, no warm schedule, at
most 10 ``Household`` containers, and warm jobs that run every run the
tab covers for 2029-30 (``milburn_household.covered_run_ids``). No Hugging
Face token: each household is built from the answers. The tab sends one
request for the run chosen in the header (``/api/milburn-household`` with
``runs``); its simulations go out in ``GROUPS`` batches, one in the Web container
(``WEB_BATCH``), with the speed-ups ``FAST_RUNS`` turns on. Keep as many
``Household`` containers warm as there are batches beyond the Web's (two),
or a batch waits on a cold one (approved by Vahid, 18 November 2026: up to
two, about £1 a day each):

    env -u HUGGING_FACE_TOKEN HOUSEHOLD_MODAL_APP=uk-milburn-household \
        HOUSEHOLD_MODAL_MIN_CONTAINERS=2 \
        uv run --with modal modal deploy src/uk_budget_data/modal_household.py
    uv run --with modal modal app stop -y uk-milburn-household   # when done

Its URL should be https://policyengine--uk-milburn-household-web.us-east.modal.run
(the production app's label pattern; check the deploy's output). Build the
page with ``NEXT_PUBLIC_HOUSEHOLD_API_URL`` set to that URL plus
``/api/household-impact`` for custom households (the stored examples need
no API). A cold start answers 503 with Retry-After; the page retries.

Warm schedule (approved by Vahid, 27 October 2026, about $108 in all):
``warm_schedule`` runs every 10 minutes and sets how many ``Household`` and
``Web`` containers stay warm from ``household_warm.WARM_WINDOWS`` (UK time):
12 + 1 from 07:00 to midnight on Budget day (Wednesday 28 October),
Thursday and Friday, 2 + 1 overnight; 6 + 1 from 07:00 to 23:00 on
Saturday 31 October to Monday 2 November, 1 + 1 overnight; 2 + 1 from
07:00 to 23:00 on Tuesday 3 to Tuesday 17 November; otherwise 0 + 1 (a
warm Web, the workers starting cold behind the page's retry); and 0 + 0
from 18 November 00:00 (``WARM_UNTIL``, the hard stop). The schedule is
the deployed code's: a change here reaches the production app only when it
is redeployed. To switch it all off at once:
``modal app stop uk-budget-household``.
"""

import os
import time
from pathlib import Path

import modal

# The production app. Another name (``HOUSEHOLD_MODAL_APP``) deploys the
# same code as a separate app to measure a change on, with no warm
# schedule: it scales to zero and costs nothing while idle.
PRODUCTION_APP = "uk-budget-household"
APP_NAME = os.environ.get("HOUSEHOLD_MODAL_APP", PRODUCTION_APP)
PRODUCTION = APP_NAME == PRODUCTION_APP
# The Milburn review dashboard's calculator app (see the docstring)
MILBURN_APP = "uk-milburn-household"
MILBURN = APP_NAME == MILBURN_APP
# One core: a simulation runs on one thread, so a second core would add
# cost, not speed. Memory from the measured peak of one worker (about
# 0.4 GB) with headroom.
CPU = float(os.environ.get("HOUSEHOLD_MODAL_CPU", "1.0"))
MEMORY_MB = 1024
# Cloud Run's request limit; a household run takes seconds.
TIMEOUT_SECONDS = 300
# A page load needs 9 to about 15 simulations, so this is roughly how many
# visitors are served at once: a ceiling on what a burst can cost, not a
# price while idle. 40, approved by Vahid for the 26-28 October 2026 Budget
# window (the live app was raised to 40 at runtime on 26 October; a deploy
# applies this value, so it must match). Back to 12 after 17 November.
# The Milburn app's ceiling is 10: one run of two to six simulations per
# household request.
MAX_CONTAINERS = int(
    os.environ.get("HOUSEHOLD_MODAL_MAX_CONTAINERS", "10" if MILBURN else "40")
)
# What the deploy keeps warm, none by default. On the production app,
# warm_schedule (below) sets both warm counts from
# household_warm.warm_target within 10 minutes, so this lasts only until its
# first run; a test app has no schedule and keeps it.
MIN_CONTAINERS = int(os.environ.get("HOUSEHOLD_MODAL_MIN_CONTAINERS", "0"))
SCALEDOWN_SECONDS = 120
# How many requests one Web container takes at once (Modal's
# ``max_inputs``), and so the route's own limiter there. A request on Modal
# waits on its runs' containers, using little of the Web container's CPU.
WEB_INPUTS = int(os.environ.get("HOUSEHOLD_MODAL_WEB_INPUTS", "16"))
# Memory snapshots (on by default): a container's start-up (the engine's
# import and one run of every side, so its parameter caches are built) is
# done once, when the snapshot is taken, and each later cold start restores
# that memory instead of doing it again. ``HOUSEHOLD_MODAL_SNAPSHOT=0`` goes
# back to doing it in every new container.
SNAPSHOT = os.environ.get("HOUSEHOLD_MODAL_SNAPSHOT", "1") == "1"
# The Milburn app's speed-ups (18 November 2026): lazy parameter trees and
# one current-law simulation per household batch (HOUSEHOLD_FAST_RUNS,
# lazy_parameters and household_impact.shared_baselines), and its runs in
# ``GROUPS`` batches, one container each, rather than one container a run.
# A run there took 14 to 37 s and a cold container's restore about as much
# again, so a household's seven runs on seven containers waited on cold
# ones; in batches they go to the warm containers. With ``WEB_BATCH`` the
# Web container runs the last batch itself while the Household containers
# run the others (it only waits otherwise). 0 groups: one container a run,
# as before (the Autumn Budget app).
FAST_RUNS = os.environ.get("HOUSEHOLD_FAST_RUNS", "1" if MILBURN else "0")
GROUPS = int(os.environ.get("HOUSEHOLD_MODAL_GROUPS", "3" if MILBURN else "0"))
WEB_BATCH = os.environ.get(
    "HOUSEHOLD_MODAL_WEB_BATCH", "1" if MILBURN else "0"
)
# What the image carries so a container reads the same settings as the
# deploy that built it (the decorators below are evaluated in both).
DEPLOY_SETTINGS = {
    "HOUSEHOLD_MODAL_APP": APP_NAME,
    "HOUSEHOLD_MODAL_MAX_CONTAINERS": str(MAX_CONTAINERS),
    "HOUSEHOLD_MODAL_SNAPSHOT": "1" if SNAPSHOT else "0",
    "HOUSEHOLD_MODAL_CPU": str(CPU),
    "HOUSEHOLD_MODAL_WEB_INPUTS": str(WEB_INPUTS),
    "HOUSEHOLD_FAST_RUNS": FAST_RUNS,
    "HOUSEHOLD_MODAL_GROUPS": str(GROUPS),
    "HOUSEHOLD_MODAL_WEB_BATCH": WEB_BATCH,
    # The Web's deadline for a household answer (household_deadline)
    "HOUSEHOLD_MODAL_DEADLINE_SECONDS": os.environ.get(
        "HOUSEHOLD_MODAL_DEADLINE_SECONDS", "100"
    ),
}

from uk_budget_data.household_runs import (  # noqa: E402
    container_build,
    fan_out_answers,
    fan_out_grouped_answers,
    note_seconds,
    run_answer,
)
from uk_budget_data.household_warm import warm_target  # noqa: E402
from uk_budget_data.runtime_identity import (  # noqa: E402
    checkout_commit,
    checkout_differences,
    printable_paths,
)


def build_image() -> modal.Image:
    """The image, from the repository the command runs in; in a container
    it is already built, and this stands in for it."""
    if not modal.is_local():
        return modal.Image.debian_slim()
    root = Path(__file__).resolve().parents[2]
    commit = checkout_commit(root)
    if commit is None:
        differ = checkout_differences(root)
        print(
            "No build commit: the files this deploy copies are not exactly "
            "the checkout's HEAD, so the page will not use its breakdowns."
            + (
                f" They differ in: {printable_paths(differ[:10])}"
                if differ
                else ""
            )
        )
    return (
        modal.Image.debian_slim(
            python_version=(root / ".python-version").read_text().strip()
        )
        .uv_sync(str(root), frozen=True)
        .env(
            {
                "NUMEXPR_MAX_THREADS": "1",
                "OMP_NUM_THREADS": "1",
                "OPENBLAS_NUM_THREADS": "1",
                "MKL_NUM_THREADS": "1",
                "HOUSEHOLD_RUNNER": "modal",
                "HOUSEHOLD_WORKERS": "1",
                # The Web container's household requests at once
                # (api.household_request_limit), equal to its inputs at
                # once (WEB_INPUTS). Its runs are in other containers, so a
                # request here only waits on them; at 4, five visitors at
                # once queued up to 13 s for a slot (27 October 2026).
                "HOUSEHOLD_CONCURRENT_REQUESTS": str(WEB_INPUTS),
                # The checkout's own commit, or none if the files copied
                # below differ from it: the page uses this service's
                # breakdowns only under a headline from the same commit
                "GIT_SHA": commit or "",
                **DEPLOY_SETTINGS,
            }
        )
        .workdir("/root")
        .add_local_dir(str(root / "data_inputs"), "/root/data_inputs")
        # The whole package directory: its data files (budget_years.json
        # and the like) as well as its modules, which
        # add_local_python_source alone would leave out.
        .add_local_dir(
            str(root / "src" / "uk_budget_data"),
            "/root/uk_budget_data",
            # runtime_identity.IMAGE_LEAVES_OUT must name the same folders
            ignore=["**/__pycache__/**"],
        )
    )


app = modal.App(APP_NAME, image=build_image())


def mh_runs() -> tuple:
    """Every run the Milburn tab covers (``milburn_household.run_entries``)."""
    from uk_budget_data import milburn_household as mh

    return mh.run_entries(mh.covered_run_ids())


def milburn_warm_jobs() -> list:
    """The current-law side and each covered Milburn run's sides
    (``mh_runs``), for the tab's first stored example in 2029-30."""
    from uk_budget_data import household_impact as hi
    from uk_budget_data import milburn_household as mh
    from uk_budget_data.api import HouseholdAnswersRequest

    answers = HouseholdAnswersRequest.model_validate(
        mh.EXAMPLES[0]["household"]
    ).answers()
    job = hi.household_entities(answers, mh.YEAR) + (mh.YEAR,)
    jobs = []
    for run in mh_runs():
        sides = hi.measure_sides(run["policies"])
        if not jobs:
            jobs.append((*job, sides.before))
        jobs.append((*job, sides.after))
        if len(sides.included) > 1:
            jobs += [
                (*job, sides.singles[id_], None, True)
                for id_ in sides.included
            ]
    # A package's parts are often other runs' sides: each side once
    return list({hi._run_key(job): job for job in jobs}.values())


def warm_jobs() -> list:
    """One run of every side the calculator asks for, for the default
    household: the before and after sides, each measure's single, and the
    sweep's axes. Run as a container starts, they build and keep the
    engine's parameter caches for each side, so a request's first run of a
    side does not pay for that. The Milburn app warms its own runs."""
    from uk_budget_data import household_impact as hi

    if MILBURN:
        return milburn_warm_jobs()
    year = 2027
    people, benunit, household = hi.household_entities(
        hi.HouseholdAnswers(), year
    )
    sides = hi.measure_sides(hi.measure_ids())
    axes, _ = hi.sweep_axes(people[0]["employment_income"])
    job = (people, benunit, household, year)
    return [
        (*job, sides.before),
        (*job, sides.after),
        *((*job, sides.singles[id_], None, True) for id_ in sides.included),
        (*job, sides.before, axes, True),
    ]


@app.cls(
    cpu=CPU,
    memory=MEMORY_MB,
    timeout=TIMEOUT_SECONDS,
    max_containers=MAX_CONTAINERS,
    min_containers=MIN_CONTAINERS,
    scaledown_window=SCALEDOWN_SECONDS,
    # One retry: a run takes about 10 s, so a preempted container costs a
    # retry rather than a fall back to Cloud Run (Anthony, 26 October)
    retries=1,
    enable_memory_snapshot=SNAPSHOT,
)
class Household:
    """One simulation per call, in a container that loaded the engine and
    ran each side once as it started (from the snapshot, when on)."""

    @modal.enter(snap=SNAPSHOT)
    def warm(self):
        # Kept and returned by each call rather than raised: a start-up that
        # raises makes Modal restart the container again and again.
        import traceback

        self.start_error = None
        try:
            from uk_budget_data import household_impact as hi

            # Without a snapshot every new container pays for its start-up,
            # so it runs one side only, as before.
            hi.run_batch(warm_jobs() if SNAPSHOT else warm_jobs()[:1])
        except Exception:
            self.start_error = traceback.format_exc()

    @modal.method()
    def run(self, job: tuple) -> dict:
        if self.start_error:
            raise RuntimeError(
                f"Container start-up failed:\n{self.start_error}"
            )
        from uk_budget_data import household_impact as hi

        started = time.perf_counter()
        result = hi.run_scenario(*job)
        # The run's own time and container, for fan_out's log line, and the
        # container's build, which fan_out checks; it takes them all off, so
        # the answer is run_scenario's alone.
        return run_answer(
            result,
            time.perf_counter() - started,
            os.environ.get("MODAL_TASK_ID", ""),
            container_build(),
        )

    @modal.method()
    def run_batch(self, jobs: list) -> list:
        """Several runs (one household's, from ``fan_out``) in turn, each
        answered as ``run`` answers one."""
        if self.start_error:
            raise RuntimeError(
                f"Container start-up failed:\n{self.start_error}"
            )
        return timed_batch(jobs)


def timed_batch(jobs: list) -> list:
    """``household_impact.run_batch``, each run's answer as ``run_answer``
    with its own time, in this container."""
    from uk_budget_data import household_impact as hi

    answers = []
    with hi.shared_baselines():
        for job in jobs:
            started = time.perf_counter()
            result = hi.run_scenario(*job)
            answers.append(
                run_answer(
                    result,
                    time.perf_counter() - started,
                    os.environ.get("MODAL_TASK_ID", ""),
                    container_build(),
                )
            )
    return answers


def web_and_household_batches(batches: list) -> list:
    """The last batch (the smallest) here, in the Web container, while the
    Household containers run the others; every batch's answers, in
    order."""
    calls = [Household().run_batch.spawn(batch) for batch in batches[:-1]]
    last = timed_batch(batches[-1])
    return [*(call.get() for call in calls), last]


def fan_out(jobs: list) -> list:
    """Each job in its own ``Household`` container, at once, in order.

    Raises:
        OtherBuildError: when a container of another build (a deploy's
            change-over) answered any run; the page then asks Cloud Run.
    """
    return fan_out_answers(Household().run.map, jobs)


def fan_out_batches(jobs: list) -> list:
    """The Milburn app's ``fan_out`` (``household_impact._compute`` takes it
    when ``HOUSEHOLD_MODAL_GROUPS`` is set): the jobs in ``GROUPS``
    batches, one ``Household`` container each, the last in the Web
    container when ``WEB_BATCH``.

    Raises:
        OtherBuildError: as ``fan_out``.
    """
    batches = (
        web_and_household_batches
        if WEB_BATCH == "1"
        else Household().run_batch.map
    )
    return fan_out_grouped_answers(batches, jobs, GROUPS)


@app.cls(
    cpu=1.0,
    memory=MEMORY_MB,
    timeout=TIMEOUT_SECONDS,
    max_containers=4,
    min_containers=MIN_CONTAINERS and 1,
    scaledown_window=SCALEDOWN_SECONDS,
    enable_memory_snapshot=SNAPSHOT,
)
@modal.concurrent(max_inputs=WEB_INPUTS)
class Web:
    """The same API as on Cloud Run, its runs fanned out (``fan_out``). A
    class, so the API's import (the engine with it) is in the snapshot."""

    @modal.enter(snap=SNAPSHOT)
    def load(self):
        import sys

        # Modal loads this file as the app's own module, the one whose
        # functions it has connected to the running app. household_impact
        # imports uk_budget_data.modal_household by name, which would load a
        # second, unconnected copy: point the name at this one.
        sys.modules["uk_budget_data.modal_household"] = sys.modules[__name__]
        from uk_budget_data.api import app as api

        self.api = api
        if MILBURN:
            # Into the snapshot: the Milburn runs' sides (measure_sides, about
            # 20 s on a fresh container), and one batch of each side, which
            # the Web runs itself (WEB_BATCH)
            # Logged, not raised: a start-up that raises makes Modal restart
            # the container again and again; a request then does the work.
            import traceback

            from uk_budget_data import household_impact as hi

            try:
                for run in mh_runs():
                    hi.measure_sides(run["policies"])
                if WEB_BATCH == "1":
                    # Timed, so the first request's batches are balanced
                    jobs = warm_jobs()
                    note_seconds(jobs, timed_batch(jobs))
            except Exception:
                print(f"Web warm-up failed:\n{traceback.format_exc()}")

    # The label keeps the production URL the function had:
    # https://policyengine--uk-budget-household-web.us-east.modal.run
    @modal.asgi_app(label=f"{APP_NAME}-web")
    def web(self):
        # A household request not answered by DEADLINE_SECONDS (100 s) is
        # answered 503 with Retry-After, before Modal's 150 s web limit
        # turns it into an empty answer for the page; its runs carry on
        # and are kept for the retry (household_deadline)
        from uk_budget_data.household_deadline import StartingUpDeadline

        return StartingUpDeadline(self.api)


def warm_schedule():
    """Apply ``warm_target`` for the current UK time (see the docstring)."""
    from datetime import datetime
    from zoneinfo import ZoneInfo

    now_uk = datetime.now(ZoneInfo("Europe/London")).strftime("%Y-%m-%dT%H:%M")
    household, web_warm = warm_target(now_uk)
    modal.Cls.from_name(APP_NAME, "Household")().update_autoscaler(
        min_containers=household
    )
    modal.Cls.from_name(APP_NAME, "Web")().update_autoscaler(
        min_containers=web_warm
    )
    print(f"{now_uk} UK: Household min_containers={household}, web={web_warm}")


# The schedule is the production app's only: a test app scales to zero.
if PRODUCTION:
    warm_schedule = app.function(
        cpu=0.25,
        memory=256,
        timeout=60,
        retries=0,
        schedule=modal.Cron("*/10 * * * *"),
    )(warm_schedule)
