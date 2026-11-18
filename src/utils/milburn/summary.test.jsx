/**
 * milburn_summary.json (summary.js): parsing, a run not yet in the file,
 * the break-even wording above 100%, gain runs, and the components that
 * read it (KeyFigures, BreakEven). Fixtures:
 * src/test/fixtures/milburn/summary/ (invented figures) and the local build
 * fixture for the catalogue.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BREAK_EVEN_ENTRANTS_DEFINITION,
  BREAK_EVEN_SHARE_DEFINITION,
  MORE_ENTRANTS_THAN_GROUP,
  breakEvenText,
  entryMovers,
  formatBn,
  formatPeople,
  formatSignedPp,
  HEADLINE_RUN,
  parseReviewFigures,
  parseSummary,
  savingInYear,
  savingShare,
  summaryPovertyCount,
  summaryForYear,
  summaryRun,
} from "./summary";
import { povertyWaterfall } from "../../components/MeasuresPovertyCard";
import { groupMilburnMeasures, milburnDefaultMeasure, milburnDisplayName, milburnGroupOf } from "./measureGroups";
import { loadLocalBuildParts } from "./localBuild";
import { dashboardFromParts } from "../loadDashboard";
import { MeasureCatalogueProvider } from "../measureCatalogue";
import KeyFigures, {
  ALL_TILE_KEYS,
  fallbackRunLine,
  keyFiguresCsv,
  PARTIAL_REMOVAL_NOTE,
  REPLACEMENT_NOT_MODELLED_NOTE,
  REPLACEMENT_PARTS_NOTE,
  ROUNDING_NOTE,
  keyFigureTiles,
  packageRange,
} from "../../components/milburn/KeyFigures";
import { yearOnlyText } from "../../components/milburn/MilburnCharts";
import { FinancesHeadline, PovertyHeadline, barShare, financesHeadlineCsv, povertyHeadlineCsv } from "../../components/milburn/HeadlineTiles";
import { OPEN_POPULATION_SUB } from "../populationSub";
import { downloadMenus, STANDARD_FORMATS } from "../../test/downloadMenus";
import { reportCopy } from "./reportStatus";
import { BreakEven, SAME_GAIN_SENTENCE, SCENARIOS_LABEL } from "../../components/milburn/BehaviouralScenarios";

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
    // None at all is said as none: the child DLA run changes no income
    expect(formatPeople(0)).toBe("0");
    expect(formatSignedPp(0.225)).toBe("+0.23pp");
    expect(formatSignedPp(-0.184)).toBe("−0.18pp");
  });
});

describe("key figure tiles", () => {
  it("label a loss run's figures as losses and a saving", () => {
    const tiles = keyFigureTiles(summaryRun(summary, "milburn_package"), 2027, { keys: ALL_TILE_KEYS });
    const byKey = Object.fromEntries(tiles.map((tile) => [tile.key, tile]));
    expect(byKey.saving.label).toBe("Exchequer saving, 2027-28");
    expect(byKey.young.label).toContain("households that lose");
    expect(byKey.young.definition).toContain("Includes siblings, partners");
    expect(byKey.loss.label).toBe("Their average household loss");
    // Absolute poverty before housing costs only: relative poverty is a
    // footnote, and there is no child poverty tile
    expect(tiles.map((tile) => tile.key)).toEqual(["saving", "young", "loss", "poverty-abs"]);
    expect(byKey["poverty-abs"].label).toBe("People into absolute poverty");
    expect(byKey["poverty-abs"].value).toBe("280,000");
  });

  it("label a gain run's figures as gains and a cost", () => {
    const tiles = keyFigureTiles(summaryRun(summary, "youth_allowance_at_25_plus_rate"), 2027, { keys: ALL_TILE_KEYS });
    const byKey = Object.fromEntries(tiles.map((tile) => [tile.key, tile]));
    expect(byKey.saving.label).toBe("Exchequer cost, 2027-28");
    expect(byKey.saving.value).toBe("£0.80bn");
    expect(byKey.young.label).toContain("households that gain");
    expect(byKey.loss.label).toBe("Their average household gain");
    expect(byKey.loss.value).toBe("£1,100");
    expect(byKey["poverty-abs"].label).toBe("People out of absolute poverty");
    expect(byKey["poverty-abs"].extra).toBe("−0.13pp");
  });

  it("are, on Young people, only the 16–24s affected and their average change: the saving and poverty have their own sub-tabs", () => {
    expect(keyFigureTiles(summaryRun(summary, "milburn_package"), 2027).map((tile) => tile.key)).toEqual(["young", "loss"]);
  });

  it("download as CSV with the figures unrounded, their units and the run's name and year", () => {
    const run = summaryRun(summary, "milburn_package");
    const lines = keyFiguresCsv(run, 2027, "Full abolition").replace(/^\uFEFF/, "").trim().split("\r\n");
    expect(lines[0]).toBe('"# Key figures, Full abolition, 2027-28"');
    expect(lines[1]).toMatch(/^"# Units: .*static, with no replacement payments modelled; .*\| Source: /);
    expect(lines.slice(2)).toEqual([
      "Figure,Value,Unit,Also shown,Its unit,As shown,Note",
      '16–24s in households that lose,500400,people,7.5,% of 16–24s,"500,000 7.50% of 16–24s","Includes siblings, partners."',
      'Their average household loss,12000,"£ a year, per household",,,"£12,000 a year","Annual change in household income, averaged over 16–24s in households that lose."',
    ]);
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
    expect(panel.textContent).toContain("500,000");
    // The saving and the poverty count are on their own sub-tabs, not repeated here
    expect(panel.textContent).not.toContain("£4.00bn");
    expect(panel.textContent).not.toContain("280,000");
    expect([...panel.querySelectorAll("[data-key]")].map((tile) => tile.dataset.key)).toEqual(["young", "loss"]);
    const region = screen.getByRole("region", { name: "Key figures" });
    // The heading carries no estimate chip and no policy chip: the run's name is for screen readers only
    expect(region.querySelector(".milburn-key-heading [data-source-kind]")).toBeNull();
    expect(region.querySelector(".milburn-key-heading .milburn-status-chip:not([data-year-only])")).toBeNull();
    expect(region.querySelector(".milburn-key-heading .visually-hidden").textContent).toBe("Full abolition, no replacements");
    // "Static" is said once over the page (App.jsx), not in the box
    expect(region.textContent).not.toMatch(/Static/);
    // No range strip, no relative poverty: Public finances and Poverty hold them
    expect(region.querySelector("table")).toBeNull();
    expect(region.textContent).not.toMatch(/Relative poverty|relative line/i);
    // One upper-bound line, of losses (this box's subject), never of the saving
    expect(region.textContent).not.toMatch(/\(upper bound\)|upper bound on the saving/i);
    const notes = [...region.querySelectorAll("details.milburn-details")].at(-1);
    expect(notes.querySelector("[data-replacement-note]").textContent).toBe(REPLACEMENT_NOT_MODELLED_NOTE);
    expect(notes.textContent).toContain(REPLACEMENT_PARTS_NOTE);
    expect(notes.textContent).toContain(ROUNDING_NOTE);
    expect(region.textContent.match(/upper bound/g)).toHaveLength(1);
    // One policy selected: no fallback line
    expect(region.querySelector("[data-fallback-run]")).toBeNull();
    // The figures follow the year selector: no year-only chip
    expect(region.querySelector("[data-year-only]")).toBeNull();
  });

  it("links to the sub-tabs that hold the saving and poverty, and to Benchmarks for published figures", async () => {
    vi.stubGlobal("fetch", fixtureFetch());
    const catalogue = await localCatalogue();
    render(
      <MeasureCatalogueProvider catalogue={catalogue}>
        <KeyFigures runId="milburn_package" />
      </MeasureCatalogueProvider>,
    );
    await screen.findByRole("list", { name: "Figures" });
    const region = screen.getByRole("region", { name: "Key figures" });
    const line = region.querySelector("[data-see-also]");
    expect(line.textContent).toBe("Exchequer saving: Public finances · Poverty: Poverty");
    const opened = vi.fn();
    const onOpen = (event) => opened(event.detail);
    window.addEventListener(OPEN_POPULATION_SUB, onOpen);
    for (const link of within(line).getAllByRole("link")) fireEvent.click(link);
    fireEvent.click(within(region.querySelector(".bm-callout")).getByRole("link", { name: "Benchmarks" }));
    window.removeEventListener(OPEN_POPULATION_SUB, onOpen);
    expect(opened.mock.calls.map(([sub]) => sub)).toEqual(["finances", "poverty", "benchmarks"]);
    expect(region.querySelector(".bm-callout").textContent).toBe("Published figures for comparison: see Benchmarks");
    // No published figures repeated in the box
    expect(region.querySelector(".pub-card, details.bm-callout-details")).toBeNull();
  });

  it("offers the box's figures as CSV, PNG and SVG", async () => {
    vi.stubGlobal("fetch", fixtureFetch());
    const catalogue = await localCatalogue();
    render(
      <MeasureCatalogueProvider catalogue={catalogue}>
        <KeyFigures runId="milburn_package" />
      </MeasureCatalogueProvider>,
    );
    await screen.findByRole("list", { name: "Figures" });
    const menus = downloadMenus(screen.getByRole("region", { name: "Key figures" }));
    // The header names the one selected policy (the file's subtitle): the title gives the year
    expect(menus).toEqual([{ name: "Download chart: Key figures, 2027-28", formats: STANDARD_FORMATS }]);
  });

  it("shows the report's package, named on the card, when no single policy is chosen", async () => {
    vi.stubGlobal("fetch", fixtureFetch());
    const catalogue = await localCatalogue();
    render(
      <MeasureCatalogueProvider catalogue={catalogue}>
        <KeyFigures />
      </MeasureCatalogueProvider>,
    );
    await screen.findByRole("list", { name: "Figures" });
    expect(HEADLINE_RUN).toBe("milburn_report_package");
    const region = screen.getByRole("region", { name: "Key figures" });
    // Named in visible text, not only for screen readers
    const line = region.querySelector(".milburn-key-heading [data-fallback-run]");
    expect(line.textContent).toBe(fallbackRunLine("milburn_report_package"));
    expect(line.classList.contains("visually-hidden")).toBe(false);
    // Its upper bound covers the timing too
    expect(REPLACEMENT_NOT_MODELLED_NOTE).toMatch(/not at reassessment/);
  });

  it("keeps the packages' range for Public finances and Poverty", () => {
    // The fixture lists only the report's package of the range's runs: the others are left out
    // The fixture's year is before April 2029, when the range is not shown; read it as 2029-30
    expect(packageRange({ ...summary, year: 2029 }).map((row) => [row.id, row.name, row.povertyValue])).toEqual([
      ["milburn_report_package", "Full removal", 290000],
    ]);
    expect(PARTIAL_REMOVAL_NOTE).toMatch(/^Package range: our designs\. Partial removal .* the report has no such run\.$/);
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
    // Nothing to download, and no links to figures that are not there
    expect(document.querySelector(".chart-download, [data-see-also]")).toBeNull();
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
    expect(poverty.textContent).toContain("280,000");
    expect(poverty.textContent).toContain("+0.40pp");
    expect(poverty.textContent).toContain("130,000");
    // Static and the replacements are said once over the page (App.jsx): the notes keep the rounding
    expect(poverty.textContent).not.toMatch(/Static|upper bound/);
    expect(poverty.querySelector("details[data-notes] > summary").textContent).toBe("Notes and caveats");
    expect(poverty.querySelector("details[data-notes]").textContent).toContain(ROUNDING_NOTE);
    expect(ROUNDING_NOTE).toBe("Counts rounded to the nearest thousand; figures may not sum due to rounding.");
    expect(poverty.querySelector(".milburn-key-heading [data-source-kind]")).toBeNull();
    expect(poverty.querySelector(".milburn-key-heading .milburn-status-chip:not([data-year-only])")).toBeNull();
    // Its figures follow the year selector: no year-only chip
    expect(poverty.querySelector("[data-year-only]")).toBeNull();
    // Published figures: one line to Benchmarks
    expect(poverty.querySelector(".bm-callout").textContent).toBe("Published figures for comparison: see Benchmarks");
    expect(downloadMenus(poverty).map((menu) => menu.formats)).toEqual([STANDARD_FORMATS]);
    unmount();
    render(
      <MeasureCatalogueProvider catalogue={catalogue}>
        <FinancesHeadline runId="milburn_package" selectedYear={2027} />
      </MeasureCatalogueProvider>,
    );
    const finances = await screen.findByRole("region", { name: "Public finances headline" });
    expect(finances.textContent).toContain("£4.00bn");
    expect(finances.textContent).toContain("Exchequer saving, 2027-28");
    expect(finances.querySelector(".milburn-key-heading [data-source-kind]")).toBeNull();
    expect(finances.querySelector(".milburn-key-heading .milburn-status-chip")).toBeNull();
    // No "By year" meter: the Revenue impact chart below shows every year
    expect(finances.textContent).not.toContain("By year");
    // The sign convention once, in the folded notes; "static" is said over the page
    const notes = finances.querySelector("details[data-notes]");
    expect(notes.textContent).toContain("A positive figure is a saving to the Exchequer; a negative one is a cost.");
    expect(finances.textContent).not.toMatch(/Static/);
    expect(finances.querySelector(".bm-callout").textContent).toBe("Published figures for comparison: see Benchmarks");
    expect(downloadMenus(finances).map((menu) => menu.formats)).toEqual([STANDARD_FORMATS]);
  });

  it("show the report's package, named in visible text, with more than one policy selected", async () => {
    vi.stubGlobal("fetch", fixtureFetch());
    const catalogue = await localCatalogue();
    const { unmount } = render(
      <MeasureCatalogueProvider catalogue={catalogue}>
        <PovertyHeadline />
      </MeasureCatalogueProvider>,
    );
    const poverty = await screen.findByRole("region", { name: "Poverty headline" });
    expect(poverty.textContent).toContain("290,000");
    const line = poverty.querySelector(".milburn-key-heading [data-fallback-run]");
    expect(line.textContent).toBe(fallbackRunLine("milburn_report_package"));
    expect(line.classList.contains("visually-hidden")).toBe(false);
    // One package in the range: no range meter and no note on it
    expect(poverty.querySelector("[data-range-meter], [data-range-note]")).toBeNull();
    unmount();
    render(
      <MeasureCatalogueProvider catalogue={catalogue}>
        <FinancesHeadline selectedYear={2027} />
      </MeasureCatalogueProvider>,
    );
    const finances = await screen.findByRole("region", { name: "Public finances headline" });
    expect(finances.textContent).toContain("£4.50bn");
    expect(finances.querySelector(".milburn-key-heading [data-fallback-run]").textContent).toBe(fallbackRunLine("milburn_report_package"));
  });

  it("draw the package range on both boxes, with its note, when the summary has more than one package", async () => {
    const published = parseSummary(JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "public", "data", "milburn_summary.json"), "utf8")));
    const range = packageRange(published);
    expect(range.length).toBeGreaterThan(1);
    const run = summaryRun(published, HEADLINE_RUN);
    // Poverty's CSV carries the range's people, Public finances' its savings
    const poverty = povertyHeadlineCsv(run, published, "The report's package");
    for (const row of range) expect(poverty).toContain(`"Package range: ${row.name}, people into absolute poverty before housing costs",${row.povertyValue},people`);
    const finances = financesHeadlineCsv(run, published, "The report's package", String(published.year));
    expect(finances.split("\r\n")[2]).toBe("Figure,Fiscal year,Saving (£bn)");
    for (const row of range) expect(finances).toContain(`Package range: ${row.name},`);
    expect(finances).not.toMatch(/By year/);
  });

  it("draw the package range only beside runs that remove the health element or PIP", () => {
    const published = parseSummary(JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "public", "data", "milburn_summary.json"), "utf8")));
    const other = summaryRun(published, "milburn_report_youth_allowance_work_allowance");
    expect(other).not.toBeNull();
    expect(financesHeadlineCsv(other, published, "Work allowance", String(published.year))).not.toContain("Package range");
    expect(povertyHeadlineCsv(other, published, "Work allowance")).not.toContain("Package range");
    expect(financesHeadlineCsv(summaryRun(published, HEADLINE_RUN), published, "The report's package", String(published.year))).toContain("Package range");
  });

  it("say a report run starts in April 2029 before then, not £0.00bn, 0 or withheld", () => {
    const run = { id: "milburn_report_package", direction: "loss", savingBn: { 2027: 0 }, youngPeopleLosing: 0, youngShareLosingPct: 0, averageLossYoung: null, withheld: new Set(["average_loss_young_person_in_losing_household"]), povertyPp: {}, peopleIntoPovertyAbs: 0 };
    const tiles = keyFigureTiles(run, 2027, { keys: ["saving", "young", "loss"] });
    expect(tiles.map((tile) => [tile.key, tile.value])).toEqual([
      ["saving", "Starts April 2029"],
      ["young", "Starts April 2029"],
    ]);
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

  it("gives the packages' range: full removal, the pre-report partial removal and the phased run", () => {
    expect(packageRange(published).map((row) => row.id)).toEqual(["milburn_report_package", "milburn_package_central", "milburn_report_package_phased"]);
    expect(packageRange(published).map(({ name, saving, poverty }) => [name, saving, poverty])).toEqual([
      ["Full removal", "£4.67bn", "about 342,000"],
      ["Partial removal", "£2.64bn", "about 99,000"],
      ["Phased", "£2.77bn", "about 156,000"],
    ]);
  });

  it("shows the range from 2029-30 only: before April 2029 only the pre-report partial removal has started", () => {
    for (const year of [2027, 2028]) expect(packageRange(summaryForYear(published, year)), String(year)).toEqual([]);
    for (const year of [2029, 2030, 2031]) expect(packageRange(summaryForYear(published, year)).length, String(year)).toBe(3);
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
    // The 2029-30 entry case (milburn_scenarios.json) against the 2029-30 saving
    expect(full.breakEvenSharePct).toEqual({ h16: 97.4, h25: 76.7 });
    // The pre-report 25% run's files stay, but the summary no longer reads it
    expect(summaryRun(published, "milburn_package_entry_25pct")).toBeNull();
  });

  it("counts no movers in a static run", () => {
    expect(entryMovers(summaryRun(published, "milburn_package"))).toBeNull();
  });
});

describe("a run without an average loss", () => {
  const raw = JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "public", "data", "milburn_summary.json"), "utf8"));
  const withNull = {
    ...raw,
    runs: raw.runs.map((run) => (run.id === "milburn_package" ? { ...run, average_loss_young_person_in_losing_household: null } : run)),
  };
  const summary = parseSummary(withNull);

  it("reads null, not zero, and keeps the run's direction", () => {
    const entry = summaryRun(summary, "milburn_package");
    expect(entry.averageLossYoung).toBeNull();
    expect(entry.direction).toBe("loss");
  });

  it("leaves the average loss out of the key figures", () => {
    const tiles = keyFigureTiles(summaryRun(summary, "milburn_package"), summary.year);
    expect(tiles.map((tile) => tile.key)).not.toContain("loss");
    expect(tiles.map((tile) => tile.key)).toContain("young");
  });
});

describe("the poverty card's direct count", () => {
  const published = parseSummary(JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "public", "data", "milburn_summary.json"), "utf8")));
  const count = summaryPovertyCount(published);

  it("reads the summary's count for absolute poverty before housing costs in each year it covers", () => {
    expect(published.year).toBe(2029);
    expect(count("milburn_package", 2029, "poverty_abs_bhc_change_pp")).toBe(342299);
    // Every year the runs cover (by_year), under the same floor
    expect(Number.isFinite(count("milburn_package", 2028, "poverty_abs_bhc_change_pp"))).toBe(true);
    expect(count("milburn_package", 2026, "poverty_abs_bhc_change_pp")).toBeNull();
    expect(count("milburn_package", 2029, "poverty_rel_ahc_change_pp")).toBeNull();
    expect(count("not_a_run", 2029, "poverty_abs_bhc_change_pp")).toBeNull();
    expect(summaryPovertyCount(null)).toBeNull();
  });

  it("replaces pp × population in the card's bars, so it reads the summary's own count as Key figures do", () => {
    // +0.490pp of about 70m people would be 343,000; the summary counts 342,299
    const measures = [{ id: "milburn_package", name: "Package", value: 0.49, colour: "" }];
    const scaled = povertyWaterfall(measures, null, 70);
    expect(Math.round(-scaled.steps[0].x)).toBe(343000);
    const direct = povertyWaterfall(measures, null, 70, [], (id) => count(id, 2029, "poverty_abs_bhc_change_pp"));
    expect(direct.steps[0].x).toBe(-342299);
    expect(formatPeople(-direct.steps[0].x)).toBe("342,000");
  });
});

describe("Moves into work wording", () => {
  it("names the group that moves, never the young people who lose", () => {
    expect(SCENARIOS_LABEL).toBe(
      "Assumes a share of non-working 18 to 24-year-olds whose Universal Credit health element the package removes take 16 hours a week at the minimum wage for their age: none before April 2029, then a phased share rising to 4.4% by 2031-32, or 9% with no ramp",
    );
    expect(SCENARIOS_LABEL).not.toMatch(/young people who lose|worse off/);
    expect(SAME_GAIN_SENTENCE).not.toMatch(/incentive/);
  });
});

describe("measure groups", () => {
  it("offers the report's measures, then two comparators, and keeps the pre-report runs loadable but not offered", () => {
    expect(milburnDisplayName("milburn_package", "Milburn package (combined)")).toBe("Full abolition, no replacements");
    expect(milburnDisplayName("milburn_report_uc_health", "x")).toBe("UC health element removed for under-25s");
    expect(milburnDisplayName("employer_nics_zero_under_25", "Employer NICs zero rate extended to under-25s")).toBe("Employer NI zero rate extended to under-25s");
    expect(milburnDisplayName("pip_halved_under_25", "PIP at half rate")).toBe("PIP at half rate");
    expect(milburnGroupOf({ id: "milburn_report_package" })).toBe("report");
    expect(milburnGroupOf({ id: "employer_nics_zero_under_25" })).toBe("comparators");
    expect(milburnGroupOf({ id: "pip_halved_under_25" })).toBe("comparators");
    expect(milburnGroupOf({ id: "uc_health_element_removed_under_25" })).toBe("single");
    const groups = groupMilburnMeasures([
      { id: "youth_allowance_at_25_plus_rate" },
      { id: "pip_halved_under_25" },
      { id: "milburn_package_entry_25pct" },
      { id: "milburn_report_pip" },
      { id: "milburn_package" },
      { id: "milburn_report_package" },
      { id: "employer_nics_zero_under_25" },
    ]);
    expect(groups.map((group) => group.label)).toEqual(["Measures from the report, and our variants", reportCopy().comparatorsLabel]);
    expect(groups[0].measures.map((measure) => measure.id)).toEqual(["milburn_report_package", "milburn_report_pip"]);
    expect(groups[1].measures.map((measure) => measure.id)).toEqual(["pip_halved_under_25", "employer_nics_zero_under_25"]);
    const offered = groups.flatMap((group) => group.measures.map((measure) => measure.id));
    for (const id of ["milburn_package", "milburn_package_entry_25pct", "youth_allowance_at_25_plus_rate"]) expect(offered).not.toContain(id);
  });

  it("defaults to the first run offered: the report's package, whatever the catalogue's order", () => {
    const catalogueOrder = [{ id: "milburn_package_entry_25pct" }, { id: "milburn_package" }, { id: "milburn_report_package" }];
    expect(milburnDefaultMeasure(catalogueOrder).id).toBe("milburn_report_package");
    expect(milburnDefaultMeasure([{ id: "milburn_package_entry_25pct" }, { id: "pip_halved_under_25" }]).id).toBe("pip_halved_under_25");
    expect(milburnDefaultMeasure([])).toBeNull();
  });
});

describe("the summary by year", () => {
  it("gives each year's runs, the default year's as runs, and null for a year it does not cover", () => {
    const summary = parseSummary({
      year: 2029,
      runs: [{ id: "a", saving_bn: { 2029: 1 }, young_people_in_losing_households: 10 }],
      by_year: {
        2029: [{ id: "a", saving_bn: { 2029: 1 }, young_people_in_losing_households: 10 }],
        2030: [{ id: "a", saving_bn: { 2030: 2 }, young_people_in_losing_households: null }],
      },
    });
    expect(summaryForYear(summary, 2029)).toBe(summary);
    const later = summaryForYear(summary, 2030);
    expect(later.year).toBe(2030);
    // A withheld figure stays null, never zero
    expect(summaryRun(later, "a").youngPeopleLosing).toBeNull();
    expect(summaryForYear(summary, 2031)).toBeNull();
  });
});

describe("the NEET breakdown by year", () => {
  it("reads a year the file covers, and keeps the file's own year otherwise", async () => {
    const { parseNeet, neetForYear } = await import("./neet");
    const group = (population) => ({ records: 500, population, share_in_losing_households_pct: null, average_change_in_household_net_income: -10, people_losing_uc_health_or_pip: null, share_losing_uc_health_or_pip_pct: null });
    const neet = parseNeet({
      reform_id: "milburn_report_package",
      year: 2029,
      groups: { neet_approx: group(1), other_16_24: group(2) },
      neet_approx_total: 1,
      by_year: { 2030: { year: 2030, groups: { neet_approx: group(3), other_16_24: group(4) }, neet_approx_total: 3 } },
    });
    expect(neetForYear(neet, 2030).year).toBe(2030);
    expect(neetForYear(neet, 2030).groups.neet_approx.population).toBe(3);
    expect(neetForYear(neet, 2030).groups.neet_approx.share_in_losing_households_pct).toBeNull();
    expect(neetForYear(neet, 2027).year).toBe(2029);
  });
});
