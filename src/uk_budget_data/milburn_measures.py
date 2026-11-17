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
from uk_budget_data.budget_measures import milburn_design
from uk_budget_data.reforms import (
    MILBURN_FIRST_YEAR,
    MILBURN_PACKAGE_COMPONENTS,
    MILBURN_PACKAGE_ID,
    MILBURN_REPORT_PACKAGE_ID,
    MILBURN_REPORT_PACKAGE_WITH_YOUTH_ALLOWANCE_ID,
    MILBURN_REPORT_PHASED_ID,
    MILBURN_REPORT_PIP_ID,
    MILBURN_REPORT_UC_HEALTH_ID,
    MILBURN_REPORT_YOUTH_ALLOWANCE_COMBINED_ID,
    MILBURN_REPORT_YOUTH_ALLOWANCE_INDEPENDENT_ID,
    get_milburn_reforms,
    get_not_computable_measures,
)

# The report's benefit changes start with its welfare savings (April 2029);
# its employer threshold runs (the end state in every year, and the glide
# path assumed from April 2027) and the 15 November runs start in 2027-28.
_REPORT_BENEFIT_IDS = frozenset(
    {
        MILBURN_REPORT_PACKAGE_ID,
        MILBURN_REPORT_UC_HEALTH_ID,
        MILBURN_REPORT_PIP_ID,
        MILBURN_REPORT_PHASED_ID,
        MILBURN_REPORT_YOUTH_ALLOWANCE_INDEPENDENT_ID,
        MILBURN_REPORT_YOUTH_ALLOWANCE_COMBINED_ID,
        MILBURN_REPORT_PACKAGE_WITH_YOUTH_ALLOWANCE_ID,
    }
)


def first_year(reform_id: str) -> int:
    """The first fiscal year a listed measure applies in."""
    if reform_id in _REPORT_BENEFIT_IDS:
        return milburn_design.REPORT_START_YEAR
    return MILBURN_FIRST_YEAR


def milburn_measures() -> dict:
    computable = [
        {
            "id": reform.id,
            "name": reform.name,
            "description": reform.description,
            "status": "computable",
            "first_year": first_year(reform.id),
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
