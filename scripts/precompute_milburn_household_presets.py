"""The Milburn Household impact tab's eight stored examples, precomputed
for 2029-30 under every run the calculator covers, through the household
API's own code path (``uk_budget_data.milburn_household.run_household``:
the request model's checks, then
``household_impact.calculate_household_impact``), so the page shows them
with no API whichever run the header chooses. The file also lists every
published run, covered or not (with the reason), which the page reads.

Usage::

    .venv/bin/python scripts/precompute_milburn_household_presets.py \\
        --output public/data/milburn_household_presets.json --jobs 8

``--jobs`` examples are computed at once, each in its own process (one,
in turn, by default): every covered run for eight examples is a few
hundred simulations, about five minutes an example.

Household calculations only: no survey data and no Hugging Face token.
"""

import argparse
import json
import warnings
from pathlib import Path

from uk_budget_data import local_build
from uk_budget_data import milburn_household as mh
from uk_budget_data.runtime_identity import runtime_identity

OUTPUT = Path("public/data/milburn_household_presets.json")
# Taken off each answer and kept once, for the whole file
PER_FILE = ("engine", "git_sha")


def _shown(row: dict) -> bool:
    return bool(row["baseline"] or row["reform"])


def pruned(programmes: list) -> list:
    """The programme rows with an amount under current law or the run
    (the page shows no others), each with its children likewise."""
    rows = []
    for row in programmes:
        if not _shown(row):
            continue
        row = dict(row)
        if "children" in row:
            row["children"] = [c for c in row["children"] if _shown(c)]
        rows.append(row)
    return rows


def example_entry(example: dict) -> dict:
    warnings.simplefilter("ignore")
    results = mh.run_household(
        example["household"], runs=mh.run_entries(mh.covered_run_ids())
    )
    for result in results.values():
        for key in PER_FILE:
            result.pop(key, None)
        result["programmes"] = pruned(result["programmes"])
    return {
        "id": example["id"],
        "title": example["title"],
        "description": example["description"],
        "icon": example["icon"],
        "household": example["household"],
        "results": results,
    }


def examples(jobs: int = 1) -> list:
    """Each example's entry, in order, ``jobs`` at once."""
    if jobs <= 1:
        return [example_entry(example) for example in mh.EXAMPLES]
    from concurrent.futures import ProcessPoolExecutor

    with ProcessPoolExecutor(max_workers=jobs) as pool:
        return list(pool.map(example_entry, mh.EXAMPLES))


def presets(jobs: int = 1) -> dict:
    warnings.simplefilter("ignore")
    identity = runtime_identity()
    return {
        "year": mh.YEAR,
        "fiscal_year": mh.FISCAL_YEAR,
        "label": f"PolicyEngine household calculation, {mh.FISCAL_YEAR}",
        "build": local_build.LABEL,
        "engine": identity["packages"],
        "runs": mh.coverage(),
        "assumptions": [
            {"icon": icon, "text": text} for icon, text in mh.ASSUMPTIONS
        ],
        "examples": examples(jobs),
    }


def write(output: Path, jobs: int = 1) -> Path:
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(presets(jobs), indent=1, ensure_ascii=False) + "\n"
    )
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--jobs", type=int, default=1)
    args = parser.parse_args()
    print(write(args.output, args.jobs))


if __name__ == "__main__":
    main()
