"""The Milburn Household impact tab's eight stored examples, precomputed
for 2029-30 through the household API's own code path
(``uk_budget_data.milburn_household.run_household``: the request model's
checks, then ``household_impact.calculate_household_impact``), so the page
shows them with no API.

Usage::

    .venv/bin/python scripts/precompute_milburn_household_presets.py \\
        --output public/data/milburn_household_presets.json

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
    results = mh.run_household(example["household"])
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


def presets() -> dict:
    warnings.simplefilter("ignore")
    identity = runtime_identity()
    return {
        "year": mh.YEAR,
        "fiscal_year": mh.FISCAL_YEAR,
        "label": f"PolicyEngine household calculation, {mh.FISCAL_YEAR}",
        "build": local_build.LABEL,
        "engine": identity["packages"],
        "runs": [
            {
                key: run[key]
                for key in ("key", "policies", "name", "kind", "description")
            }
            for run in mh.RUNS
        ],
        "assumptions": list(mh.ASSUMPTIONS),
        "examples": [example_entry(example) for example in mh.EXAMPLES],
    }


def write(output: Path) -> Path:
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(presets(), indent=1, ensure_ascii=False) + "\n"
    )
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--output", type=Path, default=OUTPUT)
    print(write(parser.parse_args().output))


if __name__ == "__main__":
    main()
