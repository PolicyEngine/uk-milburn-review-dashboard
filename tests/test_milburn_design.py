"""The Milburn design constants (``budget_measures/milburn_design.py``),
the measures that read them and the report's ids.

Three things are shown. The 15 November designs are what they were before
the constants moved into one module: every value and every modifier default
is pinned and the phased rule gives the same draws. The report's design
(REPORT_*) is the one the published report runs were made with: they start
in April 2029, are listed (``MILBURN_PROMOTED_IDS``), and the registry's
names and descriptions are the committed ``milburn_measures.json``. And a
REPORT_* change moves the report ids only, never ``milburn_package``.

Household checks of the report ids run in 2029-30, the first year of the
report's changes; amounts are read from the current-law side of the same
household, not written out.
"""

import inspect
import json
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest

from tests.test_milburn_measures import (
    PIP_DL_STANDARD,
    PIP_M_ENHANCED,
    _with_dl,
    change,
    single,
)
from uk_budget_data import local_build, reforms
from uk_budget_data.budget_measures import (
    milburn_design as design,
)
from uk_budget_data.budget_measures import (
    milburn_report,
    milburn_variants,
)
from uk_budget_data.budget_measures import (
    pip_removed_ages_18_to_24 as pip_module,
)
from uk_budget_data.budget_measures import (
    uc_health_element_removed_under_25 as uc_module,
)
from uk_budget_data.budget_measures import (
    uc_health_element_removed_under_25_new_claims as uc_new_module,
)
from uk_budget_data.forecast import forecast_parameters
from uk_budget_data.milburn_measures import milburn_measures

pytestmark = pytest.mark.skipif(
    not local_build.engine_matches(),
    reason="pins policyengine-uk 2.179.2's 2027-28 amounts",
)

ROOT = Path(__file__).resolve().parents[1]
# A 2027-28 award (standard daily living, enhanced mobility), for the
# 15 November ids
PIP_AWARD = 52 * (PIP_DL_STANDARD + PIP_M_ENHANCED)
# The report's first year: its ids are checked in it
REPORT_YEAR = 2029
# The report's ids that are listed and published
PROMOTED = (
    "milburn_report_package",
    "milburn_report_uc_health",
    "milburn_report_pip",
    "milburn_report_employer_nics_threshold",
    "milburn_report_youth_allowance_independent",
    "milburn_report_package_phased",
    "milburn_report_employer_nics_threshold_glide_path",
    "milburn_report_youth_allowance_work_allowance",
    "milburn_report_youth_allowance_combined",
    "milburn_report_package_with_youth_allowance",
    "milburn_report_employer_nics_threshold_all_sectors",
    "milburn_report_youth_allowance_work_allowance_15h",
)
# Resolvable by id, not listed
NOT_LISTED = {
    "milburn_report_package_entry_25pct",
    "milburn_report_child_dla_to_18",
    "milburn_package_16_to_24",
    "pip_removed_under_25_excluding_scotland",
    "pip_removed_16_to_24_excluding_scotland",
    # The phased move into work's runs: inputs to the page's arithmetic
    # (scripts/milburn_entry_path.py), never listed
    *reforms.MILBURN_REPORT_ENTRY_RUN_IDS,
}


def rsingle(age, **kwargs):
    """A single adult in the report's first year."""
    return single(age, year=REPORT_YEAR, **kwargs)


def rchange(reform_id, situation, variable="household_net_income"):
    """(current law, measure) annual values in the report's first year."""
    return change(reform_id, situation, variable, year=REPORT_YEAR)


def clear_registry():
    reforms._REFORMS_CACHE = None
    reforms._REFORM_LOOKUP_CACHE = None
    reforms._RESERVED_CACHE = None


@pytest.fixture
def report(monkeypatch):
    """Set REPORT_* constants for one test; the reserved measures' text is
    rebuilt from them, and again from the committed values afterwards."""

    def set_constants(**values):
        for name, value in values.items():
            assert name.startswith("REPORT_") and hasattr(design, name)
            monkeypatch.setattr(design, name, value)
        reforms.reset_reserved_reforms()

    yield set_constants
    monkeypatch.undo()
    reforms.reset_reserved_reforms()


