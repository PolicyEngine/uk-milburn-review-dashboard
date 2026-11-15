"""The Milburn review registry as one file for the page: every candidate
measure, computable (with its description) or not computable (with its
reason and no figure).

A not-computable measure here has no reform, so it never reaches the
publication manifest, whose ``not_computable`` status belongs to an
artifact whose run touched a data limit (``publication.manifest.Entry``).
This file lists them beside the computable measures instead.

Usage::

    uv run uk-budget-data milburn-measures \\
        --output public/data/milburn_measures.json
"""

import json
from dataclasses import asdict
from pathlib import Path

from uk_budget_data import local_build
from uk_budget_data.reforms import (
    MILBURN_FIRST_YEAR,
    MILBURN_PACKAGE_COMPONENTS,
    MILBURN_PACKAGE_ID,
    get_milburn_reforms,
    get_not_computable_measures,
)


def milburn_measures() -> dict:
    computable = [
        {
            "id": reform.id,
            "name": reform.name,
            "description": reform.description,
            "status": "computable",
            "first_year": MILBURN_FIRST_YEAR,
            **(
                {"measures": list(MILBURN_PACKAGE_COMPONENTS)}
                if reform.id == MILBURN_PACKAGE_ID
                else {}
            ),
        }
        for reform in get_milburn_reforms()
    ]
    listed = [asdict(m) for m in get_not_computable_measures()]
    return {
        "build": local_build.LABEL,
        "measures": computable + listed,
    }


def write(output: Path) -> Path:
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(milburn_measures(), indent=2) + "\n")
    return output
