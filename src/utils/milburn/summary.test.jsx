/**
 * milburn_summary.json (summary.js): parsing, a run not yet in the file,
 * the break-even wording above 100%, gain runs, and the components that
 * read it (KeyFigures, BreakEven). Fixtures:
 * src/test/fixtures/milburn/summary/ (invented figures) and the local build
 * fixture for the catalogue.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NO_ENTRY_RATE_RESTORES,
  RELATIVE_LINE_NOTE,
  breakEvenText,
  formatBn,
  formatPeople,
  formatSignedPp,
  parseSummary,
  savingInYear,
  summaryPovertyCount,
  summaryRun,
} from "./summary";
import { povertyWaterfall } from "../../components/MeasuresPovertyCard";
import { groupMilburnMeasures, milburnDefaultMeasure, milburnDisplayName, milburnGroupOf } from "./measureGroups";
import { loadLocalBuildParts } from "./localBuild";
import { dashboardFromParts } from "../loadDashboard";
import { MeasureCatalogueProvider } from "../measureCatalogue";
import KeyFigures, { REPLACEMENT_NOT_MODELLED_NOTE, keyFigureTiles, packageRange } from "../../components/milburn/KeyFigures";
import { FinancesHeadline, PovertyHeadline, barShare } from "../../components/milburn/HeadlineTiles";
import { BreakEven, EntryComparison, SAME_GAIN_SENTENCE, SMALL_FISCAL_EFFECT_POINTS } from "../../components/milburn/BehaviouralScenarios";

const FIXTURES = join(__dirname, "..", "..", "test", "fixtures", "milburn");
const SUMMARY_TEXT = readFileSync(join(FIXTURES, "summary", "milburn_summary.json"), "utf8");
const summary = parseSummary(JSON.parse(SUMMARY_TEXT));

/** A fetch serving the summary fixture (or 404) and the local build fixture. */
function fixtureFetch({ summaryText = SUMMARY_TEXT } = {}) {
  return async (url) => {
    const path = String(url).replace(/^\/data\//, "");
    if (path === "milburn_summary.json") {
      return summaryText === null ? new Response(null, { status: 404 }) : new Response(summaryText, { status: 200 });
    }
    try {
      return new Response(readFileSync(join(FIXTURES, "local-build", path)), { status: 200 });
    } catch {
      return new Response(null, { status: 404 });
    }
  };
}

async function localCatalogue() {
  const parts = await loadLocalBuildParts("", { fetchImpl: fixtureFetch() });
  return dashboardFromParts(parts).catalogue;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseSummary", () => {
  it("reads the year and each run's figures", () => {
    expect(summary.year).toBe(2027);
    const run = summaryRun(summary, "milburn_package");
    expect(run.direction).toBe("loss");
    expect(savingInYear(run, 2027)).toBe(4);
    expect(run.youngPeopleLosing).toBe(500400);
    expect(run.povertyPp.rel_ahc).toBe(0.2);
    expect(run.breakEvenSharePct).toEqual({ h16: 150, h25: 95.5 });
  });

  it("treats a run the file does not list as not yet run", () => {
    expect(summaryRun(summary, "milburn_package_central")).toBeNull();
  });

  it("keeps a missing figure null, never zero", () => {
    const run = summaryRun(summary, "milburn_package_entry_25pct");
    expect(run.everyoneLosingPct).toBeNull();
    expect(run.povertyPp.abs_bhc).toBeNull();
    expect(run.breakEvenSharePct).toEqual({ h16: null, h25: null });
  });

  it("rejects a file without a year or runs", () => {
    expect(parseSummary(null)).toBeNull();
    expect(parseSummary({ runs: [] })).toBeNull();
    expect(parseSummary({ year: 2027 })).toBeNull();
  });

  it("reads a gain run's direction, and infers it from a negative loss when absent", () => {
    expect(summaryRun(summary, "youth_allowance_at_25_plus_rate").direction).toBe("gain");
    const inferred = parseSummary({ year: 2027, runs: [{ id: "x", average_loss_young_person_in_losing_household: -5 }] });
    expect(summaryRun(inferred, "x").direction).toBe("gain");
  });
});