def test_the_report_design_is_the_published_runs():
    """The REPORT_* values the report runs under public/data were made
    with (a change here redefines them)."""
    assert {
        name: getattr(design, name)
        for name in dir(design)
        if name.startswith("REPORT_")
    } == {
        "REPORT_START_YEAR": REPORT_YEAR,
        "REPORT_START_MONTH": 4,
        "REPORT_UC_HEALTH_LOWER_AGE": 0,
        "REPORT_UC_HEALTH_UPPER_AGE": 25,
        "REPORT_UC_HEALTH_SEVERE_KEPT": False,
        "REPORT_SEVERE_DL_POINTS": 24,
        "REPORT_PIP_LOWER_AGE": 18,
        "REPORT_PIP_UPPER_AGE": 25,
        "REPORT_PIP_INCLUDE_SCOTLAND": True,
        "REPORT_PIP_REPLACEMENT_SHARE": 0.0,
        "REPORT_PIP_REPLACEMENT_SHARES": None,
        "REPORT_PIP_REPLACEMENT_NAME": None,
        "REPORT_PIP_SHARE_KEYS": (
            "daily_living_enhanced",
            "daily_living_standard",
            "mobility_enhanced",
            "mobility_standard",
        ),
        "REPORT_REASSESSED_EACH_YEAR": 0.45,
        "REPORT_NEW_ENTRANT_AGE": 18,
        "REPORT_YOUTH_ALLOWANCE_MONTHLY": None,
        "REPORT_EMPLOYER_NICS_UNDER_25_RATE": None,
        "REPORT_EMPLOYER_NICS_AGE_LIMIT": 25,
        # The phased move into work (docs/milburn-phased-scenario-design.md)
        "REPORT_ENTRY_EFFECT": 0.09,
        "REPORT_NEET_GAP_PP": {
            2026: 0.0,
            2027: 0.3,
            2028: 0.9,
            2029: 1.7,
            2030: 2.7,
            2031: 3.7,
            2036: 6.6,
        },
        "REPORT_NEET_GAP_END_YEAR": 2036,
        "REPORT_ENTRY_REBASE_YEAR": 2028,
        "REPORT_ENTRY_CHECK_SHARE": 0.25,
        "REPORT_ENTRY_PATHS": ("table3", "table3_unrebased", "flat"),
    }
    design.check_report_design()
    design.check_entry_design()


def defaults(function):
    return {
        name: parameter.default
        for name, parameter in inspect.signature(function).parameters.items()
        if parameter.default is not inspect.Parameter.empty
    }


# The 15 November designs are unchanged


def test_the_15_november_designs_are_pinned():
    assert {
        name: getattr(design, name)
        for name in dir(design)
        if name.isupper() and not name.startswith(("REPORT_", "_"))
    } == {
        "START_YEAR": 2027,
        "START_MONTH": 4,
        "UC_ELEMENT_LAST_YEAR": 2032,
        "LAST_POLICY_YEAR": 2031,
        "UC_HEALTH_LOWER_AGE": 0,
        "UC_HEALTH_UPPER_AGE": 25,
        "SEVERE_DL_POINTS": 24,
        "PIP_LOWER_AGE": 18,
        "PIP_UPPER_AGE": 25,
        "PIP_INCLUDE_SCOTLAND": True,
        "PIP_REPLACEMENT_SHARE": 0.0,
        "PIP_HALVED_SHARE": 0.5,
        "REASSESSED_EACH_YEAR": 0.25,
        "COHORT_START_YEAR": 2026,
        "NEW_ENTRANT_AGE": 18,
        "ENTRY_SHARE": 0.25,
        "ENTRY_HOURS": 16,
    }


def test_the_modifiers_defaults_are_the_literals_they_replaced():
    """As each signature read at commit 0287c2d7, plus the new arguments
    at values that change nothing."""
    assert defaults(pip_module.pip_removed_ages_18_to_24) == {
        "start_year": 2027,
        "lowest_age": 18,
        "age_limit": 25,
        "include_scotland": True,
        "share_kept": 0.0,
        "shares_kept": None,
    }
    assert defaults(uc_module.uc_health_element_removed_under_25) == {
        "start_year": 2027,
        "end_year": 2032,
        "age_limit": 25,
        "keep_enhanced_pip_daily_living": False,
        "lowest_age": 0,
        "severe_dl_points": 24,
    }
    assert defaults(
        uc_new_module.uc_health_element_removed_under_25_new_claims
    ) == {"start_year": 2027, "end_year": 2032, "age_limit": 25}
    migration = {"rate": 0.25, "cohort_start": 2026, "entrant_age": 18}
    assert defaults(milburn_variants.reached) == migration
    assert defaults(milburn_variants.lcwra_removed_under_25_phased) == {
        "start_year": 2027,
        "end_year": 2032,
        "age_limit": 25,
        "lowest_age": 0,
        **migration,
    }
    assert defaults(milburn_variants.pip_removed_18_to_24_phased) == {
        "start_year": 2027,
        "lowest_age": 18,
        "age_limit": 25,
        "include_scotland": True,
        "share_kept": 0.0,
        **migration,
        "shares_kept": None,
    }
    assert defaults(milburn_variants._employment_response) == {
        "start_year": 2027,
        "end_year": 2031,
        "hours": 16,
        "lowest_age": 18,
        "age_limit": 25,
    }
    assert (milburn_variants.START, milburn_variants.SEED) == (2026, 20261117)
    assert milburn_variants.REASSESSED_EACH_YEAR == 0.25
    assert reforms.MILBURN_FIRST_YEAR == 2027


class _People:
    """Stands in for the person population: ages and a count."""

    def __init__(self, ages):
        self.ages = np.asarray(ages)
        self.count = len(self.ages)

    def __call__(self, variable, period):
        assert variable == "age"
        return self.ages


@pytest.mark.parametrize("year", [2027, 2028, 2029, 2030, 2031, 2032])
def test_the_phased_rule_reaches_the_same_people_as_before(year):
    """The rule as written at 0287c2d7, literals and all, against the
    function with its defaults: same seed, same draw, same people."""
    people = _People(np.random.default_rng(1).integers(16, 30, 5_000))
    period = SimpleNamespace(start=SimpleNamespace(year=year))
    years = year - 2026
    before = ((people.ages - 18) < years) | (
        np.random.default_rng(20261117 + 0).random(people.count)
        < 1 - (1 - 0.25) ** years
    )
    after = milburn_variants.reached(people, period)
    assert np.array_equal(before, after)
    assert 0 < after.sum() < people.count or year >= 2038


