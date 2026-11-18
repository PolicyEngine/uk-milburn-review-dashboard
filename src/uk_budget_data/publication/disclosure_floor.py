"""Thin cells in an artifact's household tables.

The decile tables (``distributional_impact``, ``winners_losers``) and the
age table (``age_impact``) average each household's change over a group. A
group whose change comes from fewer than SURVEY_HOUSEHOLD_FLOOR survey
households rests on too few cases to publish, however many households the
group holds: its average is those households' change over a group size
anyone can estimate. The floor is the UK Data Service's minimum threshold
for Safeguarded data, which the End User Licence binds us to (CD171
version 18, section 5.2.1: never report a cell "based on only one or two
cases"). The same section advises, but does not require, 10 against
secondary disclosure, and the FRS adds no condition of its own
(microcosm#1278); the binned scatter, the income mobility shares and the
results by area keep 10. Microcosm builds several records
from one survey household, so the floor counts the survey households behind
the changed records (``pipeline.scatter_survey_households``), as the binned
scatter and the results by area do.

The age table may leave rows out, so its thin cells are withheld with
whatever would give them back by difference (``withheld_age_labels``): a
thin single year of age takes the other single ages of its band with it,
so the bands and "all" stay; a thin band leaves only "all"; a thin "all"
leaves no row. The decile tables keep their identifying columns and
withhold every value in a thin decile's row, plus the winners and losers
"all" row that would give it back by difference. A combined run also
withholds its members' withheld cells, in the age table as in the decile
tables (#340): the package's own rows less the other members' would give
back a member's withheld age, so the package takes each member's thin age
groups as its own (``recorded_thin_age_groups``) before choosing the rows
to leave out. The receipt's ``withheld_cells`` names the age rows left
out, which no file then holds. When "all" itself is thin, the
whole measure and its costing rest on too few households: that run keeps
the warning and publication refusal, or is refused before writing when
THIN_DECILES_ENV is "refuse".
"""

import os
from typing import Optional

import numpy as np
import pandas as pd

from uk_budget_data.calculators import (
    AGE_BAND_ALL,
    AGE_BANDS,
    SINGLE_AGE_MIN_RECORDS,
    age_band_of,
    single_age_of,
)

SURVEY_HOUSEHOLD_FLOOR = 3
# A household whose net income moves by less than this, £ a year, has not
# changed: the difference is rounding in the engine.
CHANGE_TOLERANCE = 0.01
DECILE_TABLES = ("distributional_impact", "winners_losers")
AGE_TABLE = "age_impact"
# The tables a receipt's floor record covers: the decile and age tables,
# held to SURVEY_HOUSEHOLD_FLOOR, and the binned scatter, whose rows name
# their survey household once it has run and which ``tables.bin_scatter``
# holds to its own SCATTER_MIN_HOUSEHOLDS.
FLOOR_TABLES = (*DECILE_TABLES, AGE_TABLE, "household_scatter_binned")
# Groups no row shows but the rows give back by difference (``age_groups``):
# a band's people whose age has no row of its own, labelled with the band
# and this, and anyone in no band.
OTHER_AGES = " (ages without a row)"
NO_BAND = "all (in no band)"
THIN_DECILES_ENV = "UK_BUDGET_THIN_DECILES"


def refuses_thin_deciles() -> bool:
    """Whether a run with a thin "all" group is refused (THIN_DECILES_ENV
    set to "refuse") rather than written with a warning (the default, or
    "warn"; #208 review, finding 11). Read where the generation starts and
    carried on each run (``generate.ArtifactRun.refuse_thin_deciles``),
    never where a run is made. Any other setting stops the generation, so a
    mistyped one never picks a mode."""
    mode = os.environ.get(THIN_DECILES_ENV) or "warn"
    if mode not in ("warn", "refuse"):
        raise ValueError(
            f"{THIN_DECILES_ENV} is {mode!r}: set it to 'warn' (the "
            "default) or 'refuse'"
        )
    return mode == "refuse"


