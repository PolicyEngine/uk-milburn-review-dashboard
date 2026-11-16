"""The Milburn design constants (``budget_measures/milburn_design.py``),
the measures that read them and the reserved report ids.

Three things are shown. The 15 November designs are what they were before
the constants moved into one module: every value and every modifier default
is pinned, the phased rule gives the same draws, and the registry's names
and descriptions are the committed ``milburn_measures.json``. The report
ids equal the 15 November ones while the REPORT_* constants equal theirs.
And a REPORT_* change moves the report ids only, never ``milburn_package``.
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
    PROTECTED_LCWRA,
    change,
    single,
)
from uk_budget_data import local_build, reforms
from uk_budget_data.budget_measures import (
    milburn_design as design,
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
from uk_budget_data.milburn_measures import milburn_measures

pytestmark = pytest.mark.skipif(
    not local_build.engine_matches(),
    reason="pins policyengine-uk 2.177.7's 2027-28 amounts",
)

ROOT = Path(__file__).resolve().parents[1]
PIP_AWARD = 52 * (PIP_DL_STANDARD + PIP_M_ENHANCED)
RESERVED = {
    "milburn_report_package",
    "milburn_report_pip",
    "milburn_report_uc_health",
    "milburn_report_package_phased",
    "milburn_report_package_entry_25pct",
    "milburn_package_16_to_24",
    "pip_removed_under_25_excluding_scotland",
    "pip_removed_16_to_24_excluding_scotland",
}


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
    byte for byte what ``public/data/milburn_measures.json`` holds; no
    reserved id is in it."""
    committed = (ROOT / "public" / "data" / "milburn_measures.json").read_text()
    assert json.dumps(milburn_measures(), indent=2) + "\n" == committed
    assert not RESERVED & {m["id"] for m in json.loads(committed)["measures"]}


def test_the_text_helpers():
    assert design.start_text() == "From April 2027"
    assert design.start_text(2028, 10) == "From October 2028"
    assert design.age_band_people_text(16, 25) == "16 to 24-year-olds"
    assert design.under_text(22) == "under-22s"
    assert design.fiscal_year_text(2031) == "2031-32"
    assert design.percent_text(0.25) == "25%"


# Reserved ids: resolvable, not listed


def test_reserved_ids_resolve_but_are_not_listed():
    assert set(reforms.list_reserved_reform_ids()) == RESERVED
    assert not RESERVED & set(reforms.list_reform_ids())
    assert not RESERVED & {r.id for r in reforms.get_milburn_reforms()}
    assert not RESERVED & {r.id for r in reforms.get_all_reforms()}
    for reform_id in RESERVED:
        assert reforms.get_reform(reform_id).id == reform_id
    assert reforms.MILBURN_PROMOTED_IDS == ()
    assert reforms.get_reform("milburn_report_youth_allowance") is None
    assert reforms.get_reform("no_such_measure") is None


def test_a_promoted_id_is_listed_whichever_call_comes_first(monkeypatch):
    """Promotion puts a reserved id in the listed registry, the id list
    and milburn_measures.json alike, even when the registry is built
    before the lookup."""

    def clear():
        monkeypatch.setattr(reforms, "_REFORMS_CACHE", None)
        monkeypatch.setattr(reforms, "_REFORM_LOOKUP_CACHE", None)
        monkeypatch.setattr(reforms, "_RESERVED_CACHE", None)

    monkeypatch.setattr(
        reforms, "MILBURN_PROMOTED_IDS", ("milburn_report_package",)
    )
    clear()
    listed = [r.id for r in reforms.get_milburn_reforms()]
    assert listed[-1] == "milburn_report_package" and len(listed) == 14
    assert reforms.list_reform_ids() == listed
    assert "milburn_report_package" in {
        m["id"] for m in milburn_measures()["measures"]
    }
    monkeypatch.undo()
    reforms._REFORMS_CACHE = None
    reforms._REFORM_LOOKUP_CACHE = None
    reforms._RESERVED_CACHE = None
    assert len(reforms.list_reform_ids()) == 13


def test_the_report_ids_read_as_the_15_november_ones_tonight():
    for report_id, listed_id in (
        ("milburn_report_pip", "pip_removed_under_25"),
        ("milburn_report_uc_health", "uc_health_element_removed_under_25"),
    ):
        ours, theirs = reforms.get_reform(report_id), reforms.get_reform(listed_id)
        assert (ours.name, ours.description) == (theirs.name, theirs.description)
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
        reforms.get_reform("milburn_package_phased").description.split(
            "reaching ", 1
        )[1]
    )