describe("formatting", () => {
  it("says no entry rate restores the average above 100%", () => {
    expect(breakEvenText(150)).toBe(`${NO_ENTRY_RATE_RESTORES} (150.0% would be needed)`);
    expect(breakEvenText(100)).toBe("100.0%");
    expect(breakEvenText(95.5)).toBe("95.5%");
    expect(breakEvenText(null)).toBe("");
  });

  it("formats £bn, people and pp", () => {
    expect(formatBn(4.486)).toBe("£4.49bn");
    expect(formatPeople(578166)).toBe("578,000");
    expect(formatPeople(400)).toBe("under 1,000");
    expect(formatSignedPp(0.225)).toBe("+0.23pp");
    expect(formatSignedPp(-0.184)).toBe("−0.18pp");
  });
});

describe("key figure tiles", () => {
  it("label a loss run's figures as losses and a saving", () => {
    const tiles = keyFigureTiles(summaryRun(summary, "milburn_package"), 2027);
    const byKey = Object.fromEntries(tiles.map((tile) => [tile.key, tile]));
    expect(byKey.saving.label).toBe("Exchequer saving, 2027-28");
    expect(byKey.young.label).toContain("households that lose");
    expect(byKey.young.definition).toContain("including siblings and partners, not only claimants");
    expect(byKey.loss.label).toBe("Their average household loss");
    // Absolute poverty after housing costs only: relative poverty is a
    // footnote, and there is no child poverty tile
    expect(tiles.map((tile) => tile.key)).toEqual(["saving", "young", "loss", "poverty-abs"]);
    expect(byKey["poverty-abs"].label).toBe("People moved into absolute poverty after housing costs");
    expect(byKey["poverty-abs"].value).toBe("300,000");
  });

  it("label a gain run's figures as gains and a cost", () => {
    const tiles = keyFigureTiles(summaryRun(summary, "youth_allowance_at_25_plus_rate"), 2027);
    const byKey = Object.fromEntries(tiles.map((tile) => [tile.key, tile]));
    expect(byKey.saving.label).toBe("Exchequer cost, 2027-28");
    expect(byKey.saving.value).toBe("£0.80bn");
    expect(byKey.young.label).toContain("households that gain");
    expect(byKey.loss.label).toBe("Their average household gain");
    expect(byKey.loss.value).toBe("£1,100");
    expect(byKey["poverty-abs"].label).toBe("People moved out of absolute poverty after housing costs");
    expect(byKey["poverty-abs"].extra).toBe("−0.16pp");
  });
});

describe("KeyFigures", () => {
  it("shows the selected run's figures from the summary file", async () => {
    vi.stubGlobal("fetch", fixtureFetch());
    const catalogue = await localCatalogue();
    render(
      <MeasureCatalogueProvider catalogue={catalogue}>
        <KeyFigures runId="milburn_package" />
      </MeasureCatalogueProvider>,
    );
    const panel = await screen.findByRole("list", { name: "Figures" });
    expect(panel.textContent).toContain("£4.00bn");
    expect(panel.textContent).toContain("500,000");
    const region = screen.getByRole("region", { name: "Key figures" });
    expect(region.textContent).toContain("Full abolition, no replacement (upper bound)");
    expect(region.textContent).toContain(RELATIVE_LINE_NOTE);
    expect(region.textContent).toContain("On the relative line (60% of median income after housing costs), 150,000 people move into poverty (+0.20pp).");
    expect(region.textContent).toContain(REPLACEMENT_NOT_MODELLED_NOTE);
  });

  it("shows the packages' range strip whatever run is selected", async () => {
    vi.stubGlobal("fetch", fixtureFetch());
    const catalogue = await localCatalogue();
    render(
      <MeasureCatalogueProvider catalogue={catalogue}>
        <KeyFigures runId="youth_allowance_at_25_plus_rate" />
      </MeasureCatalogueProvider>,
    );
    const strip = await screen.findByRole("table");
    const rows = within(strip).getAllByRole("row");
    // The fixture lists only the full package: the others are left out
    expect(rows).toHaveLength(2);
    expect(rows[1].textContent).toBe("Upper bound£4.00bnabout 300,000");
    expect(packageRange(summary).map((row) => row.id)).toEqual(["milburn_package"]);
  });

  it("says a run missing from the summary has not yet run", async () => {
    vi.stubGlobal("fetch", fixtureFetch());
    const catalogue = await localCatalogue();
    render(
      <MeasureCatalogueProvider catalogue={catalogue}>
        <KeyFigures runId="pip_removed_under_25" />
      </MeasureCatalogueProvider>,
    );
    expect((await screen.findByText(/Not yet run/)).textContent).toContain("PIP removed for 18 to 24-year-olds");
  });

  it("says so when the summary file is missing", async () => {
    vi.stubGlobal("fetch", fixtureFetch({ summaryText: null }));
    const catalogue = await localCatalogue();
    render(
      <MeasureCatalogueProvider catalogue={catalogue}>
        <KeyFigures />
      </MeasureCatalogueProvider>,
    );
    expect(await screen.findByText(/summary file has not been written yet/)).toBeTruthy();
  });
});