def thin_groups(
    groups: dict[str, np.ndarray], changed: np.ndarray, survey: np.ndarray
) -> list[str]:
    """The groups whose change comes from 1 to SURVEY_HOUSEHOLD_FLOOR - 1
    survey households.

    ``groups`` maps each published label to a mask over the rows,
    ``changed`` marks the rows whose household changed and ``survey`` names
    each row's survey household. A group in which no household changed
    shows no change, which is safe to publish.
    """
    thin = []
    for label, members in groups.items():
        count = len(np.unique(survey[members & changed]))
        if 0 < count < SURVEY_HOUSEHOLD_FLOOR:
            thin.append(label)
    return thin


def decile_groups(decile: np.ndarray) -> dict[str, np.ndarray]:
    """The winners and losers groups, by household: each income decile and
    "all" (households with a decile), as the calculators publish them."""
    groups = {str(n): decile == n for n in range(1, 11)}
    groups["all"] = decile >= 1
    return groups


def age_groups(age: np.ndarray, decile: np.ndarray) -> dict[str, np.ndarray]:
    """The age table's groups, by person, as ``AgeImpactCalculator``
    publishes them: the age bands, "all", and each single year of age with
    at least SINGLE_AGE_MIN_RECORDS records. People whose household has no
    income decile are left out.

    Also the groups the published rows give back by difference, which no
    row shows: each band's people whose age has no row of its own (the band
    less its single ages, labelled with OTHER_AGES), and anyone in no band
    ("all" less the bands, NO_BAND)."""
    kept = decile >= 1
    bands = age_band_of(age)
    groups = {label: kept & (bands == label) for label, _, _ in AGE_BANDS}
    groups[AGE_BAND_ALL] = kept
    groups[NO_BAND] = kept & (bands == "")
    singles = single_age_of(age)
    with_a_row = np.zeros(len(age), dtype=bool)
    for label in np.unique(singles[kept]):
        members = kept & (singles == label)
        if members.sum() >= SINGLE_AGE_MIN_RECORDS:
            groups[str(label)] = members
            with_a_row |= members
    for label, _, _ in AGE_BANDS:
        groups[label + OTHER_AGES] = groups[label] & ~with_a_row
    return groups


def _values(simulation, variable: str, year: int, map_to: str) -> np.ndarray:
    return np.asarray(
        simulation.calculate(variable, period=year, map_to=map_to).values
    )


def thin_cells(
    baseline, reformed, years: list[int], survey
) -> dict[tuple[str, int], list[str]]:
    """Each (table, year) with a thin cell, and the cells' labels.

    ``survey`` names the survey household behind each of the simulations'
    households, in the engine's household order.
    """
    survey = np.asarray(survey)
    households = pd.Index(
        _values(baseline, "household_id", years[0], "household")
    )
    if len(households) != len(survey):
        raise ValueError(
            f"{len(survey)} survey households for {len(households)} households"
        )
    position = households.get_indexer(
        _values(baseline, "household_id", years[0], "person")
    )
    if (position < 0).any():
        raise ValueError("a person's household is not among the households")
    found = {}
    for year in years:
        change = _values(
            reformed, "household_net_income", year, "household"
        ) - _values(baseline, "household_net_income", year, "household")
        changed = np.abs(change) >= CHANGE_TOLERANCE
        decile = _values(
            baseline, "household_income_decile", year, "household"
        )
        thin = thin_groups(decile_groups(decile), changed, survey)
        if thin:
            for table in DECILE_TABLES:
                found[(table, year)] = thin
        groups = age_groups(
            _values(baseline, "age", year, "person"),
            _values(baseline, "household_income_decile", year, "person"),
        )
        thin = thin_groups(groups, changed[position], survey[position])
        if thin:
            found[(AGE_TABLE, year)] = thin
    return found