def test_the_listed_registry_is_the_committed_measures_file():
    """Every listed name and description, written from the constants, is
    byte for byte what ``public/data/milburn_measures.json`` holds; the
    report's promoted ids are in it and the unlisted ones are not."""
    committed = (
        ROOT / "public" / "data" / "milburn_measures.json"
    ).read_text()
    assert json.dumps(milburn_measures(), indent=2) + "\n" == committed
    ids = {m["id"] for m in json.loads(committed)["measures"]}
    assert set(PROMOTED) <= ids
    assert not NOT_LISTED & ids


def test_the_text_helpers():
    assert design.start_text() == "From April 2027"
    assert design.start_text(2029, 4) == "From April 2029"
    assert design.start_text(2028, 10) == "From October 2028"
    assert design.age_band_people_text(16, 25) == "16 to 24-year-olds"
    assert design.under_text(22) == "under-22s"
    assert design.fiscal_year_text(2031) == "2031-32"
    assert design.percent_text(0.25) == "25%"


# The report's ids: promoted ones listed, the rest resolvable only


def test_reserved_ids_resolve_and_only_the_promoted_are_listed():
    assert reforms.MILBURN_PROMOTED_IDS == PROMOTED
    assert set(reforms.list_reserved_reform_ids()) == NOT_LISTED | set(
        PROMOTED
    )
    listed = reforms.list_reform_ids()
    assert listed[-len(PROMOTED) :] == list(PROMOTED)
    assert not NOT_LISTED & set(listed)
    assert not NOT_LISTED & {r.id for r in reforms.get_milburn_reforms()}
    assert not NOT_LISTED & {r.id for r in reforms.get_all_reforms()}
    for reform_id in NOT_LISTED | set(PROMOTED):
        assert reforms.get_reform(reform_id).id == reform_id
    assert reforms.get_reform("milburn_report_youth_allowance") is None
    assert reforms.get_reform("no_such_measure") is None


def test_a_promoted_id_is_listed_whichever_call_comes_first(monkeypatch):
    """Promotion puts a reserved id in the listed registry, the id list
    and milburn_measures.json alike, even when the registry is built
    before the lookup."""
    extra = "milburn_report_package_entry_25pct"
    base = len(reforms.list_reform_ids())
    monkeypatch.setattr(reforms, "MILBURN_PROMOTED_IDS", (*PROMOTED, extra))
    clear_registry()
    listed = [r.id for r in reforms.get_milburn_reforms()]
    assert listed[-1] == extra and len(listed) == base + 1
    assert reforms.list_reform_ids() == listed
    assert extra in {m["id"] for m in milburn_measures()["measures"]}
    monkeypatch.undo()
    clear_registry()
    assert len(reforms.list_reform_ids()) == base


def test_the_report_ids_are_the_15_november_designs_from_april_2029():
    """With REPORT_* as committed the report's parts are the 15 November
    removals, named the same, starting two years later."""
    for report_id, listed_id in (
        ("milburn_report_pip", "pip_removed_under_25"),
        ("milburn_report_uc_health", "uc_health_element_removed_under_25"),
    ):
        ours, theirs = reforms.get_reform(report_id), reforms.get_reform(
            listed_id
        )
        assert ours.name == theirs.name
        assert theirs.description.startswith("From April 2027 ")
        assert ours.description == theirs.description.replace(
            "From April 2027 ", "From April 2029 ", 1
        )
    listed_phased = reforms.get_reform("milburn_package_phased").description
    assert listed_phased.endswith(
        "reaching people who turned 18 since April 2026 at once, and "
        "existing claimants as they are reassessed, at an assumed 25% of "
        "those remaining each year. Who is reassessed is a random draw, as "
        "the data hold no reassessment dates."
    )
    assert "36%" not in listed_phased
    phased = reforms.get_reform("milburn_report_package_phased").description
    assert phased.endswith(
        "reaching people who turned 18 since April 2028 at once, and "
        "existing claimants as they are reassessed, at an assumed 45% of "
        "those remaining each year. Who is reassessed is a random draw, as "
        "the data hold no reassessment dates."
    )
    assert reforms.get_reform("milburn_report_package").name == (
        "Health element and PIP removal for young people, from April 2029 "
        "(combined)"
    )


def test_the_report_package_is_the_package_from_2029():
    """The 20-year-old who loses the element, PIP and the shared
    accommodation exemption: nothing moves in 2027-28, before the report's
    start; in 2029-30 the report package takes what the 15 November package
    takes."""
    before, after = change(
        "milburn_report_package", single(20, lcwra=True, pip=True)
    )
    assert after == pytest.approx(before)
    situation = rsingle(20, lcwra=True, pip=True)
    package = rchange("milburn_package", situation)
    report_package = rchange("milburn_report_package", situation)
    assert report_package == pytest.approx(package, abs=0.005)
    assert package[0] - package[1] > 0
    for variable in ("uc_LCWRA_element", "pip"):
        lost = rchange("milburn_report_package", situation, variable)
        assert lost[1] == 0 and lost[0] > 0, variable


