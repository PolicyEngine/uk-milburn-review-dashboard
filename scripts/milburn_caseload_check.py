#!/usr/bin/env python3
"""Baseline caseloads behind the Milburn figures, on the local build.

Reports, for one fiscal year under current law (no measure applied):

- PIP recipients aged 18 to 24 and 16 to 24, and all recipients, with spend;
- benefit units paid the UC health (LCWRA) element in which every adult is
  under 25, and all benefit units paid it, with spend.

These are the "Caseload check" figures in docs/milburn-analysis.md. The
baseline does not change with the report, so on the same build they should
reproduce exactly; the 2027-28 figures in that note are printed beside the
results.

One national baseline simulation (Microcosm build fcfac709 on
policyengine-uk 2.177.7, through ``uk_budget_data.local_build``), so it is a
heavy job: about 20 GB and a few minutes. It takes the shared heavy-run lock
(/tmp/pe-heavy.lock, one line: "<pid> <project> <job>") and refuses to start
while another live process holds it.

Run from the repository root with no Hugging Face token exported:

    unset HUGGING_FACE_TOKEN HF_TOKEN HUGGINGFACE_HUB_TOKEN
    .venv/bin/python scripts/milburn_caseload_check.py --year 2027

Use .venv/bin/python, not ``uv run``, while another job is using the venv.
Output is internal: unrounded counts from an uncertified build.
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

LOCK = Path("/tmp/pe-heavy.lock")
LOCK_PROJECT = "uk-milburn"
LOCK_JOB = "caseload-check"
TOKEN_VARIABLES = ("HUGGING_FACE_TOKEN", "HF_TOKEN", "HUGGINGFACE_HUB_TOKEN")
# docs/milburn-analysis.md, "Caseload check (baseline, 2027-28, this build)".
EXPECTED_2027 = {
    "pip_18_to_24": "347k, £2.91bn",
    "pip_16_to_24": "435k, £3.72bn",
    "pip_all": "4.29m, £32.8bn",
    "lcwra_units_all_adults_under_25": "232k",
    "lcwra_units_all": "2.79m",
}
PIP_BANDS = (("pip_18_to_24", 18, 25), ("pip_16_to_24", 16, 25))
YOUNG_AGE_LIMIT = 25


def parse_arguments(argv=None):
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--year",
        type=int,
        default=2027,
        help="Fiscal year Y for Y-(Y+1) (default: 2027, i.e. 2027-28).",
    )
    parser.add_argument(
        "--by-country",
        action="store_true",
        help="Also give each row by country (England, Wales, Scotland, "
        "Northern Ireland). Small samples: read with care.",
    )
    parser.add_argument(
        "--json",
        type=Path,
        metavar="FILE",
        help="Also write the results as JSON to FILE (keep it outside "
        "public/: every file there is a publication).",
    )
    parser.add_argument(
        "--dataset",
        type=Path,
        help="The build's microcosm_uk_2024_25.h5 if not at the default "
        "path (its SHA-256 is still checked).",
    )
    lock = parser.add_mutually_exclusive_group()
    lock.add_argument(
        "--wait",
        action="store_true",
        help="Wait for the heavy-run lock instead of exiting when another "
        "live process holds it (checks every 30 seconds).",
    )
    lock.add_argument(
        "--no-lock",
        action="store_true",
        help="Do not take the lock: only when the calling shell already "
        "holds it for this job (the runbook's take_lock loop).",
    )
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="Check the engine, the dataset's hash, the variables and the "
        "lock, then stop without building the simulation (light).",
    )
    return parser.parse_args(argv)


# The lock: one text line, "<pid> <project> <job>".


def lock_holder():
    """(pid, text) of the lock's holder, or None when there is no lock."""
    try:
        text = LOCK.read_text().strip()
    except FileNotFoundError:
        return None
    try:
        return int(text.split()[0]), text
    except (IndexError, ValueError):
        return None, text


def is_alive(pid):
    if pid is None:
        return True  # unreadable lock: treat as held, never remove it
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def take_lock(wait):
    """Create the lock for this process. A lock whose holder is dead is
    replaced; a live holder's is never touched."""
    while True:
        try:
            handle = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o644)
        except FileExistsError:
            holder = lock_holder()
            if holder is None:
                continue  # released between the two calls
            pid, text = holder
            if not is_alive(pid):
                print(f"Removing stale lock ({text}): its process is gone.")
                try:
                    LOCK.unlink()
                except FileNotFoundError:
                    pass
                continue
            if not wait:
                raise SystemExit(
                    f"{LOCK} is held by a live process ({text}). Not "
                    "started. Wait for it, pass --wait, or agree a handover "
                    "with that session."
                )
            time.sleep(30)
            continue
        with os.fdopen(handle, "w") as stream:
            stream.write(f"{os.getpid()} {LOCK_PROJECT} {LOCK_JOB}\n")
        return


def release_lock():
    """Remove the lock only if it is still this process's."""
    holder = lock_holder()
    if holder and holder[0] == os.getpid():
        LOCK.unlink()


# The figures


def _values(sim, variable, year):
    import numpy as np

    return np.asarray(sim.calculate(variable, year))


def _count(mask, weight):
    return float((mask * weight).sum())


def _amount(mask, values, weight):
    return float((mask * values * weight).sum())