def floor_record(
    found: dict[tuple[str, int], list[str]],
    *,
    withheld: Optional[dict[tuple[str, int], list[str]]] = None,
    not_checked_because: Optional[str] = None,
) -> dict:
    """Record the floor in an artifact's receipt.

    ``dashboard.disclosure_floor`` names the cells found thin by table,
    year and group label, never a figure, and whether any is still published.
    A thin "all" always keeps the refusal, including the costing. An
    omitted ``withheld`` keeps the meaning of receipts made before decile
    withholding. ``survey_households`` is the decile and age tables'
    floor, SURVEY_HOUSEHOLD_FLOOR; the binned scatter's is
    SCATTER_MIN_HOUSEHOLDS. A run whose survey households cannot be told
    apart records that it was not checked, and why."""
    cells = [
        {"table": table, "year": year, "groups": list(labels)}
        for (table, year), labels in sorted(found.items())
    ]
    record = {
        "survey_households": SURVEY_HOUSEHOLD_FLOOR,
        "checked": not_checked_because is None,
        "thin_cells": cells,
        "thin_cells_in_tables": any(
            table in DECILE_TABLES
            and (
                "all" in labels
                or any(
                    label not in (withheld or {}).get((table, year), [])
                    for label in labels
                )
            )
            for (table, year), labels in found.items()
        ),
    }
    if withheld is not None:
        record["withheld_cells"] = [
            {"table": table, "year": year, "groups": list(labels)}
            for (table, year), labels in sorted(withheld.items())
            if labels
        ]
    if not_checked_because is not None:
        record["not_checked_because"] = not_checked_because
    return record


def decile_label(label) -> str:
    """Return the canonical group label for numeric or ordinal decile rows."""
    value = str(label)
    for suffix in ("st", "nd", "rd", "th"):
        if value.endswith(suffix):
            return value[: -len(suffix)]
    return value


def withheld_decile_cells(
    found: dict[tuple[str, int], list[str]],
    inherited: Optional[dict[tuple[str, int], list[str]]] = None,
) -> dict[tuple[str, int], list[str]]:
    """Return decile cells withheld for thin groups and a package's members.

    The winners and losers "all" row is withheld in every affected year,
    since a weighted total and the other deciles can give a decile back.
    Distributional impact has no "all" row. A thin "all" keeps the whole
    measure refusal instead of withholding its costing's underlying cases.
    """
    withheld = {
        cell: set(labels) for cell, labels in (inherited or {}).items()
    }
    whole_years = {
        year
        for (table, year), labels in found.items()
        if table in DECILE_TABLES and "all" in labels
    }
    for (table, year), labels in found.items():
        if table in DECILE_TABLES and year not in whole_years:
            withheld.setdefault((table, year), set()).update(labels)
    for year in {year for (_, year), labels in withheld.items() if labels}:
        withheld.setdefault(("winners_losers", year), set()).add("all")
    return {
        cell: sorted(
            labels,
            key=lambda label: (
                label == "all",
                int(label) if label != "all" else 0,
            ),
        )
        for cell, labels in sorted(withheld.items())
        if labels
    }


def withhold_decile_rows(
    rows: list[dict],
    table: str,
    withheld: dict[tuple[str, int], list[str]],
) -> list[dict]:
    """Keep decile row identifiers and blank every withheld value."""
    identifying = {"reform_id", "reform_name", "year", "decile"}
    return [
        (
            {
                name: value if name in identifying else None
                for name, value in row.items()
            }
            if decile_label(row["decile"])
            in withheld.get((table, row["year"]), [])
            else row
        )
        for row in rows
    ]


def recorded_withheld_cells(record: dict) -> dict[tuple[str, int], list[str]]:
    """Read a member's decile withholding, accepting older floor records.

    Its age rows left out are read by ``recorded_thin_age_groups``."""
    if not isinstance(record, dict):
        raise ValueError("its disclosure floor is not an object")
    cells = record.get("withheld_cells", [])
    if not isinstance(cells, list):
        raise ValueError("its withheld cells are not a list")
    found: dict[tuple[str, int], list[str]] = {}
    for cell in cells:
        if not isinstance(cell, dict):
            raise ValueError("its withheld cell is not an object")
        table, year, labels = (
            cell.get("table"),
            cell.get("year"),
            cell.get("groups"),
        )
        if table == AGE_TABLE:
            if type(year) is not int or not valid_age_labels(labels):
                raise ValueError(
                    "its withheld cell has invalid table, year or groups"
                )
            continue
        allowed = {str(n) for n in range(1, 11)}
        if table == "winners_losers":
            allowed.add("all")
        if (
            table not in DECILE_TABLES
            or type(year) is not int
            or not isinstance(labels, list)
            or any(
                not isinstance(label, str) or label not in allowed
                for label in labels
            )
        ):
            raise ValueError(
                "its withheld cell has invalid table, year or groups"
            )
        found.setdefault((table, year), []).extend(labels)
    return withheld_decile_cells({}, found)