def test_the_report_parts_from_2029():
    young = rsingle(22, lcwra=True)
    assert rchange("milburn_report_uc_health", young) == pytest.approx(
        rchange("uc_health_element_removed_under_25", young), abs=0.005
    )
    seventeen = rsingle(17, rent=0, pip=True)
    kept = rchange("milburn_report_pip", seventeen, "pip")
    assert kept[1] == pytest.approx(kept[0]) and kept[0] > 0
    entrant = rsingle(18, rent=0, pip=True)
    award = rchange("milburn_report_pip", entrant, "pip")[0]
    assert award > 0
    before, after = rchange("milburn_report_package_phased", entrant)
    assert before - after == pytest.approx(award, abs=0.05)
    assert (
        rchange("milburn_report_package_entry_25pct", entrant, "pip")[1] == 0
    )


# A report constant moves the report ids only


def test_a_report_age_band_moves_the_report_package_only(report):
    report(
        REPORT_PIP_LOWER_AGE=16,
        REPORT_UC_HEALTH_UPPER_AGE=22,
    )
    pip = reforms.get_reform("milburn_report_pip")
    assert pip.name == "PIP removed for 16 to 24-year-olds"
    assert "16 and 17-year-olds keep it" not in pip.description
    assert (
        reforms.get_reform("milburn_report_uc_health").name
        == "UC health element removed for under-22s"
    )
    # A 17-year-old on PIP: lost under the report design, kept under the
    # 15 November package.
    seventeen = rsingle(17, rent=0, pip=True)
    award = rchange("milburn_report_package", seventeen, "pip")[0]
    before, after = rchange("milburn_report_package", seventeen)
    assert before - after == pytest.approx(award, abs=0.05) and award > 0
    before, after = rchange("milburn_package", seventeen)
    assert after == pytest.approx(before)
    # A 23-year-old with LCWRA: kept under 22, lost under 25.
    older = rsingle(23, lcwra=True)
    before, after = rchange("milburn_report_package", older)
    assert after == pytest.approx(before)
    element = rchange("milburn_package", older, "uc_LCWRA_element")[0]
    before, after = rchange("milburn_package", older)
    assert before - after == pytest.approx(element, abs=0.05) and element > 0
    # The listed 15 November text did not move.
    assert (
        reforms.get_reform("pip_removed_under_25").name
        == "PIP removed for 18 to 24-year-olds"
    )


def test_a_report_lower_age_spares_younger_lcwra_claimants(report):
    report(REPORT_UC_HEALTH_LOWER_AGE=21)
    assert (
        reforms.get_reform("milburn_report_uc_health").name
        == "UC health element removed for 21 to 24-year-olds"
    )
    element = "uc_LCWRA_element"
    kept = rchange(
        "milburn_report_uc_health", rsingle(20, lcwra=True), element
    )
    assert kept[1] == pytest.approx(kept[0]) and kept[0] > 0
    lost = rchange(
        "milburn_report_uc_health", rsingle(22, lcwra=True), element
    )
    assert lost[1] == 0 and lost[0] > 0


@pytest.mark.parametrize(
    "reform_id",
    ["pip_removed_under_25_excluding_scotland", "milburn_report_pip"],
)
def test_pip_excluding_scotland_leaves_scottish_awards(reform_id, report):
    report(REPORT_PIP_INCLUDE_SCOTLAND=False)
    assert "left as they are" in reforms.get_reform(reform_id).description
    scottish = rsingle(20, rent=0, region="SCOTLAND", pip=True)
    before, after = rchange(reform_id, scottish, "pip")
    assert after == pytest.approx(before) and before > 0
    english = rsingle(20, rent=0, pip=True)
    assert rchange(reform_id, english, "pip")[1] == 0


def test_the_16_to_24_package_reaches_a_17_year_old():
    before, after = change(
        "milburn_package_16_to_24", single(17, rent=0, pip=True)
    )
    assert before - after == pytest.approx(PIP_AWARD, abs=0.05)


def test_a_replacement_share_and_start_year(report):
    report(REPORT_PIP_REPLACEMENT_SHARE=0.5, REPORT_START_YEAR=2030)
    pip = reforms.get_reform("milburn_report_pip")
    assert pip.name == "PIP at 50% of its rate for 18 to 24-year-olds"
    assert pip.description.startswith("From April 2030 people aged 18 to 24")
    # 2029-30 is before the start: nothing moves.
    before, after = rchange(
        "milburn_report_pip", rsingle(20, rent=0, pip=True)
    )
    assert after == pytest.approx(before)


def test_the_report_youth_allowance_takes_given_amounts(report):
    monthly = {
        year: (400.0 + year - REPORT_YEAR, 630.0)
        for year in range(REPORT_YEAR, 2032)
    }
    report(REPORT_YOUTH_ALLOWANCE_MONTHLY=monthly)
    measure = reforms.get_reform("milburn_report_youth_allowance")
    path = f"{reforms.UC_STANDARD_ALLOWANCE}.SINGLE_YOUNG"
    assert measure.parameter_changes[path]["2029"] == 400.0
    assert measure.parameter_changes[path]["2031"] == 402.0
    couple = f"{reforms.UC_STANDARD_ALLOWANCE}.COUPLE_YOUNG"
    assert measure.parameter_changes[couple]["2030"] == 630.0
    assert "£400.00 a month" in measure.description
    # A single 21-year-old: 12 x (£400 less the under-25 allowance) more.
    current = forecast_parameters().gov.dwp.universal_credit.standard_allowance
    young = current.amount.SINGLE_YOUNG(f"{REPORT_YEAR}-04-30")
    assert 0 < young < 400
    before, after = rchange("milburn_report_youth_allowance", rsingle(21))
    assert after - before == pytest.approx(12 * (400 - young), abs=0.05)


