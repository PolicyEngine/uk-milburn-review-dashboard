"""The data build and engine the Milburn review dashboard runs on.

The dashboard's national figures come from Microcosm build
``uk-frs-calibration-attempt-20261122T100732Z-b891aa69`` (dataset SHA-256
ae116bc3...), on policyengine-uk 2.179.2 and policyengine-core 3.34.10.
policyengine 6.20.3 certifies that pair (its bundle's UK data release,
policyengine.py PR 766), so model and data are pinned together by the
bundle. From 16 to 24 November 2026 the dashboard ran on build fcfac709
(policyengine-uk 2.177.7, certified in policyengine 6.20.1 and 6.20.2);
before that, on the uncertified build 6f918b81 with the engine
overridden.

National simulations are built on the build's local file, downloaded from
the bundle's own location (``policyengine/populace-uk-private`` at the
bundle's revision), and checked before a simulation is built:

- :func:`check_engine` refuses any other policyengine-uk or
  policyengine-core version (a mixed model and data pair voids figures);
- :func:`check_dataset` refuses any file whose SHA-256 is not the build's;
- :func:`bundle_certifies` says whether the installed policyengine bundle
  certifies this build (its UK data release names the same SHA-256);
- :func:`build_microsimulation` checks, then builds the simulation on
  the forecast (``uk_budget_data.forecast.with_forecast``).

``LABEL`` is carried into every output made on this build.

The local file needs no download at run time, so ``drop_hugging_face_token``
still removes the token variables before ``uk_budget_data`` imports
policyengine (``uk_budget_data/__init__.py``); fetch the file once with the
command in docs/milburn-local-run.md.
"""

import hashlib
import json
import os
from functools import lru_cache
from importlib import metadata
from pathlib import Path
from typing import Optional

BUILD_ID = "uk-frs-calibration-attempt-20261122T100732Z-b891aa69"
BUILD_SHORT = "b891aa69"
DATASET_SHA256 = (
    "ae116bc3cff798fe68df253083f0b26d779e02a0a818ee68df7d29fbc557165a"
)
ENGINE = {"policyengine-uk": "2.179.2", "policyengine-core": "3.34.10"}


# The installed policyengine.py release (6.20.1 and later certify this build;
# bundle_certifies checks the installed one)
def _installed_policyengine() -> str:
    try:
        return metadata.version("policyengine")
    except metadata.PackageNotFoundError:
        return "unknown"


POLICYENGINE_RELEASE = _installed_policyengine()
LABEL = (
    f"build {BUILD_SHORT}, policyengine-uk {ENGINE['policyengine-uk']}, "
    f"certified in policyengine {POLICYENGINE_RELEASE}"
)
# Where the build file is read from: MILBURN_DATASET, else the documented
# default under the user's home directory (docs/milburn-local-run.md says
# how to fetch it there). Either way the file must have the build's SHA-256.
DATASET_ENV = "MILBURN_DATASET"
DATASET_RELATIVE = (
    "releases/microcosm-uk-2024-25-national/"
    f"{BUILD_ID}/microcosm_uk_2024_25.h5"
)
DEFAULT_DATASET = Path.home() / "data" / "microcosm" / DATASET_RELATIVE
# Tests only: lets the plumbing run on the invented synthetic dataset
# (uk_budget_data.synthetic_dataset), whose receipts are never certified.
# Never set it for a real run.
TEST_DATASET_ENV = "MILBURN_ALLOW_TEST_DATASET"
TOKEN_VARIABLES = ("HUGGING_FACE_TOKEN", "HF_TOKEN", "HUGGINGFACE_HUB_TOKEN")


class LocalBuildError(RuntimeError):
    """The engine or the dataset is not the local build's."""


def installed_engine() -> dict[str, Optional[str]]:
    versions = {}
    for name in ENGINE:
        try:
            versions[name] = metadata.version(name)
        except metadata.PackageNotFoundError:
            versions[name] = None
    return versions


def engine_matches() -> bool:
    return installed_engine() == ENGINE


def check_engine() -> None:
    """Refuse any engine other than the one the build was made with."""
    installed = installed_engine()
    if installed != ENGINE:
        raise LocalBuildError(
            f"Microcosm build {BUILD_SHORT} runs only on {ENGINE}; installed "
            f"is {installed}. Run `uv sync` (pyproject.toml overrides the "
            "engine), and never load this file on another engine."
        )


def dataset_path() -> Path:
    return Path(os.environ.get(DATASET_ENV) or DEFAULT_DATASET)


@lru_cache(maxsize=8)
def _sha256(path: str, size: int, mtime_ns: int) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def file_sha256(path) -> str:
    path = Path(path)
    stat = path.stat()
    return _sha256(str(path.resolve()), stat.st_size, stat.st_mtime_ns)