def thin_cells_reason(found: dict[tuple[str, int], list[str]]) -> str:
    """The thin cells, naming tables, years and group labels, never a
    figure."""
    parts = [
        f"{table} {year} ({', '.join(labels)})"
        for (table, year), labels in sorted(found.items())
    ]
    return (
        f"cells resting on fewer than {SURVEY_HOUSEHOLD_FLOOR} survey "
        f"households: {'; '.join(parts)}"
    )


def _band_of_single_age(label: str) -> str:
    """The band a single year of age's label ("40", "90+") falls in."""
    return age_band_of(np.array([int(label.rstrip("+"))]))[0]


def withheld_age_labels(
    thin: list[str], labels: list[str]
) -> Optional[set[str]]:
    """Which of a year's age table ``labels`` to withhold, given its
    ``thin`` groups (``age_groups``), so that no published row, nor any sum
    or difference of them, rests on a thin group; None withholds them all.

    - "all" thin: every row.
    - A band thin, or the people in no band: every row but "all", since the
      bands add up to it.
    - Otherwise every single year of age in a band with a thin single age,
      or whose ages without a row are thin; the bands, "all" and the other
      bands' single ages stay. Each band is then either whole, giving back
      only its ages without a row, which are not thin, or shown as one row.
    """
    if AGE_BAND_ALL in thin:
        return None
    bands = {label for label, _, _ in AGE_BANDS}
    if NO_BAND in thin or bands & set(thin):
        return {label for label in labels if label != AGE_BAND_ALL}
    dirty = {
        (
            label[: -len(OTHER_AGES)]
            if label.endswith(OTHER_AGES)
            else _band_of_single_age(label)
        )
        for label in thin
    }
    return {
        label
        for label in labels
        if label not in bands
        and label != AGE_BAND_ALL
        and _band_of_single_age(label) in dirty
    }


def age_labels_in_order(labels) -> list[str]:
    """Age table labels in the calculator's row order: the bands, "all",
    then the single years of age, youngest first."""
    bands = [label for label, _, _ in AGE_BANDS]

    def key(label):
        if label in bands:
            return (0, bands.index(label))
        if label == AGE_BAND_ALL:
            return (1, 0)
        return (2, int(label.rstrip("+")))

    return sorted(set(labels), key=key)


def valid_age_labels(labels) -> bool:
    """Whether ``labels`` is a non-empty list of the age table's row
    labels (a band, "all", "0" to "89" or "90+"), each once."""
    if not isinstance(labels, list) or not labels:
        return False
    allowed = {label for label, _, _ in AGE_BANDS} | {AGE_BAND_ALL}
    allowed |= {str(age) for age in range(90)} | {"90+"}
    return len(set(labels)) == len(labels) and all(
        isinstance(label, str) and label in allowed for label in labels
    )


def recorded_thin_age_groups(record: dict) -> dict[int, list[str]]:
    """A member's age groups the package must treat as thin, by year: the
    age table's thin cells in its receipt (``floor_record``), which every
    receipt since the floor records, and the age rows its ``withheld_cells``
    names. Either set, given to ``withheld_age_labels``, leaves out the
    rows the member left out and whatever would give them back (#340)."""
    if not isinstance(record, dict):
        raise ValueError("its disclosure floor is not an object")
    found: dict[int, set[str]] = {}
    for field in ("thin_cells", "withheld_cells"):
        cells = record.get(field) or []
        if not isinstance(cells, list):
            raise ValueError(f"its {field} are not a list")
        for cell in cells:
            if not isinstance(cell, dict):
                raise ValueError(f"its {field} cell is not an object")
            if cell.get("table") != AGE_TABLE:
                continue
            year, labels = cell.get("year"), cell.get("groups")
            if (
                type(year) is not int
                or not isinstance(labels, list)
                or any(not isinstance(label, str) for label in labels)
            ):
                raise ValueError(
                    f"its {field} cell has invalid year or groups"
                )
            found.setdefault(year, set()).update(labels)
    return {year: sorted(labels) for year, labels in sorted(found.items())}