def test_a_design_the_modifiers_cannot_run_is_refused(report, monkeypatch):
    monkeypatch.setattr(design, "REPORT_START_MONTH", 10)
    with pytest.raises(ValueError, match="REPORT_START_MONTH"):
        design.check_report_design()
    with pytest.raises(ValueError, match="REPORT_START_MONTH"):
        milburn_report.milburn_report_pip(None)
    monkeypatch.setattr(design, "REPORT_START_MONTH", 4)
    monkeypatch.setattr(
        design, "REPORT_YOUTH_ALLOWANCE_MONTHLY", {2027: (400.0, 630.0)}
    )
    with pytest.raises(ValueError, match="every year"):
        design.check_report_design()


# The report's reduced employer National Insurance rate (a design option;
# the report's own proposal is the threshold, milburn_employer_nics_report)

NICS = "milburn_report_employer_nics"
NICS_VARIABLES = (
    "ni_class_1_employer",
    "employment_income",
    "household_net_income",
)
MAIN_RATE = 0.15
HALF_RATE = 0.075


def half_rate_case(situation, pay=20_000):
    """The pay rise and charge at 7.5% for an employee on ``pay`` in the
    band, from the current-law charge: the secondary threshold is pay less
    charge / 15% (uprated from £5,000 by 2029-30), the employer's cost is
    held, so the new pay x solves x + 7.5% x (x - threshold) = cost."""
    charge = rchange(NICS, situation, "ni_class_1_employer")[0]
    threshold = pay - charge / MAIN_RATE
    assert 5_000 <= threshold < 5_100
    new_pay = (pay + charge + HALF_RATE * threshold) / (1 + HALF_RATE)
    return new_pay - pay, HALF_RATE * (new_pay - threshold), threshold


def test_the_employer_nics_id_exists_only_while_a_rate_is_set(report):
    assert design.REPORT_EMPLOYER_NICS_UNDER_25_RATE is None
    assert design.REPORT_EMPLOYER_NICS_AGE_LIMIT == 25
    assert reforms.get_reform(NICS) is None
    with pytest.raises(ValueError, match="REPORT_EMPLOYER_NICS_UNDER_25_RATE"):
        milburn_report.milburn_report_employer_nics(None)
    report(REPORT_EMPLOYER_NICS_UNDER_25_RATE=0.075)
    measure = reforms.get_reform(NICS)
    assert measure.name == "Employer NICs at 7.5% for under-25s"
    assert measure.description.startswith(
        "From April 2029 employers pay Class 1 National Insurance at 7.5%, "
        "not the main 15%, on earnings between the secondary threshold and "
        "the upper secondary threshold (£50,270 a year) for employees "
        "under 25;"
    )
    # Reserved: resolvable, not listed, and in the report package.
    assert NICS in reforms.list_reserved_reform_ids()
    assert NICS not in reforms.list_reform_ids()
    assert NICS not in {r.id for r in reforms.get_milburn_reforms()}
    package = reforms.get_reform("milburn_report_package").description
    assert (
        "PIP removed for 18 to 24-year-olds; Employer NICs at 7.5% for "
        "under-25s." in package
    )
    for variant in (
        "milburn_report_package_phased",
        "milburn_report_package_entry_25pct",
    ):
        assert reforms.get_reform(variant).description.endswith(
            "The report's employer National Insurance rate is not part of "
            "this run."
        )


def test_the_employer_nics_id_can_be_promoted(report, monkeypatch):
    base = len(reforms.list_reform_ids())
    report(REPORT_EMPLOYER_NICS_UNDER_25_RATE=0.075)
    monkeypatch.setattr(reforms, "MILBURN_PROMOTED_IDS", (*PROMOTED, NICS))
    clear_registry()
    listed = reforms.list_reform_ids()
    assert listed[-1] == NICS and len(listed) == base + 1
    monkeypatch.undo()
    clear_registry()
    assert len(reforms.list_reform_ids()) == base


@pytest.mark.parametrize("pay", [20_000, 60_000])
def test_employer_nics_at_the_main_rate_change_nothing(report, pay):
    report(REPORT_EMPLOYER_NICS_UNDER_25_RATE=0.15)
    situation = rsingle(23, rent=0, employment_income=pay)
    for variable in NICS_VARIABLES:
        before, after = rchange(NICS, situation, variable)
        assert after == pytest.approx(before, abs=0.01) and before > 0


