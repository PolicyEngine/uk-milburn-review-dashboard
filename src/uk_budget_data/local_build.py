"""The data build and engine the Milburn review dashboard runs on.

The dashboard's national figures come from Microcosm build
``uk-frs-calibration-attempt-20261112T133744Z-6f918b81`` (dataset SHA-256
e268e3af...), on the engine it was built with: policyengine-uk 2.177.7 and
policyengine-core 3.34.10. No policyengine.py release pins that pair
(policyengine 6.19.0 pins policyengine-uk 2.174.1 with build eeb6093e), so
``pyproject.toml`` overrides the engine through ``[tool.uv]
override-dependencies`` and this module builds national simulations with
``policyengine_uk.Microsimulation`` directly, on the local file only:

- :func:`check_engine` refuses any other policyengine-uk or
  policyengine-core version (a mixed model and data pair voids figures);
- :func:`check_dataset` refuses any file whose SHA-256 is not the build's;
- :func:`build_microsimulation` does both, then builds the simulation on
  the forecast (``uk_budget_data.forecast.with_forecast``).

``LABEL`` is carried into every output made on this build, in place of a
policyengine.py certificate.

policyengine.py 6.19.0 checks its data certificate when imported: with a
Hugging Face token in the environment it fetches its data release manifest
and refuses the overridden engine. The local build needs no download, so
``drop_hugging_face_token`` removes the token variables before
``uk_budget_data`` imports policyengine (``uk_budget_data/__init__.py``).
"""

import hashlib
import json
import os
from functools import lru_cache
from importlib import metadata
from pathlib import Path
from typing import Optional

BUILD_ID = "uk-frs-calibration-attempt-20261112T133744Z-6f918b81"
BUILD_SHORT = "6f918b81"
DATASET_SHA256 = (
    "e268e3af7932784ad4471f008097a5acc6c3c5bc15c4c54fbb5a489b2a0ac9ae"
)
ENGINE = {"policyengine-uk": "2.177.7", "policyengine-core": "3.34.10"}
LABEL = (
    f"build {BUILD_SHORT}, policyengine-uk {ENGINE['policyengine-uk']}, "
    "not in a policyengine.py release"
)
# Where the build lives on this machine; MILBURN_DATASET overrides it (the
# file must still have the build's SHA-256).
DATASET_ENV = "MILBURN_DATASET"
DEFAULT_DATASET = Path(
    "/Users/vahid/data/microcosm/releases/microcosm-uk-2024-25-national/"
    f"{BUILD_ID}/microcosm_uk_2024_25.h5"
)
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
            f"build {BUILD_ID} (set {DATASET_ENV} to its "
            "microcosm_uk_2024_25.h5)."
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
    # dataset and versions that receipts need. Its certificate does not
    # cover this pair, so receipts record the run as uncertified.
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


def drop_hugging_face_token() -> list[str]:
    """Remove the Hugging Face token variables when the local build's
    engine is installed, so importing policyengine.py does not fetch (and
    refuse) its own data certificate. Returns the names removed."""
    if not engine_matches():
        return []
    return [name for name in TOKEN_VARIABLES if os.environ.pop(name, None)]


RECORD_FILE = "model_build.json"


def build_record(measure_ids=(), years=()) -> dict:
    """What the flat tables were made on, with the label."""
    return {
        "label": LABEL,
        "build": BUILD_ID,
        "dataset_sha256": DATASET_SHA256,
        "engine": dict(ENGINE),
        "certified": False,
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
