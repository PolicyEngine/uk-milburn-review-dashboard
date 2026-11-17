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
  BREAK_EVEN_ENTRANTS_DEFINITION,
  BREAK_EVEN_SHARE_DEFINITION,
  ENTRY_ASSUMPTION_TEXT,
  MORE_ENTRANTS_THAN_GROUP,
  RELATIVE_LINE_NOTE,
  breakEvenText,
  entryMovers,
  formatBn,
  formatPeople,
  formatSignedPp,
  parseReviewFigures,
  parseSummary,
  savingInYear,
  savingShare,
  summaryPovertyCount,
  summaryRun,
} from "./summary";
import { povertyWaterfall } from "../../components/MeasuresPovertyCard";
import { groupMilburnMeasures, milburnDefaultMeasure, milburnDisplayName, milburnGroupOf } from "./measureGroups";
import { loadLocalBuildParts } from "./localBuild";
import { dashboardFromParts } from "../loadDashboard";
import { MeasureCatalogueProvider } from "../measureCatalogue";
import KeyFigures, {
  RANGE_WITH_SELECTION,
  RANGE_WITHOUT_SELECTION,
  REPLACEMENT_NOT_MODELLED_NOTE,
  REPLACEMENT_PARTS_NOTE,
  keyFigureTiles,
  packageRange,
} from "../../components/milburn/KeyFigures";
import { yearOnlyText } from "../../components/milburn/MilburnCharts";
import { FinancesHeadline, PovertyHeadline, barShare } from "../../components/milburn/HeadlineTiles";
import { reportCopy } from "./reportStatus";
import {
  BreakEven,
  ENTRY_RUN_HEADING,
  EntryComparison,
  SAME_GAIN_SENTENCE,
  SCENARIOS_LABEL,
  entryRunPoints,
} from "../../components/milburn/BehaviouralScenarios";

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
    expect(run.breakEvenSharePct).toEqual({ h16: 109.9, h25: 87.9 });
    // A static run's file may carry no movers; the entry run's count is read
    expect(run.peopleDirectlyAffected).toBeNull();
    expect(summaryRun(summary, "milburn_package_entry_25pct").peopleDirectlyAffected).toBe(70400);
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

describe("the review's own figures", () => {
  const published = JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "public", "data", "milburn_review_figures.json"), "utf8"));

  it("reads the published file: the people into work, their year, the NEET rate path and each source", () => {
    const review = parseReviewFigures(published);
    expect(review.employment.people).toBe(440000);
    expect(review.employment.byYear).toBe(2036);
    expect(review.employment.annex).toMatchObject({ moreInWork: 400000, moreInWorkOrEducation: 500000, roundedTo: 100000 });
    expect(review.neetRate.years).toHaveLength(11);
    expect(review.neetRate.withReformsPct.at(0)).toBe(13.1);
    expect(review.neetRate.withReformsPct.at(-1)).toBe(6.8);
    expect(review.neetRate.baselinePct.at(-1)).toBe(13.4);
    expect(review.neetRate.ambitionPct).toBe(5);
    expect(review.report.url).toBe("https://www.gov.uk/government/publications/from-a-welfare-state-to-a-working-state-a-new-settlement-for-the-next-generation");
    for (const source of [review.employment.source, review.employment.annex.source, review.neetRate.source]) {
      expect(source.label).toBeTruthy();
      expect(source.url).toMatch(/^https:\/\/(www\.gov\.uk|assets\.publishing\.service\.gov\.uk)\//);
    }
  });

  it("gives every published figure a source with a section and a link, and lists what the report does not give", () => {
    for (const block of [published.employment, published.employment.annex, published.neet_rate, published.fiscal]) {
      expect(block.source.label).toMatch(/annex|report|tables/i);
      expect(block.source.url).toMatch(/^https:\/\//);
    }
    // Welfare savings to 2036/37, as the annex gives them: £13.7bn over eight years
    expect(published.fiscal.cumulative_welfare_savings_gbp_bn).toBe(13.7);
    expect(published.fiscal.annual_gbp_m.fiscal_offsets).toBe(-2400);
    expect(published.not_published.length).toBeGreaterThan(0);
  });

  it("rejects a file without the report's link, the people into work or their year, and keeps a missing figure null", () => {
    expect(parseReviewFigures(null)).toBeNull();
    expect(parseReviewFigures({ ...published, report: { ...published.report, url: "javascript:alert(1)" } })).toBeNull();
    expect(parseReviewFigures({ ...published, employment: { ...published.employment, people: "440,000" } })).toBeNull();
    expect(parseReviewFigures({ ...published, employment: { ...published.employment, by_year: undefined } })).toBeNull();
    const bare = parseReviewFigures({ report: published.report, employment: { people: 440000, by_year: 2036 } });
    expect(bare.neetRate).toBeNull();
    expect(bare.employment.annex).toBeNull();
    expect(bare.employment.source).toBeNull();
    // A rate path whose series differ in length is dropped whole
    expect(parseReviewFigures({ ...published, neet_rate: { ...published.neet_rate, baseline_pct: [13.1] } }).neetRate).toBeNull();
  });
});