@pytest.mark.parametrize("pay", [4_000, 20_000, 50_000, 60_000])
def test_employer_nics_at_a_zero_rate_are_the_zero_rate_comparator(
    report, pay
):
    """Charge, pay and net income, below the secondary threshold, in the
    band, where the pay rise crosses the upper secondary threshold, and
    above it."""
    report(REPORT_EMPLOYER_NICS_UNDER_25_RATE=0.0)
    situation = rsingle(23, rent=0, employment_income=pay)
    for variable in NICS_VARIABLES:
        ours = rchange(NICS, situation, variable)
        theirs = rchange("employer_nics_zero_under_25", situation, variable)
        assert ours == pytest.approx(theirs, abs=0.02)
    if pay == 20_000:
        charge = rchange(NICS, situation, "ni_class_1_employer")
        assert charge[0] > 2_200 and charge[1] == 0


def test_employer_nics_at_half_the_main_rate(report):
    """A 23-year-old on £20,000 in 2029-30. The employer's cost (pay plus
    15% above the secondary threshold) is held, so the relief goes to pay
    (half_rate_case; about £1,044 more pay and a £1,201 charge)."""
    report(REPORT_EMPLOYER_NICS_UNDER_25_RATE=HALF_RATE)
    situation = rsingle(23, rent=0, employment_income=20_000)
    rise, new_charge, _ = half_rate_case(situation)
    pay = rchange(NICS, situation, "employment_income")
    assert pay[1] - pay[0] == pytest.approx(rise, abs=0.05)
    charge = rchange(NICS, situation, "ni_class_1_employer")
    assert charge[1] == pytest.approx(new_charge, abs=0.05)
    before, after = rchange(NICS, situation)
    assert after - before == pytest.approx(rise * (1 - 0.20 - 0.08), abs=1)
    # Between the zero-rate comparator and current law.
    zero = rchange("employer_nics_zero_under_25", situation)
    assert before < after < zero[1]
    # Above the upper secondary threshold the band is relieved in full:
    # 7.5% of the band's £45,270 (£50,270 less £5,000, both thresholds
    # moving together) less cost, all of it pay, on which the main rate is
    # then due: £3,395.25 / 1.15 = £2,952.39.
    high = rsingle(23, rent=0, employment_income=60_000)
    pay = rchange(NICS, high, "employment_income")
    assert pay[1] - pay[0] == pytest.approx(
        HALF_RATE * 45_270 / (1 + MAIN_RATE), abs=0.5
    )


@pytest.mark.parametrize("age", [19, 25, 30])
def test_employer_nics_outside_the_age_band_are_unchanged(report, age):
    """A 30-year-old (and a 25-year-old) is over the limit; a 19-year-old
    keeps the under-21 zero rate."""
    report(REPORT_EMPLOYER_NICS_UNDER_25_RATE=0.075)
    situation = rsingle(age, rent=0, employment_income=20_000)
    for variable in NICS_VARIABLES:
        before, after = rchange(NICS, situation, variable)
        assert after == before
    charge = rchange(NICS, situation, "ni_class_1_employer")[0]
    assert (charge == 0) == (age < 21)


def test_the_employer_nics_age_limit_and_start_year(report):
    report(
        REPORT_EMPLOYER_NICS_UNDER_25_RATE=0.075,
        REPORT_EMPLOYER_NICS_AGE_LIMIT=22,
    )
    assert (
        reforms.get_reform(NICS).name == "Employer NICs at 7.5% for under-22s"
    )
    kept = rchange(
        NICS,
        rsingle(23, rent=0, employment_income=20_000),
        "employment_income",
    )
    assert kept[1] == kept[0]
    young = rsingle(21, rent=0, employment_income=20_000)
    moved = rchange(NICS, young, "employment_income")
    assert moved[1] - moved[0] == pytest.approx(
        half_rate_case(young)[0], abs=0.05
    )
    report(REPORT_EMPLOYER_NICS_UNDER_25_RATE=0.075, REPORT_START_YEAR=2030)
    later = rchange(
        NICS,
        rsingle(21, rent=0, employment_income=20_000),
        "employment_income",
    )
    assert later[1] == later[0]


def test_the_report_package_takes_the_employer_rate_and_the_package_does_not(
    report,
):
    report(REPORT_EMPLOYER_NICS_UNDER_25_RATE=0.075)
    employee = rsingle(23, rent=0, employment_income=20_000)
    pay = rchange("milburn_report_package", employee, "employment_income")
    assert pay[1] - pay[0] == pytest.approx(
        half_rate_case(employee)[0], abs=0.05
    )
    pay = rchange("milburn_package", employee, "employment_income")
    assert pay[1] == pay[0]
    # The benefit changes are still in it.
    claimant = rsingle(20, lcwra=True, pip=True)
    assert rchange("milburn_report_package", claimant) == pytest.approx(
        rchange("milburn_package", claimant), abs=0.005
    )


# The report's tiered PIP replacement (a design option)

ENHANCED_ONLY = {
    "daily_living_enhanced": 1.0,
    "daily_living_standard": 0.0,
    "mobility_enhanced": 1.0,
    "mobility_standard": 0.0,
}
PIP_VARIABLES = ("pip_dl", "pip_m", "pip", "household_net_income")


def uniform(share):
    return dict.fromkeys(design.REPORT_PIP_SHARE_KEYS, share)


def claimant_situation(claimant):
    return (
        rsingle(20, rent=0, pip=True)
        if claimant == "pip_only"
        else rsingle(20, lcwra=True, pip=True)
    )