describe("headline tiles", () => {
  it("give poverty's and the public finances' figures from the summary file, unchanged", async () => {
    vi.stubGlobal("fetch", fixtureFetch());
    const catalogue = await localCatalogue();
    const { unmount } = render(
      <MeasureCatalogueProvider catalogue={catalogue}>
        <PovertyHeadline runId="milburn_package" />
      </MeasureCatalogueProvider>,
    );
    const poverty = await screen.findByRole("region", { name: "Poverty headline" });
    expect(poverty.textContent).toContain("300,000");
    expect(poverty.textContent).toContain("+0.50pp");
    expect(poverty.textContent).toContain("150,000");
    expect(poverty.textContent).toContain("Static");
    unmount();
    render(
      <MeasureCatalogueProvider catalogue={catalogue}>
        <FinancesHeadline runId="milburn_package" selectedYear={2027} />
      </MeasureCatalogueProvider>,
    );
    const finances = await screen.findByRole("region", { name: "Public finances headline" });
    expect(finances.textContent).toContain("£4.00bn");
    expect(finances.textContent).toContain("Exchequer saving, 2027-28");
  });

  it("scale a bar to the largest figure in its list", () => {
    expect(barShare(2, [4, 2])).toBe("50%");
    expect(barShare(-4, [-4, 2])).toBe("100%");
    expect(barShare(null, [null])).toBe("0%");
  });
});

describe("BreakEven", () => {
  it("gives the arithmetic and the >100% wording", async () => {
    vi.stubGlobal("fetch", fixtureFetch());
    const catalogue = await localCatalogue();
    render(<BreakEven runId="milburn_package" catalogue={catalogue} />);
    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows[1].textContent).toContain("Above 100%: not reachable");
    expect(rows[1].textContent).toContain("550,000");
    expect(rows[1].textContent).toContain("£4,000");
    expect(rows[2].textContent).toContain("95.5%");
    const section = screen.getByRole("region", { name: "Break-even arithmetic" });
    expect(section.textContent).toContain(SAME_GAIN_SENTENCE);
    expect(section.textContent).toContain(NO_ENTRY_RATE_RESTORES);
  });

  it("omits the arithmetic for a gain run, and says when a run has not yet run", async () => {
    vi.stubGlobal("fetch", fixtureFetch());
    const catalogue = await localCatalogue();
    const { unmount } = render(<BreakEven runId="youth_allowance_at_25_plus_rate" catalogue={catalogue} />);
    expect(await screen.findByText(/no break-even arithmetic applies/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    unmount();
    render(<BreakEven runId="milburn_package_central" catalogue={catalogue} />);
    expect(await screen.findByText(/Not yet run/)).toBeTruthy();
  });
});

describe("the published summary", () => {
  const published = parseSummary(JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "public", "data", "milburn_summary.json"), "utf8")));

  it("gives the packages' range: upper bound, central and phased", () => {
    expect(packageRange(published).map(({ name, saving, poverty }) => [name, saving, poverty])).toEqual([
      ["Upper bound", "£4.49bn", "about 410,000"],
      ["Central", "£2.54bn", "about 314,000"],
      ["Phased", "£2.01bn", "about 143,000"],
    ]);
  });

  it("leads Return to work with the 25% entry run against the static package", () => {
    render(<EntryComparison summary={published} catalogue={null} />);
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows[1].textContent).toContain("£4.49bn");
    expect(rows[1].textContent).toContain("£4.61bn");
    expect(rows[2].textContent).toContain("+0.59pp (about 410,000 people)");
    expect(rows[2].textContent).toContain("+0.39pp (about 272,000 people)");
    expect(rows[3].textContent).toContain("£12,622");
    expect(rows[3].textContent).toContain("£11,305");
  });
});