describe("formatting", () => {
  it("says, above 100%, that the entrants needed outnumber the group", () => {
    expect(breakEvenText(150)).toBe(`150.0% (${MORE_ENTRANTS_THAN_GROUP.toLowerCase()})`);
    expect(breakEvenText(100)).toBe("100.0%");
    expect(breakEvenText(95.5)).toBe("95.5%");
    expect(breakEvenText(null)).toBe("");
    // The old wording claimed something the arithmetic does not show
    expect(MORE_ENTRANTS_THAN_GROUP).not.toMatch(/restores|reachable/i);
  });

  it("reads the movers only from a run that has some, and a saving's share only of a positive saving", () => {
    expect(entryMovers(summaryRun(summary, "milburn_package_entry_25pct"))).toBe(70400);
    expect(entryMovers(summaryRun(summary, "milburn_package"))).toBeNull();
    expect(entryMovers({ peopleDirectlyAffected: 0 })).toBeNull();
    const full = summaryRun(summary, "milburn_package");
    expect(savingShare(summaryRun(summary, "milburn_package_entry_25pct"), full, 2027)).toBe(0.75);
    expect(savingShare(full, summaryRun(summary, "milburn_package_entry_25pct"), 2028)).toBeNull();
    expect(savingShare(full, summaryRun(summary, "youth_allowance_at_25_plus_rate"), 2027)).toBeNull();
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
    expect(byKey.young.definition).toContain("Includes siblings, partners");
    expect(byKey.loss.label).toBe("Their average household loss");
    // Absolute poverty after housing costs only: relative poverty is a
    // footnote, and there is no child poverty tile
    expect(tiles.map((tile) => tile.key)).toEqual(["saving", "young", "loss", "poverty-abs"]);
    expect(byKey["poverty-abs"].label).toBe("People into absolute poverty");
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
    expect(byKey["poverty-abs"].label).toBe("People out of absolute poverty");
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
    expect(region.textContent).toContain("Full abolition, no replacements (upper bound)");
    expect(region.textContent).toContain(RELATIVE_LINE_NOTE);
    expect(region.textContent).toContain("Relative poverty (60% of median, after housing costs): 150,000 people move into it (+0.20pp).");
    expect(region.textContent).toContain(REPLACEMENT_NOT_MODELLED_NOTE);
    expect(region.textContent).toContain(REPLACEMENT_PARTS_NOTE);
    // A package is shown above: it is the one picked out in the range
    expect(region.textContent).toContain(RANGE_WITH_SELECTION);
    expect(region.querySelectorAll("tr.is-selected")).toHaveLength(1);
    // The figures are for the summary's year whatever year is chosen: said
    expect(region.querySelector("[data-year-only]").textContent).toBe(yearOnlyText(2027));
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
    // Not a package: no row is picked out, and nothing is said to be selected
    const region = screen.getByRole("region", { name: "Key figures" });
    expect(region.textContent).toContain(RANGE_WITHOUT_SELECTION);
    expect(region.textContent).not.toContain(RANGE_WITH_SELECTION);
    expect(RANGE_WITHOUT_SELECTION).not.toMatch(/selected|full colour/);
    expect(region.querySelectorAll("tr.is-selected")).toHaveLength(0);
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
    // Its figures are for the summary's year whatever year is chosen: said
    expect(poverty.querySelector("[data-year-only]").textContent).toBe(yearOnlyText(2027));
    expect(yearOnlyText(2027)).toBe("2027-28 only: the year selector does not change these figures.");
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
    expect(rows[0].textContent).toContain("Entrants needed, as a share of 16–24s in losing households");
    expect(rows[1].textContent).toContain("109.9%");
    expect(rows[1].textContent).toContain("Above 100%: more than the group");
    expect(rows[1].textContent).toContain("550,000");
    expect(rows[1].textContent).toContain("£4,000");
    expect(rows[2].textContent).toContain("87.9%");
    expect(rows[2].textContent).not.toContain("Above 100%");
    const section = screen.getByRole("region", { name: "Break-even arithmetic" });
    // Both figures defined, one definition; nothing said to be unreachable or an incentive
    expect(section.textContent).toContain(BREAK_EVEN_ENTRANTS_DEFINITION);
    expect(section.textContent).toContain(BREAK_EVEN_SHARE_DEFINITION);
    expect(section.textContent).toContain(SAME_GAIN_SENTENCE);
    expect(section.textContent).toContain(MORE_ENTRANTS_THAN_GROUP);
    expect(section.textContent).not.toMatch(/not reachable|No entry rate|incentive/);
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

  it("defines the break-even share like for like: entrants needed over the young people in losing households", () => {
    const withArithmetic = [...published.runs.values()].filter((run) => run.entrantsToMatch.h16 !== null);
    expect(withArithmetic.length).toBeGreaterThan(5);
    for (const run of withArithmetic) {
      for (const hours of ["h16", "h25"]) {
        expect(run.breakEvenSharePct[hours], `${run.id} ${hours}`).toBeCloseTo((100 * run.entrantsToMatch[hours]) / run.youngPeopleLosing, 1);
      }
      // More hours, fewer entrants needed
      expect(run.breakEvenSharePct.h25).toBeLessThan(run.breakEvenSharePct.h16);
    }
    const full = summaryRun(published, "milburn_package");
    expect(full.breakEvenSharePct).toEqual({ h16: 98.7, h25: 77.1 });
    // Above 100% still occurs, so its wording is still shown
    expect(summaryRun(published, "milburn_package_phased").breakEvenSharePct.h16).toBeGreaterThan(100);
  });

  it("counts the entry run's movers from its own results, and none in a static run", () => {
    expect(formatPeople(entryMovers(summaryRun(published, "milburn_package_entry_25pct")))).toBe("82,000");
    expect(entryMovers(summaryRun(published, "milburn_package"))).toBeNull();
    render(<EntryComparison summary={published} catalogue={null} />);
    const section = screen.getByRole("region", { name: "With a quarter moving into work" });
    expect(section.textContent).toContain("25% of non-working 18 to 24-year-olds with PIP or the health element moving into work (about 82,000 people)");
    expect(section.textContent).toContain("Who moves: about 82,000 people, 25% of non-working 18 to 24-year-olds with PIP or the health element, chosen at random.");
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
    // What the run does, with the movers from the file; no claim about why or how large
    expect(section.textContent).toContain(ENTRY_RUN_HEADING);
    for (const point of entryRunPoints(70400)) expect(section.textContent).toContain(point);
    expect(entryRunPoints(70400)[0]).toContain("about 70,000 people");
    expect(entryRunPoints(null)[0]).toBe("Who moves: 25% of non-working 18 to 24-year-olds with PIP or the health element, chosen at random.");
    expect(section.textContent).not.toMatch(/Why the effect is small|worse off|young people who lose/);
  });

  it("names the group that moves, never the young people who lose", () => {
    expect(ENTRY_ASSUMPTION_TEXT).toBe(
      "25% of non-working 18 to 24-year-olds with PIP or the health element move into 16 hours' work a week at the minimum wage for their age",
    );
    expect(SCENARIOS_LABEL).toBe(`Assumption: ${ENTRY_ASSUMPTION_TEXT}, microsimulated. Other tabs: static.`);
    expect(SAME_GAIN_SENTENCE).not.toMatch(/incentive/);
  });

  it("says when either run has not yet run", () => {
    const partial = parseSummary({ year: 2027, runs: [{ id: "milburn_package", saving_bn: { 2027: 4 } }] });
    render(<EntryComparison summary={partial} catalogue={null} />);
    expect(screen.getByText(/Not yet run: the comparison/)).toBeTruthy();
  });
});

describe("measure groups", () => {
  it("names the packages and groups packages, single measures, variants and comparators", () => {
    expect(milburnDisplayName("milburn_package", "Milburn package (combined)")).toBe("Full abolition, no replacements (upper bound)");
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
    expect(groups.map((group) => group.label)).toEqual(["Pre-report variants (modelled before the report)", "Single measures", "Variants", reportCopy().comparatorsLabel]);
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