@pytest.mark.parametrize("claimant", ["pip_only", "lcwra_renter"])
def test_tiered_shares_of_one_are_current_law(report, claimant):
    assert design.REPORT_PIP_REPLACEMENT_SHARES is None
    report(REPORT_PIP_REPLACEMENT_SHARES=uniform(1.0))
    assert reforms.get_reform("milburn_report_pip").name == (
        "PIP unchanged for 18 to 24-year-olds"
    )
    situation = claimant_situation(claimant)
    for variable in PIP_VARIABLES:
        before, after = rchange("milburn_report_pip", situation, variable)
        assert after == pytest.approx(before, abs=0.005) and before > 0


@pytest.mark.parametrize("claimant", ["pip_only", "lcwra_renter"])
def test_tiered_shares_of_zero_are_full_removal(report, claimant):
    """Amounts and what passports off them (the renter also loses the
    shared accommodation exemption) move as under the listed removal."""
    report(REPORT_PIP_REPLACEMENT_SHARES=uniform(0.0))
    pip = reforms.get_reform("milburn_report_pip")
    assert pip.name == reforms.get_reform("pip_removed_under_25").name
    situation = claimant_situation(claimant)
    for variable in PIP_VARIABLES:
        ours = rchange("milburn_report_pip", situation, variable)
        theirs = rchange("pip_removed_under_25", situation, variable)
        assert ours == pytest.approx(theirs, abs=0.005)
    assert rchange("milburn_report_pip", situation, "pip")[1] == 0
    assert rchange("milburn_report_package", situation) == pytest.approx(
        rchange("milburn_package", situation), abs=0.005
    )


def test_tiered_shares_of_a_half_are_the_half_rate_measure(report):
    report(REPORT_PIP_REPLACEMENT_SHARES=uniform(0.5))
    situation = rsingle(20, lcwra=True, pip=True)
    for variable in PIP_VARIABLES:
        ours = rchange("milburn_report_pip", situation, variable)
        theirs = rchange("pip_halved_under_25", situation, variable)
        assert ours == pytest.approx(theirs, abs=0.005)


def test_enhanced_only_keeps_the_enhanced_award(report):
    """Standard daily living with enhanced mobility: the first goes, the
    second stays."""
    report(REPORT_PIP_REPLACEMENT_SHARES=ENHANCED_ONLY)
    pip = reforms.get_reform("milburn_report_pip")
    assert (
        pip.name == "PIP kept only at the enhanced rate for 18 to 24-year-olds"
    )
    assert (
        "the daily living component is paid in full at the enhanced rate "
        "and no longer paid at the standard rate; the mobility component "
        "is paid in full at the enhanced rate and no longer paid at the "
        "standard rate." in pip.description
    )
    mixed = rsingle(20, rent=0, pip=True)
    daily_living = rchange("milburn_report_pip", mixed, "pip_dl")
    assert daily_living[0] > 0 and daily_living[1] == pytest.approx(0)
    mobility = rchange("milburn_report_pip", mixed, "pip_m")
    assert mobility[1] == pytest.approx(mobility[0]) and mobility[0] > 0
    before, after = rchange("milburn_report_pip", mixed)
    assert before - after == pytest.approx(daily_living[0], abs=0.05)
    # Enhanced daily living alone: kept whole. Standard alone: removed.
    enhanced = _with_dl(rsingle(20, rent=0), "ENHANCED", year=REPORT_YEAR)
    for variable in ("pip", "household_net_income"):
        before, after = rchange("milburn_report_pip", enhanced, variable)
        assert after == pytest.approx(before) and before > 0
    standard = _with_dl(rsingle(20, rent=0), "STANDARD", year=REPORT_YEAR)
    assert rchange("milburn_report_pip", standard, "pip")[1] == 0
    # Outside the age band nothing moves.
    older = rsingle(26, rent=0, pip=True)
    before, after = rchange("milburn_report_pip", older, "pip")
    assert after == pytest.approx(before) and before > 0


def test_the_tiered_shares_replace_the_uniform_share_in_every_report_id(
    report,
):
    report(
        REPORT_PIP_REPLACEMENT_SHARES=ENHANCED_ONLY,
        REPORT_PIP_REPLACEMENT_SHARE=0.5,
    )
    entrant = rsingle(18, rent=0, pip=True)
    award = rchange("milburn_report_pip", entrant, "pip")[0]
    kept = rchange("milburn_report_pip", entrant, "pip_m")[0]
    assert 0 < kept < award
    for report_id in (
        "milburn_report_pip",
        "milburn_report_package",
        "milburn_report_package_phased",
        "milburn_report_package_entry_25pct",
    ):
        before, after = rchange(report_id, entrant, "pip")
        assert (before, after) == pytest.approx((award, kept), abs=0.05)
    assert (
        "PIP kept only at the enhanced rate for 18 to 24-year-olds"
        in reforms.get_reform("milburn_report_package").description
    )
    # The 15 November package still removes the whole award.
    assert rchange("milburn_package", entrant, "pip")[1] == 0
    assert rchange("milburn_package_phased", entrant, "pip")[1] == 0


