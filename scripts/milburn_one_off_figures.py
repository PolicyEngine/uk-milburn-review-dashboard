#!/usr/bin/env python3
"""The PolicyEngine figures that Benchmarks and Methodology quote but no run
file holds, on the local build. Staging only: never written to public/.

From one baseline simulation (current law, no measure) it reports:

- 2025 (2025-26 rules), Benchmarks:
  - people aged 16 to 24 receiving the Universal Credit health element
    (LCWRA), Great Britain: an assessed claimant with LCWRA, under the
    measure's own claimant mask
    (``budget_measures/uc_health_element_removed_under_25.py``), in a benefit
    unit paid the element; and the share of them who also receive PIP;
  - PIP recipients aged 16 to 24 in England and Wales, and their PIP spend;
  - the health element paid to benefit units in which a claimant with LCWRA
    is 16 to 24 and none is 25 or over, Great Britain;
  - employees aged 18 to 24 (employment income above zero), UK;
  - the gross static cost of a zero employer National Insurance rate for
    21 to 24-year-olds up to the upper secondary threshold, on top of the
    existing zero rate for under-21s, UK: for each 21 to 24-year-old, the
    smaller of their Class 1 employer contributions and the rate times the
    band from the secondary to the upper secondary threshold.
- 2029 (2029-30), Methodology "Carer's Allowance and PIP": the PIP paid to
  18 to 24-year-olds across the UK, which the report's PIP run removes (the
  rest of that run's saving is the knock-on effects).

With ``--benefit-cap`` it also runs the higher Youth Allowance
(``milburn_report_youth_allowance_independent``) for 2029-30 and reports the
benefit units at the benefit cap whose net income falls: their weighted
count, the survey households behind them and the 10th to 90th percentile of
their loss (a range over records would rest on single households).

One or two national simulations, so a heavy job: it takes the shared
heavy-run lock (/tmp/pe-heavy.lock), waiting while a live process holds it.
Run from the repository root with no Hugging Face token exported:

    unset HUGGING_FACE_TOKEN HF_TOKEN HUGGINGFACE_HUB_TOKEN
    .venv/bin/python scripts/milburn_one_off_figures.py --benefit-cap \\
        --json ~/milburn-runs/<date>/one_off_figures.json
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

LOCK = Path("/tmp/pe-heavy.lock")
LOCK_TEXT = f"{os.getpid()} uk-milburn one-off-figures"
GB = ("ENGLAND", "WALES", "SCOTLAND")
EW = ("ENGLAND", "WALES")
YA_RUN = "milburn_report_youth_allowance_independent"


def take_lock():
    while True:
        try:
            handle = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o644)
        except FileExistsError:
            try:
                pid = int(LOCK.read_text().split()[0])
                os.kill(pid, 0)
            except (ValueError, IndexError, FileNotFoundError):
                time.sleep(5)
                continue
            except ProcessLookupError:
                LOCK.unlink(missing_ok=True)
                continue
            print(time.strftime("%H:%M"), "waiting for", LOCK, flush=True)
            time.sleep(30)
            continue
        with os.fdopen(handle, "w") as stream:
            stream.write(LOCK_TEXT + "\n")
        return


def release_lock():
    try:
        if LOCK.read_text().strip() == LOCK_TEXT:
            LOCK.unlink()
    except FileNotFoundError:
        pass


def wsum(values, weight):
    """A weighted sum (elementwise, not a matrix product)."""
    import numpy as np

    return float(np.sum(np.asarray(values, dtype=float) * weight))


def person_values(sim, variable, year, **kwargs):
    import numpy as np

    return np.asarray(sim.calculate(variable, year, **kwargs))


def lcwra_claimants(sim, year):
    """The measure's claimant mask: an assessed claimant with LCWRA who is
    not the other member of a single claim."""
    import numpy as np
    from policyengine_core.periods import period as as_period
    from policyengine_uk.utils.uc_work_related_requirements import (
        other_member_of_single_claim,
    )

    person = sim.populations["person"]
    period = as_period(year)
    claimant = person("is_uc_assessed_claimant", period) & ~(
        other_member_of_single_claim(person, period)
    )
    return np.asarray(
        claimant & person("uc_limited_capability_for_WRA", period)
    )


def baseline_figures(sim):
    import numpy as np

    out = {}
    year = 2025
    age = person_values(sim, "age", year)
    weight = person_values(sim, "person_weight", year)
    pip = person_values(sim, "pip", year)
    country = person_values(sim, "country", year, map_to="person").astype(str)
    element_person = person_values(
        sim, "uc_LCWRA_element", year, map_to="person"
    )
    benunit = sim.populations["benunit"]
    lcwra = lcwra_claimants(sim, year)
    young = (age >= 16) & (age < 25)
    gb = np.isin(country, GB)
    ew = np.isin(country, EW)

    # Benefit units that take up Universal Credit: the element is computed
    # whether or not the unit claims, so receipt needs a UC award.
    receives_uc = (
        person_values(sim, "universal_credit", year, map_to="person") > 0
    )
    young_lcwra = lcwra & young & (element_person > 0) & receives_uc & gb
    count = wsum(young_lcwra, weight)
    with_pip = wsum(young_lcwra & (pip > 0), weight)
    out["uc_health_16_24_gb_2025"] = count
    out["uc_health_16_24_ew_2025"] = wsum(
        lcwra & young & (element_person > 0) & receives_uc & ew, weight
    )
    out["uc_health_16_24_with_pip_pct_2025"] = 100 * with_pip / count

    pip_young_ew = (pip > 0) & young & ew
    out["pip_16_24_ew_2025"] = wsum(pip_young_ew, weight)
    out["pip_16_24_ew_spend_2025"] = wsum(pip_young_ew * pip, weight)

    # Benefit units in which a claimant with LCWRA is 16 to 24 and none is
    # 25 or over: the element the under-25 removal takes.
    element = person_values(sim, "uc_LCWRA_element", year)
    benunit_weight = person_values(sim, "benunit_weight", year)
    has_young = np.asarray(benunit.any(lcwra & young))
    has_older = np.asarray(benunit.any(lcwra & (age >= 25)))
    # Each benefit unit takes its members' country (one household).
    benunit_country = np.empty(len(element), dtype=country.dtype)
    benunit_country[benunit.members_entity_id] = country
    unit_uc = person_values(sim, "universal_credit", year) > 0
    young_units = (
        has_young & ~has_older & unit_uc & np.isin(benunit_country, GB)
    )
    out["uc_health_young_units_gb_2025"] = wsum(
        young_units & (element > 0), benunit_weight
    )
    out["uc_health_young_units_gb_spend_2025"] = wsum(
        young_units * element, benunit_weight
    )

    employment = person_values(sim, "employment_income", year)
    out["employees_18_24_uk_2025"] = wsum(
        (employment > 0) & (age >= 18) & (age < 25), weight
    )

    params = sim.tax_benefit_system.parameters(f"{year}-06-01")
    class_1 = params.gov.hmrc.national_insurance.class_1
    rate = float(class_1.rates.employer)
    secondary = float(class_1.thresholds.secondary_threshold) * 52
    upper = float(class_1.thresholds.upper_secondary_threshold) * 52
    employer = person_values(sim, "ni_class_1_employer", year)
    band = (age >= 21) & (age < 25)
    cost = np.minimum(employer, rate * max(upper - secondary, 0.0))
    out["employer_nics_zero_21_24_cost_2025"] = wsum(band * cost, weight)
    out["employer_nics_parameters_2025"] = {
        "rate": rate,
        "secondary_threshold_year": secondary,
        "upper_secondary_threshold_year": upper,
    }

    year = 2029
    age = person_values(sim, "age", year)
    weight = person_values(sim, "person_weight", year)
    pip = person_values(sim, "pip", year)
    lcwra = lcwra_claimants(sim, year)
    element_person = person_values(
        sim, "uc_LCWRA_element", year, map_to="person"
    )
    receives_uc = (
        person_values(sim, "universal_credit", year, map_to="person") > 0
    )
    young = (age >= 16) & (age < 25)
    out["uc_health_16_24_uk_2029"] = wsum(
        lcwra & young & (element_person > 0) & receives_uc, weight
    )
    band = (age >= 18) & (age < 25)
    out["pip_18_24_uk_spend_2029"] = wsum(band * pip, weight)
    return out


def benefit_cap_figures(baseline, dataset_path):
    import numpy as np

    from uk_budget_data.pipeline import (
        build_microsimulation,
        scatter_survey_households,
    )
    from uk_budget_data.reforms import get_reform

    year = 2029
    reform = get_reform(YA_RUN)
    reformed = build_microsimulation(dataset_path, reform.to_scenario())
    cap_base = person_values(baseline, "benefit_cap_reduction", year)
    cap_reform = person_values(reformed, "benefit_cap_reduction", year)
    capped = (cap_base > 0) | (cap_reform > 0)
    # Each benefit unit's household, through its members (the engine's
    # household and benefit unit orders).
    benunit = baseline.populations["benunit"]
    household = baseline.populations["household"]
    unit_household = np.empty(len(cap_base), dtype=int)
    unit_household[benunit.members_entity_id] = household.members_entity_id
    household_change = person_values(
        reformed, "household_net_income", year
    ) - person_values(baseline, "household_net_income", year)
    change = household_change[unit_household]
    weight = person_values(baseline, "benunit_weight", year)
    losers = capped & (change < -1)
    survey = np.asarray(scatter_survey_households(baseline, dataset_path))
    survey_of_unit = survey[unit_household]
    losses = -change[losers]
    return {
        "benefit_cap_losers_units_2029": wsum(losers, weight),
        "benefit_cap_losers_records_2029": int(losers.sum()),
        "benefit_cap_losers_survey_households_2029": int(
            len(set(survey_of_unit[losers]))
        ),
        "benefit_cap_loss_p10_2029": (
            float(np.percentile(losses, 10)) if len(losses) else None
        ),
        "benefit_cap_loss_median_2029": (
            float(np.percentile(losses, 50)) if len(losses) else None
        ),
        "benefit_cap_loss_p90_2029": (
            float(np.percentile(losses, 90)) if len(losses) else None
        ),
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--benefit-cap", action="store_true")
    parser.add_argument("--json", type=Path, required=True)
    args = parser.parse_args(argv)
    for name in ("HUGGING_FACE_TOKEN", "HF_TOKEN", "HUGGINGFACE_HUB_TOKEN"):
        os.environ.pop(name, None)
    if str(args.json.resolve()).startswith(str(ROOT / "public")):
        raise SystemExit("Write outside public/: these figures are unfloored.")

    from uk_budget_data import local_build
    from uk_budget_data.models import DataConfig
    from uk_budget_data.pipeline import build_microsimulation
    from uk_budget_data.reforms import get_reform

    local_build.check_engine()
    local_build.check_dataset()
    take_lock()
    try:
        config = DataConfig()
        dataset_path = (
            str(config.dataset_path) if config.dataset_path else None
        )
        reform = get_reform(YA_RUN)
        baseline = build_microsimulation(
            dataset_path, reform.baseline_scenario_for(config)
        )
        figures = {"build": local_build.LABEL, **baseline_figures(baseline)}
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(figures, indent=2) + "\n")
        print(json.dumps(figures, indent=2), flush=True)
        if args.benefit_cap:
            figures.update(benefit_cap_figures(baseline, dataset_path))
    finally:
        release_lock()
    args.json.parent.mkdir(parents=True, exist_ok=True)
    args.json.write_text(json.dumps(figures, indent=2) + "\n")
    print(json.dumps(figures, indent=2))


if __name__ == "__main__":
    main()