def withheld_age_cells(
    rows: list[dict],
    found: dict[tuple[str, int], list[str]],
    inherited: Optional[dict[int, list[str]]] = None,
) -> dict[tuple[str, int], list[str]]:
    """The labels of the age table's rows to leave out, by (AGE_TABLE,
    year), in row order: its thin cells and any row that would give one
    back (``withheld_age_labels``), year by year.

    ``inherited`` names, by year, a combined run's members' thin age
    groups (``recorded_thin_age_groups``): the package leaves out what each
    member left out, and what its own rows less the other members' would
    give back (#340)."""
    labels: dict[int, list[str]] = {}
    for row in rows:
        labels.setdefault(row["year"], []).append(row["age_band"])
    thin: dict[int, set[str]] = {}
    for (table, year), groups in found.items():
        if table == AGE_TABLE:
            thin.setdefault(year, set()).update(groups)
    for year, groups in (inherited or {}).items():
        thin.setdefault(year, set()).update(groups)
    withheld = {}
    for year, year_labels in sorted(labels.items()):
        if not thin.get(year):
            continue
        dropped = withheld_age_labels(sorted(thin[year]), year_labels)
        dropped = set(year_labels) if dropped is None else dropped
        if dropped:
            withheld[(AGE_TABLE, year)] = age_labels_in_order(dropped)
    return withheld


def withhold_thin_age_rows(
    rows: list[dict],
    found: dict[tuple[str, int], list[str]],
    inherited: Optional[dict[int, list[str]]] = None,
) -> list[dict]:
    """The age table's rows without those ``withheld_age_cells`` names."""
    withheld = withheld_age_cells(rows, found, inherited)
    return [
        row
        for row in rows
        if row["age_band"] not in withheld.get((AGE_TABLE, row["year"]), [])
    ]


def survey_scatter_rows(rows: list[dict], household_ids, survey) -> list[dict]:
    """The household scatter's rows, each naming its survey household, so
    that ``tables.bin_scatter`` counts survey households rather than
    records. ``household_ids`` and ``survey`` are in the engine's household
    order."""
    by_household = dict(zip(np.asarray(household_ids).tolist(), survey))
    return [
        {**row, "survey_household": by_household[row["household_id"]]}
        for row in rows
    ]


# The flat route (``pipeline.DataPipeline``): the calculators count, per
# row, the survey households behind each published statistic (columns
# starting COUNT_PREFIX); ``apply_flat_floor`` withholds every statistic
# resting on 1 to SURVEY_HOUSEHOLD_FLOOR - 1 of them, and its partners, then
# cuts the counts, which are never published.
COUNT_PREFIX = "n_survey_households_"
# Age table: the statistics each count stands behind
AGE_FAMILIES = {
    "changed": ("mean_change", "mean_equivalised_change"),
    "worse": ("pct_worse_off", "mean_change_worse_off"),
    "better": ("pct_better_off", "mean_change_better_off"),
    "direct": ("people_directly_affected",),
}
DECILE_VALUE = {
    "distributional_impact": "value",
    "winners_losers": "avg_change",
}
POVERTY_MEASURE_KEYS = ("abs_bhc", "abs_ahc", "rel_bhc", "rel_ahc")
# metrics.csv's older headline, the same measure as abs_bhc for everyone
LEGACY_POVERTY = ("poverty_change_pp", "poverty_change_pct")


def is_thin(count) -> bool:
    """Whether a count of survey households is under the floor but not
    none (a statistic no household moves is safe to publish)."""
    return count is not None and 0 < count < SURVEY_HOUSEHOLD_FLOOR


def _count(row, column):
    value = row.get(column)
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return None
    return int(value)