def test_a_share_above_one_pays_more(report):
    shares = {**ENHANCED_ONLY, "mobility_enhanced": 1.2}
    report(REPORT_PIP_REPLACEMENT_SHARES=shares)
    pip = reforms.get_reform("milburn_report_pip")
    assert pip.name == "PIP replaced by tiered support for 18 to 24-year-olds"
    assert (
        "paid at 120% of its current amount at the enhanced rate"
        in pip.description
    )
    before, after = rchange(
        "milburn_report_pip", rsingle(20, rent=0, pip=True), "pip_m"
    )
    assert after == pytest.approx(1.2 * before, abs=0.05) and before > 0


def test_new_report_constants_the_modifiers_cannot_run_are_refused(
    report, monkeypatch
):
    for name, value, match in (
        (
            "REPORT_PIP_REPLACEMENT_SHARES",
            {"daily_living_enhanced": 1.0},
            "SHARES",
        ),
        (
            "REPORT_PIP_REPLACEMENT_SHARES",
            {**ENHANCED_ONLY, "other": 1.0},
            "SHARES",
        ),
        ("REPORT_PIP_REPLACEMENT_SHARES", uniform(-0.5), "SHARES"),
        ("REPORT_PIP_REPLACEMENT_SHARES", 0.5, "SHARES"),
        ("REPORT_EMPLOYER_NICS_UNDER_25_RATE", 7.5, "RATE"),
        ("REPORT_EMPLOYER_NICS_UNDER_25_RATE", -0.01, "RATE"),
        ("REPORT_EMPLOYER_NICS_AGE_LIMIT", 21, "AGE_LIMIT"),
        ("REPORT_PIP_REPLACEMENT_NAME", "", "NAME"),
    ):
        monkeypatch.setattr(design, name, value)
        with pytest.raises(ValueError, match=match):
            design.check_report_design()
        monkeypatch.undo()
    design.check_report_design()


# PIP from 16, Scotland left alone, replaced by an additional cost
# allowance: the 17 November briefing's design, kept as an option


@pytest.mark.parametrize(
    "report_id", ["milburn_report_pip", "milburn_report_package"]
)
def test_pip_from_16_excluding_scotland(report, report_id):
    report(REPORT_PIP_LOWER_AGE=16, REPORT_PIP_INCLUDE_SCOTLAND=False)
    pip = reforms.get_reform("milburn_report_pip")
    assert pip.name == "PIP removed for 16 to 24-year-olds"
    assert "left as they are" in pip.description
    # A 17-year-old in England loses PIP.
    english = rsingle(17, rent=0, pip=True)
    award, after = rchange(report_id, english, "pip")
    assert award > 0 and after == pytest.approx(0, abs=0.05)
    before, after = rchange(report_id, english)
    assert before - after == pytest.approx(award, abs=0.05)
    # A 20-year-old in Scotland keeps it.
    scottish = rsingle(20, rent=0, region="SCOTLAND", pip=True)
    before, after = rchange(report_id, scottish, "pip")
    assert after == pytest.approx(before) and before > 0
    before, after = rchange(report_id, scottish)
    assert after == pytest.approx(before)
    # The health element removal in the package is UK-wide.
    if report_id == "milburn_report_package":
        element = "uc_LCWRA_element"
        lost = rchange(
            report_id, rsingle(20, lcwra=True, region="SCOTLAND"), element
        )
        assert lost[1] == 0 and lost[0] > 0


def test_the_briefed_design_with_an_additional_cost_allowance(report):
    """PIP from 16 outside Scotland, with enhanced awards standing in for
    the additional cost allowance."""
    report(
        REPORT_PIP_LOWER_AGE=16,
        REPORT_PIP_INCLUDE_SCOTLAND=False,
        REPORT_PIP_REPLACEMENT_SHARES=ENHANCED_ONLY,
        REPORT_PIP_REPLACEMENT_NAME="additional cost allowance",
    )
    pip = reforms.get_reform("milburn_report_pip")
    assert pip.name == (
        "PIP replaced by an additional cost allowance for 16 to 24-year-olds"
    )
    assert (
        "stand in for the report's additional cost allowance"
        in pip.description
    )
    assert pip.name in reforms.get_reform("milburn_report_package").description
    english = rsingle(17, rent=0, pip=True)
    award = rchange("milburn_report_pip", english, "pip")[0]
    kept = rchange("milburn_report_pip", english, "pip_m")[0]
    for report_id in ("milburn_report_pip", "milburn_report_package"):
        assert rchange(report_id, english, "pip") == pytest.approx(
            (award, kept), abs=0.05
        )
        scottish = rsingle(20, rent=0, region="SCOTLAND", pip=True)
        before, after = rchange(report_id, scottish, "pip")
        assert after == pytest.approx(before) and before > 0
    # The name alone moves no figure, and labels a uniform share too.
    report(
        REPORT_PIP_LOWER_AGE=18,
        REPORT_PIP_REPLACEMENT_SHARES=None,
        REPORT_PIP_REPLACEMENT_SHARE=0.5,
    )
    pip = reforms.get_reform("milburn_report_pip")
    assert pip.name == (
        "PIP replaced by an additional cost allowance for 18 to 24-year-olds"
    )
    report(REPORT_PIP_REPLACEMENT_SHARE=0.0)
    assert reforms.get_reform("milburn_report_pip").name == (
        "PIP removed for 18 to 24-year-olds"
    )