describe("the poverty card's direct count", () => {
  const published = parseSummary(JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "public", "data", "milburn_summary.json"), "utf8")));
  const count = summaryPovertyCount(published);

  it("reads the summary's count for absolute poverty after housing costs in its year only", () => {
    expect(count("milburn_package", 2027, "poverty_abs_ahc_change_pp")).toBe(409743);
    expect(count("milburn_package", 2028, "poverty_abs_ahc_change_pp")).toBeNull();
    expect(count("milburn_package", 2027, "poverty_rel_ahc_change_pp")).toBeNull();
    expect(count("not_a_run", 2027, "poverty_abs_ahc_change_pp")).toBeNull();
    expect(summaryPovertyCount(null)).toBeNull();
  });

  it("replaces pp × population in the card's bars, so it reads 410,000 as Key figures do", () => {
    // +0.589pp of about 70m people would be about 412,000
    const measures = [{ id: "milburn_package", name: "Package", value: 0.589, colour: "" }];
    const scaled = povertyWaterfall(measures, null, 70);
    expect(Math.round(-scaled.steps[0].x / 1000)).toBe(412);
    const direct = povertyWaterfall(measures, null, 70, [], (id) => count(id, 2027, "poverty_abs_ahc_change_pp"));
    expect(direct.steps[0].x).toBe(-409743);
    expect(formatPeople(-direct.steps[0].x)).toBe("410,000");
  });
});

describe("EntryComparison", () => {
  it("leads with the 25% entry run beside the static package, from the summary", async () => {
    const catalogue = await localCatalogue();
    render(<EntryComparison summary={summary} catalogue={catalogue} />);
    const section = screen.getByRole("region", { name: "With a quarter moving into work" });
    const rows = within(within(section).getByRole("table")).getAllByRole("row");
    expect(rows[1].textContent).toContain("£4.00bn");
    expect(rows[1].textContent).toContain("£3.00bn");
    // The entry run carries no absolute poverty figure: said, never zero
    expect(rows[2].textContent).toContain("+0.50pp (about 300,000 people)");
    expect(rows[2].textContent).toContain("Not in the summary");
    expect(rows[3].textContent).toContain("£12,000");
    expect(rows[3].textContent).toContain("£9,000");
    expect(section.textContent).toContain("The move into work takes £1.00bn from the Exchequer.");
    for (const point of SMALL_FISCAL_EFFECT_POINTS) expect(section.textContent).toContain(point);
  });

  it("says when either run has not yet run", () => {
    const partial = parseSummary({ year: 2027, runs: [{ id: "milburn_package", saving_bn: { 2027: 4 } }] });
    render(<EntryComparison summary={partial} catalogue={null} />);
    expect(screen.getByText(/Not yet run: the comparison/)).toBeTruthy();
  });
});

describe("measure groups", () => {
  it("names the packages and groups packages, single measures, variants and comparators", () => {
    expect(milburnDisplayName("milburn_package", "Milburn package (combined)")).toBe("Full abolition, no replacement (upper bound)");
    expect(milburnDisplayName("pip_halved_under_25", "PIP at half rate")).toBe("PIP at half rate");
    expect(milburnGroupOf({ id: "employer_nics_zero_under_25" })).toBe("comparators");
    expect(milburnGroupOf({ id: "uc_health_element_removed_under_25" })).toBe("single");
    expect(milburnGroupOf({ id: "uc_health_element_removed_under_22" })).toBe("variants");
    const groups = groupMilburnMeasures([
      { id: "youth_allowance_at_25_plus_rate" },
      { id: "pip_removed_16_to_24" },
      { id: "milburn_package_entry_25pct" },
      { id: "uc_health_element_removed_under_25_new_claims" },
      { id: "pip_removed_under_25" },
      { id: "milburn_package_phased" },
      { id: "milburn_package" },
    ]);
    expect(groups.map((group) => group.label)).toEqual(["Packages", "Single measures", "Variants", "Comparators, not review proposals"]);
    expect(groups[0].measures.map((measure) => measure.id)).toEqual(["milburn_package", "milburn_package_phased"]);
    // The 25% entry run and the new-claims run stay loadable but are not offered
    expect(groups.flatMap((group) => group.measures.map((measure) => measure.id))).not.toContain("milburn_package_entry_25pct");
    expect(groups.flatMap((group) => group.measures.map((measure) => measure.id))).not.toContain("uc_health_element_removed_under_25_new_claims");
  });

  it("defaults to the full abolition package, though the catalogue puts the 25% entry run (the largest saving) first", () => {
    const catalogueOrder = [{ id: "milburn_package_entry_25pct" }, { id: "milburn_package" }, { id: "pip_removed_under_25" }];
    expect(milburnDefaultMeasure(catalogueOrder).id).toBe("milburn_package");
    expect(milburnDefaultMeasure([{ id: "milburn_package_entry_25pct" }, { id: "pip_removed_under_25" }]).id).toBe("pip_removed_under_25");
    expect(milburnDefaultMeasure([])).toBeNull();
  });
});