def flat_withheld_age_labels(thin: list[str], labels: list[str]) -> set[str]:
    """Which of a run-year's age rows to withhold for one statistic, given
    its thin groups, so that no published row, sum or difference gives one
    back. Unlike ``withheld_age_labels``, a thin band takes "all" (which the
    bands add up to) rather than every other band, so the other bands stay:

    - "all" thin: every row;
    - a band thin: the band, its single ages and "all";
    - a single age thin, or a band's ages without a row: the band's single
      ages (the band and "all" stay, as each then gives back only groups
      that are not thin).
    """
    if AGE_BAND_ALL in thin:
        return set(labels)
    bands = {label for label, _, _ in AGE_BANDS}
    withheld = set()
    thin_bands = bands & set(thin)
    if thin_bands or NO_BAND in thin:
        withheld |= {AGE_BAND_ALL} | thin_bands
    dirty = set(thin_bands)
    for label in thin:
        if label.endswith(OTHER_AGES):
            dirty.add(label[: -len(OTHER_AGES)])
        elif label not in bands and label not in (AGE_BAND_ALL, NO_BAND):
            dirty.add(_band_of_single_age(label))
    withheld |= {
        label
        for label in labels
        if label not in bands
        and label != AGE_BAND_ALL
        and _band_of_single_age(label) in dirty
    }
    return withheld & set(labels)


def flat_age_withholding(rows: list[dict]) -> dict[str, set[str]]:
    """One run-year's age rows: the columns to withhold, by row label.

    Each statistic is withheld where its count is thin, with whatever
    would give it back (``flat_withheld_age_labels``: a single age takes its
    band's other single ages; a thin band its single ages and "all"). A withheld
    share takes ``pct_unchanged`` (100 less the two shares), and a withheld
    side takes the other side's conditional mean, since the row's mean
    change less the other side's share times mean gives back its total."""
    labels = [row["age_band"] for row in rows]
    withheld: dict[str, set[str]] = {}
    for family, columns in AGE_FAMILIES.items():
        column = COUNT_PREFIX + family
        thin = [
            row["age_band"] for row in rows if is_thin(_count(row, column))
        ]
        thin += [
            row["age_band"] + OTHER_AGES
            for row in rows
            if is_thin(_count(row, column + "_other_ages"))
        ]
        if not thin:
            continue
        dropped = flat_withheld_age_labels(thin, labels)
        for label in dropped:
            withheld.setdefault(label, set()).update(columns)
    for columns in withheld.values():
        for side, other in (("worse", "better"), ("better", "worse")):
            if f"pct_{side}_off" in columns:
                columns.add("pct_unchanged")
                if "mean_change" not in columns:
                    columns.add(f"mean_change_{other}_off")
    return {label: columns for label, columns in withheld.items() if columns}


def flat_decile_withholding(rows: list[dict]) -> set[str]:
    """One run-year's decile labels ("1" to "10", "all") to withhold:
    each thin decile, and the winners and losers "all" row with any."""
    thin = {
        decile_label(row["decile"])
        for row in rows
        if is_thin(_count(row, COUNT_PREFIX + "changed"))
    }
    if thin:
        thin.add("all")
    return thin


def flat_metrics_withholding(row: dict) -> set[str]:
    """One metrics row's poverty columns to withhold: each measure's
    change (points and per cent) where the survey households whose poverty
    status changes are thin; children's count only households with a
    dependent child whose status changes."""
    columns = set()
    for prefix in ("", "child_"):
        for measure in POVERTY_MEASURE_KEYS:
            if is_thin(
                _count(row, f"{COUNT_PREFIX}{prefix}poverty_{measure}")
            ):
                columns.update(
                    {
                        f"{prefix}poverty_{measure}_change_pp",
                        f"{prefix}poverty_{measure}_change_pct",
                    }
                )
                if not prefix and measure == "abs_bhc":
                    columns.update(LEGACY_POVERTY)
    return columns


def _count_columns(frame: pd.DataFrame) -> list[str]:
    return [c for c in frame.columns if str(c).startswith(COUNT_PREFIX)]