def check_dataset(path=None) -> Path:
    """The dataset to load: ``path`` (default :func:`dataset_path`), after
    checking that its bytes are the build's."""
    path = Path(path) if path is not None else dataset_path()
    if os.environ.get(TEST_DATASET_ENV) == "1" and path != dataset_path():
        return path
    if not path.is_file():
        raise LocalBuildError(
            f"{path} not found: the Milburn dashboard runs on Microcosm "
            f"build {BUILD_ID}. Set {DATASET_ENV} to its "
            "microcosm_uk_2024_25.h5, or fetch it to the default "
            f"({DEFAULT_DATASET}) with the command in "
            "docs/milburn-local-run.md."
        )
    actual = file_sha256(path)
    if actual != DATASET_SHA256:
        raise LocalBuildError(
            f"{path} has SHA-256 {actual}, not build {BUILD_SHORT}'s "
            f"{DATASET_SHA256}: refusing to load another dataset."
        )
    return path


def build_microsimulation(path=None, scenario=None):
    """A national simulation on the local build, on the forecast."""
    import policyengine as pe

    from uk_budget_data.forecast import with_forecast

    check_engine()
    dataset = check_dataset(path)
    # policyengine.py's builder, as an unmanaged local file: it loads the
    # file with the installed policyengine_uk and records the runtime
    # dataset and versions that receipts need. The file is the bundle's
    # certified dataset (same SHA-256, bundle_certifies).
    sim = pe.uk.managed_microsimulation(
        dataset=str(dataset),
        allow_unmanaged=True,
        scenario=with_forecast(scenario),
    )
    sim.local_build = {
        "build": BUILD_ID,
        "dataset_sha256": DATASET_SHA256,
        "engine": dict(ENGINE),
        "label": LABEL,
    }
    return sim


def bundle_certifies() -> bool:
    """Whether the installed policyengine bundle certifies this build: its
    UK data release names this build and this dataset's SHA-256."""
    try:
        import importlib.resources as resources

        manifest = json.loads(
            (
                resources.files("policyengine")
                / "data"
                / "bundle"
                / "manifest.json"
            ).read_text()
        )
        artifact = manifest["data_releases"]["uk"]["certified_data_artifact"]
    except (ModuleNotFoundError, FileNotFoundError, KeyError, ValueError):
        return False
    return (
        artifact.get("build_id") == BUILD_ID
        and artifact.get("sha256") == DATASET_SHA256
    )


def drop_hugging_face_token() -> list[str]:
    """Remove the Hugging Face token variables when the local build's
    engine is installed, so importing policyengine.py does not fetch (and
    refuse) its own data certificate. Returns the names removed."""
    if not engine_matches():
        return []
    fetch_dataset()
    return [name for name in TOKEN_VARIABLES if os.environ.pop(name, None)]


# Set in a Modal container only (modal_generate.build_image): fetch the
# build's file with the container's read token before the token is dropped,
# as docs/milburn-local-run.md fetches it locally.
FETCH_ENV = "MILBURN_FETCH_DATASET"
DATASET_REPO = "policyengine/populace-uk-private"
DATASET_REVISION = "a80a4bf70ab4ffeac77357fe0633d3cee4ce7401"


def fetch_dataset() -> None:
    """Download the build's file to :func:`dataset_path` when FETCH_ENV is
    "1", a token is set and the file is not there; its SHA-256 is checked
    when a simulation is built (:func:`check_dataset`)."""
    if os.environ.get(FETCH_ENV) != "1" or dataset_path().is_file():
        return
    token = next(
        (os.environ[name] for name in TOKEN_VARIABLES if os.environ.get(name)),
        None,
    )
    if token is None:
        return
    import shutil

    from huggingface_hub import hf_hub_download

    downloaded = hf_hub_download(
        DATASET_REPO,
        DATASET_RELATIVE,
        repo_type="dataset",
        revision=DATASET_REVISION,
        token=token,
    )
    destination = dataset_path()
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(downloaded, destination)


RECORD_FILE = "model_build.json"


def _policyengine_version() -> Optional[str]:
    try:
        return metadata.version("policyengine")
    except metadata.PackageNotFoundError:
        return None


def build_record(measure_ids=(), years=()) -> dict:
    """What the flat tables were made on, with the label."""
    return {
        "label": LABEL,
        "build": BUILD_ID,
        "dataset_sha256": DATASET_SHA256,
        "engine": dict(ENGINE),
        "certified": bundle_certifies(),
        "policyengine": _policyengine_version(),
        "measures": list(measure_ids),
        "years": [int(y) for y in years],
    }


def write_build_record(path, measure_ids=(), years=()) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(build_record(measure_ids, years), indent=2) + "\n"
    )
    return path