def check_variables():
    """The variables read below, on the entities assumed. No dataset."""
    from policyengine_uk import CountryTaxBenefitSystem

    wanted = {
        "age": "person",
        "pip": "person",
        "person_weight": "person",
        "uc_LCWRA_element": "benunit",
        "eldest_adult_age": "benunit",
        "benunit_weight": "benunit",
        "country": "household",
    }
    variables = CountryTaxBenefitSystem().variables
    problems = []
    for name, entity in wanted.items():
        variable = variables.get(name)
        if variable is None:
            problems.append(f"{name}: not in this engine")
        elif variable.entity.key != entity:
            problems.append(
                f"{name}: on {variable.entity.key}, expected {entity}"
            )
    if problems:
        raise SystemExit("Variables: " + "; ".join(problems))


def caseloads(sim, year, by_country=False):
    """Rows of {key, label, count, spend, country}. ``spend`` is annual £,
    or None where it is not reported."""
    age = _values(sim, "age", year)
    pip = _values(sim, "pip", year)
    person_weight = _values(sim, "person_weight", year)
    element = _values(sim, "uc_LCWRA_element", year)
    eldest = _values(sim, "eldest_adult_age", year)
    benunit_weight = _values(sim, "benunit_weight", year)

    groups = [(None, age == age, element == element)]
    if by_country:
        import numpy as np

        person_country = np.asarray(
            sim.calculate("country", year, map_to="person")
        ).astype(str)
        # Each benefit unit takes its members' country (one household).
        benunit_country = np.empty(len(element), dtype=person_country.dtype)
        benunit_country[
            sim.populations["benunit"].members_entity_id
        ] = person_country
        for country in sorted(set(person_country)):
            groups.append(
                (country, person_country == country, benunit_country == country)
            )

    rows = []
    for country, people, benunits in groups:
        receives = (pip > 0) & people
        for key, low, high in PIP_BANDS:
            band = receives & (age >= low) & (age < high)
            rows.append(
                {
                    "key": key,
                    "label": f"PIP recipients aged {low} to {high - 1}",
                    "count": _count(band, person_weight),
                    "spend": _amount(band, pip, person_weight),
                    "country": country,
                }
            )
        rows.append(
            {
                "key": "pip_all",
                "label": "PIP recipients, all ages",
                "count": _count(receives, person_weight),
                "spend": _amount(receives, pip, person_weight),
                "country": country,
            }
        )
        paid = (element > 0) & benunits
        young = paid & (eldest < YOUNG_AGE_LIMIT)
        rows.append(
            {
                "key": "lcwra_units_all_adults_under_25",
                "label": "Benefit units with the LCWRA element, every "
                f"adult under {YOUNG_AGE_LIMIT}",
                "count": _count(young, benunit_weight),
                "spend": _amount(young, element, benunit_weight),
                "country": country,
            }
        )
        rows.append(
            {
                "key": "lcwra_units_all",
                "label": "Benefit units with the LCWRA element, all",
                "count": _count(paid, benunit_weight),
                "spend": _amount(paid, element, benunit_weight),
                "country": country,
            }
        )
    return rows


def _number(count):
    if count >= 1e6:
        return f"{count / 1e6:.2f}m"
    return f"{count / 1e3:.1f}k"


def print_rows(rows, year, label):
    print(f"\nBaseline caseloads, {year}-{(year + 1) % 100:02d} ({label})")
    print("Internal: uncertified build, unrounded, not for publication.\n")
    country = object()
    for row in rows:
        if row["country"] != country:
            country = row["country"]
            print(f"[{country or 'United Kingdom'}]")
        expected = ""
        if year == 2027 and row["country"] is None:
            expected = f"   (analysis note: {EXPECTED_2027[row['key']]})"
        print(
            f"  {row['label']:<62} {_number(row['count']):>8}"
            f"  £{row['spend'] / 1e9:.2f}bn{expected}"
        )


def main(argv=None):
    arguments = parse_arguments(argv)
    exported = [name for name in TOKEN_VARIABLES if os.environ.get(name)]
    if exported:
        print(
            f"Note: {', '.join(exported)} exported; uk_budget_data drops "
            "it on this engine. Unset it in the shell for other tools.",
            file=sys.stderr,
        )
    # Importing uk_budget_data first drops the token before policyengine
    # is imported (uk_budget_data/__init__.py).
    import uk_budget_data  # noqa: F401
    from uk_budget_data import local_build

    local_build.check_engine()
    dataset = local_build.check_dataset(arguments.dataset)
    check_variables()
    if os.environ.get(local_build.TEST_DATASET_ENV) == "1":
        print(f"TEST DATASET ({dataset}): the figures mean nothing.")
    else:
        print(f"Engine and dataset are the build's: {dataset}")
    if arguments.check_only:
        holder = lock_holder()
        if holder is None:
            print(f"{LOCK}: free.")
        else:
            state = "alive" if is_alive(holder[0]) else "dead (stale)"
            print(f"{LOCK}: held by '{holder[1]}', process {state}.")
        return 0

    if not arguments.no_lock:
        take_lock(arguments.wait)
    try:
        started = time.time()
        sim = local_build.build_microsimulation(arguments.dataset)
        rows = caseloads(sim, arguments.year, arguments.by_country)
    finally:
        if not arguments.no_lock:
            release_lock()
    print_rows(rows, arguments.year, local_build.LABEL)
    print(f"\n{time.time() - started:.0f} seconds.")
    if arguments.json:
        arguments.json.parent.mkdir(parents=True, exist_ok=True)
        arguments.json.write_text(
            json.dumps(
                {
                    "year": arguments.year,
                    "build": local_build.LABEL,
                    "certified": local_build.bundle_certifies(),
                    "rows": rows,
                },
                indent=2,
            )
            + "\n"
        )
        print(f"Wrote {arguments.json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
