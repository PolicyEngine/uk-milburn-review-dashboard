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
  summaryRun,
} from "./summary";
import { groupMilburnMeasures, milburnDisplayName, milburnGroupOf } from "./measureGroups";
import { loadLocalBuildParts } from "./localBuild";
import { dashboardFromParts } from "../loadDashboard";
import { MeasureCatalogueProvider } from "../measureCatalogue";
import KeyFigures, { keyFigureTiles } from "../../components/milburn/KeyFigures";
import { BreakEven, SAME_GAIN_SENTENCE } from "../../components/milburn/BehaviouralScenarios";

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
    // Absolute poverty after housing costs first, relative beside it
    expect(tiles.map((tile) => tile.key).slice(3, 5)).toEqual(["poverty-abs", "poverty"]);
    expect(byKey["poverty-abs"].label).toBe("People moved into absolute poverty after housing costs");
    expect(byKey["poverty-abs"].value).toBe("300,000");
    expect(byKey.poverty.label).toBe("People moved into relative poverty after housing costs");
    expect(byKey.child.label).toContain("relative, after housing costs");
  });

  it("label a gain run's figures as gains and a cost", () => {
    const tiles = keyFigureTiles(summaryRun(summary, "youth_allowance_at_25_plus_rate"), 2027);
    const byKey = Object.fromEntries(tiles.map((tile) => [tile.key, tile]));
    expect(byKey.saving.label).toBe("Exchequer cost, 2027-28");
    expect(byKey.saving.value).toBe("£0.80bn");
    expect(byKey.young.label).toContain("households that gain");
    expect(byKey.loss.label).toBe("Their average household gain");
    expect(byKey.loss.value).toBe("£1,100");
    expect(byKey.poverty.label).toBe("People moved out of relative poverty after housing costs");
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
    const panel = await screen.findByRole("list");
    expect(panel.textContent).toContain("£4.00bn");
    expect(panel.textContent).toContain("500,000");
    const region = screen.getByRole("region", { name: "Key figures" });
    expect(region.textContent).toContain("Full abolition, no replacement (upper bound)");
    expect(region.textContent).toContain(RELATIVE_LINE_NOTE);
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

describe("BreakEven", () => {
  it("gives the arithmetic, the >100% wording, and the 25% entry run's saving beside the full package's", async () => {
    vi.stubGlobal("fetch", fixtureFetch());
    const catalogue = await localCatalogue();
    render(<BreakEven runId="milburn_package" catalogue={catalogue} />);
    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows[1].textContent).toContain(NO_ENTRY_RATE_RESTORES);
    expect(rows[1].textContent).toContain("550,000");
    expect(rows[1].textContent).toContain("£4,000");
    expect(rows[2].textContent).toContain("95.5%");
    const section = screen.getByRole("region", { name: "Break-even arithmetic" });
    expect(section.textContent).toContain(SAME_GAIN_SENTENCE);
    expect(section.textContent).toContain("£4.00bn for Full abolition, no replacement (upper bound); £3.00bn with 25% moving into work, microsimulated");
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

describe("measure groups", () => {
  it("names the packages and groups packages, single measures and comparators", () => {
    expect(milburnDisplayName("milburn_package", "Milburn package (combined)")).toBe("Full abolition, no replacement (upper bound)");
    expect(milburnDisplayName("pip_halved_under_25", "PIP at half rate")).toBe("PIP at half rate");
    expect(milburnGroupOf({ id: "employer_nics_zero_under_25" })).toBe("comparators");
    expect(milburnGroupOf({ id: "uc_health_element_removed_under_22" })).toBe("single");
    const groups = groupMilburnMeasures([
      { id: "youth_allowance_at_25_plus_rate" },
      { id: "pip_removed_16_to_24" },
      { id: "milburn_package_phased" },
      { id: "milburn_package" },
    ]);
    expect(groups.map((group) => group.label)).toEqual(["Packages", "Single measures", "Comparators, not review proposals"]);
    expect(groups[0].measures.map((measure) => measure.id)).toEqual(["milburn_package", "milburn_package_phased"]);
  });
});