def apply_flat_floor(data: dict):
    """The flat tables with the floor applied: ``(data, counts,
    withheld)``.

    ``data`` maps table names to frames, as ``aggregate_results`` returns
    them. Each thin statistic and its partners are blanked (NaN, an empty
    cell) and the count columns cut. ``counts`` (every row's counts, long)
    and ``withheld`` (each blanked cell, with the count that withheld it or
    "partner") are for the private record only; both are None when no table
    carries counts (a run without survey households)."""
    data = dict(data)
    count_rows, withheld_rows = [], []
    if not any(
        _count_columns(frame)
        for frame in data.values()
        if isinstance(frame, pd.DataFrame)
    ):
        return data, None, None

    def blank(table, frame, index, columns, row_label, reason_of):
        for column in sorted(columns):
            if column not in frame.columns:
                continue
            frame.loc[index, column] = np.nan
            withheld_rows.append(
                {
                    "table": table,
                    "reform_id": frame.at[index, "reform_id"],
                    "year": int(frame.at[index, "year"]),
                    "row": row_label,
                    "column": column,
                    "count": reason_of(column),
                }
            )

    def record_counts(table, frame, label_column):
        for _, row in frame.iterrows():
            for column in _count_columns(frame):
                value = _count(row, column)
                if value is None:
                    continue
                count_rows.append(
                    {
                        "table": table,
                        "reform_id": row["reform_id"],
                        "year": int(row["year"]),
                        "row": (
                            str(row[label_column]) if label_column else "all"
                        ),
                        "column": column[len(COUNT_PREFIX) :],
                        "count": value,
                    }
                )

    age = data.get(AGE_TABLE)
    if isinstance(age, pd.DataFrame) and _count_columns(age):
        age = age.copy()
        record_counts(AGE_TABLE, age, "age_band")
        family_of = {
            column: family
            for family, columns in AGE_FAMILIES.items()
            for column in columns
        }
        for _, group in age.groupby(["reform_id", "year"], sort=False):
            records = group.to_dict("records")
            plan = flat_age_withholding(records)
            for index, row in zip(group.index, records):
                columns = plan.get(row["age_band"])
                if not columns:
                    continue

                def reason(column, row=row):
                    family = family_of.get(column)
                    count = (
                        _count(row, COUNT_PREFIX + family) if family else None
                    )
                    return count if is_thin(count) else "partner"

                blank(AGE_TABLE, age, index, columns, row["age_band"], reason)
        data[AGE_TABLE] = age.drop(columns=_count_columns(age))

    decile_plans = {}
    for table in DECILE_TABLES:
        frame = data.get(table)
        if not isinstance(frame, pd.DataFrame) or not _count_columns(frame):
            continue
        frame = frame.copy()
        record_counts(table, frame, "decile")
        for key, group in frame.groupby(["reform_id", "year"], sort=False):
            records = group.to_dict("records")
            if table == "winners_losers" or key not in decile_plans:
                decile_plans[key] = decile_plans.get(
                    key, set()
                ) | flat_decile_withholding(records)
        data[table] = frame
    for table in DECILE_TABLES:
        frame = data.get(table)
        if not isinstance(frame, pd.DataFrame) or not _count_columns(frame):
            continue
        for index, row in frame.iterrows():
            label = decile_label(row["decile"])
            if label in decile_plans.get((row["reform_id"], row["year"]), ()):
                count = _count(row, COUNT_PREFIX + "changed")
                blank(
                    table,
                    frame,
                    index,
                    {DECILE_VALUE[table]},
                    label,
                    lambda column, count=count: (
                        count if is_thin(count) else "partner"
                    ),
                )
        data[table] = frame.drop(columns=_count_columns(frame))

    metrics = data.get("metrics")
    if isinstance(metrics, pd.DataFrame) and _count_columns(metrics):
        metrics = metrics.copy()
        record_counts("metrics", metrics, None)
        for index, row in metrics.iterrows():
            columns = flat_metrics_withholding(row.to_dict())

            def reason(column, row=row):
                name = column.replace("_change_pp", "").replace(
                    "_change_pct", ""
                )
                if name == "poverty":
                    name = "poverty_abs_bhc"
                return _count(row, COUNT_PREFIX + name)

            blank("metrics", metrics, index, columns, "all", reason)
        data["metrics"] = metrics.drop(columns=_count_columns(metrics))

    columns = ["table", "reform_id", "year", "row", "column", "count"]
    return (
        data,
        pd.DataFrame(count_rows, columns=columns),
        pd.DataFrame(withheld_rows, columns=columns),
    )