def test_the_report_package_is_the_package_tonight():
    """With REPORT_* as committed: the 20-year-old who loses the element,
    PIP and the shared accommodation exemption (£14,799.86)."""
    situation = single(20, lcwra=True, pip=True)
    package = change("milburn_package", situation)
    report_package = change("milburn_report_package", situation)
    assert report_package == pytest.approx(package, abs=0.005)
    assert package[0] - package[1] == pytest.approx(14_799.86, abs=0.1)


def test_the_report_parts_are_the_parts_tonight():
    young = single(22, lcwra=True)
    assert change("milburn_report_uc_health", young) == pytest.approx(
        change("uc_health_element_removed_under_25", young), abs=0.005
    )
    seventeen = single(17, rent=0, pip=True)
    kept = change("milburn_report_pip", seventeen, "pip")
    assert kept[1] == pytest.approx(kept[0]) and kept[0] > 0
    entrant = single(18, rent=0, pip=True)
    before, after = change("milburn_report_package_phased", entrant)
    assert before - after == pytest.approx(PIP_AWARD, abs=0.05)
    assert change("milburn_report_package_entry_25pct", entrant, "pip")[1] == 0


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
    seventeen = single(17, rent=0, pip=True)
    before, after = change("milburn_report_package", seventeen)
    assert before - after == pytest.approx(PIP_AWARD, abs=0.05)
    before, after = change("milburn_package", seventeen)
    assert after == pytest.approx(before)
    # A 23-year-old with LCWRA: kept under 22, lost under 25.
    older = single(23, lcwra=True)
    before, after = change("milburn_report_package", older)
    assert after == pytest.approx(before)
    before, after = change("milburn_package", older)
    assert before - after == pytest.approx(12 * PROTECTED_LCWRA, abs=0.05)
    # The listed registry's text did not move.
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
    kept = change("milburn_report_uc_health", single(20, lcwra=True), element)
    assert kept[1] == pytest.approx(kept[0]) and kept[0] > 0
    lost = change("milburn_report_uc_health", single(22, lcwra=True), element)
    assert lost[1] == 0 and lost[0] > 0


@pytest.mark.parametrize(
    "reform_id",
    ["pip_removed_under_25_excluding_scotland", "milburn_report_pip"],
)
def test_pip_excluding_scotland_leaves_scottish_awards(reform_id, report):
    report(REPORT_PIP_INCLUDE_SCOTLAND=False)
    assert "left as they are" in reforms.get_reform(reform_id).description
    scottish = single(20, rent=0, region="SCOTLAND", pip=True)
    before, after = change(reform_id, scottish, "pip")
    assert after == pytest.approx(before) and before > 0
    english = single(20, rent=0, pip=True)
    assert change(reform_id, english, "pip")[1] == 0


def test_the_16_to_24_package_reaches_a_17_year_old():
    before, after = change("milburn_package_16_to_24", single(17, rent=0, pip=True))
    assert before - after == pytest.approx(PIP_AWARD, abs=0.05)


def test_a_replacement_share_and_start_year(report):
    report(REPORT_PIP_REPLACEMENT_SHARE=0.5, REPORT_START_YEAR=2028)
    pip = reforms.get_reform("milburn_report_pip")
    assert pip.name == "PIP at 50% of its rate for 18 to 24-year-olds"
    assert pip.description.startswith("From April 2028 people aged 18 to 24")
    # 2027-28 is before the start: nothing moves.
    before, after = change("milburn_report_pip", single(20, rent=0, pip=True))
    assert after == pytest.approx(before)


def test_the_report_youth_allowance_takes_given_amounts(report):
    monthly = {year: (400.0 + year - 2027, 630.0) for year in range(2027, 2032)}
    report(REPORT_YOUTH_ALLOWANCE_MONTHLY=monthly)
    measure = reforms.get_reform("milburn_report_youth_allowance")
    path = f"{reforms.UC_STANDARD_ALLOWANCE}.SINGLE_YOUNG"
    assert measure.parameter_changes[path]["2027"] == 400.0
    assert measure.parameter_changes[path]["2031"] == 404.0
    couple = f"{reforms.UC_STANDARD_ALLOWANCE}.COUPLE_YOUNG"
    assert measure.parameter_changes[couple]["2029"] == 630.0
    assert "£400.00 a month" in measure.description
    # A single 21-year-old: 12 x (£400 - £353.17) more.
    before, after = change("milburn_report_youth_allowance", single(21))
    assert after - before == pytest.approx(12 * (400 - 353.170149), abs=0.05)


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
