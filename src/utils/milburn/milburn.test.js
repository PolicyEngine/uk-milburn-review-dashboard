import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { packageStaticBn, parseScenarios } from "./scenarios";
import { youngPeopleWorseOff } from "./youngPeople";
import { packageKeyOf, packageYearShown } from "./packageRun";
import { BENCHMARK_SHORT, comparisonFor, estimateFor, figureNumber, figureRange, figureShare, parseBenchmarks } from "./benchmarks";
import { NOT_COMPUTABLE_MEASURES } from "./notComputable";
import { CALCULATOR_ONLY_MEASURES, withCalculatorOnly } from "../calculatorOnlyMeasures";

const fixture = JSON.parse(readFileSync(join(__dirname, "..", "..", "test", "fixtures", "milburn", "milburn_scenarios.json"), "utf8"));
const benchmarksFile = JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "public", "data", "milburn_benchmarks.json"), "utf8"));

const ageRow = (reform_id, extra = {}) => ({ reform_id, year: "2027", age_band: "16-24", people: "1000000", pct_worse_off: "10", ...extra });

describe("the scenarios file", () => {
  it("reads the fixture's entry cases", () => {
    const parsed = parseScenarios(fixture);
    expect(parsed.year).toBe(2027);
    expect(parsed.entryCases.map((entry) => entry.id)).toEqual(["h16", "h25"]);
  });

  it("is unavailable, never zeros, without a year or a complete case", () => {
    expect(parseScenarios(null)).toBeNull();
    expect(parseScenarios({ ...fixture, year: undefined })).toBeNull();
    const missing = { ...fixture.entry_cases[0], exchequer_gain_package: null };
    expect(parseScenarios({ ...fixture, entry_cases: [missing] })).toBeNull();
    expect(parseScenarios({ ...fixture, entry_cases: [missing, fixture.entry_cases[1]] }).entryCases.map((entry) => entry.id)).toEqual(["h25"]);
  });
});

describe("the package's static figure", () => {
  it("reads the package's static figure for the year, or null", () => {
    const rows = [{ reform_id: "milburn_package", year: "2027", value: "-0.5" }];
    expect(packageStaticBn(rows, "milburn_package", 2027)).toBe(-0.5);
    expect(packageStaticBn(rows, "milburn_package", 2028)).toBeNull();
    expect(packageStaticBn([{ ...rows[0], value: "" }], "milburn_package", 2027)).toBeNull();
  });
});

describe("young people worse off", () => {
  it("is people times the share worse off on the 16-24 row", () => {
    expect(youngPeopleWorseOff([ageRow("milburn_package")], "milburn_package", 2027)).toBe(100000);
  });

  it("is null without the row or a column", () => {
    expect(youngPeopleWorseOff([ageRow("milburn_package")], "milburn_package", 2028)).toBeNull();
    expect(youngPeopleWorseOff([ageRow("milburn_package", { pct_worse_off: "" })], "milburn_package", 2027)).toBeNull();
    expect(youngPeopleWorseOff(null, "milburn_package", 2027)).toBeNull();
  });

});

describe("the package run", () => {
  const entry = (extra = {}) => ({ status: "approved", years: [2027, 2028], measures: ["a", "b"], artifact: "x", ...extra });
  const catalogue = (combined, extra = {}) => ({
    combinedId: null,
    manifest: { measures: { a: { status: "approved", years: [2027, 2028] }, b: { status: "approved", years: [2027] } }, combined },
    tablesByKey: Object.fromEntries(Object.keys(combined).map((key) => [key, {}])),
    failures: {},
    ...extra,
  });

  it("is the catalogue's combined run, else the one combined run the page verified", () => {
    expect(packageKeyOf({ combinedId: "combined--abc" })).toBe("combined--abc");
    expect(packageKeyOf(catalogue({ "combined--p": entry() }))).toBe("combined--p");
    expect(packageKeyOf(catalogue({ "combined--p": entry(), "combined--q": entry() }))).toBeNull();
    expect(packageKeyOf(catalogue({ "combined--p": entry({ status: "withdrawn" }) }))).toBeNull();
    expect(packageKeyOf(catalogue({ "combined--p": entry() }, { failures: { "combined--p": "bad" } }))).toBeNull();
    expect(packageKeyOf({ combinedId: null, manifest: null })).toBeNull();
  });

  it("shows a year only where the run and every member are published for it", () => {
    const shown = catalogue({ "combined--p": entry() });
    expect(packageYearShown(shown, "combined--p", "2027")).toBe(true);
    expect(packageYearShown(shown, "combined--p", 2028)).toBe(false);
    expect(packageYearShown(shown, "combined--q", 2027)).toBe(false);
  });
});

describe("the benchmarks file", () => {
  const parsed = parseBenchmarks(benchmarksFile);

  it("has a figure, value, basis, source and date for each row, links over https", () => {
    expect(parsed.rows.length).toBeGreaterThanOrEqual(6);
    for (const row of parsed.rows) {
      expect(row.figure, row.id).toBeTruthy();
      if (row.url) expect(row.url, row.id).toMatch(/^https:\/\//);
    }
    // Rows without a usable source (including the unsourced ~430k PIP 16-24 caseload) are gone, and no URL carries a stray %20
    for (const id of ["pip_young_2025_26", "pip_16_24", "pip_16_24_caseload", "opportunities_claim"]) expect(parsed.rows.find((row) => row.id === id), id).toBeUndefined();
    for (const row of parsed.rows) if (row.url) expect(row.url, row.id).not.toContain("%20");
  });

  it("fills a PolicyEngine estimate only where the verified results have one", () => {
    // The package's figure is worked out from the results; two rows carry a
    // fixed figure from the named build; every other row is blank
    expect(parsed.rows.filter((row) => row.estimate).map((row) => row.id)).toEqual([
      "uc_health_no_work_requirements",
      "package_young_people_affected",
      "employer_nics_under_25",
    ]);
    for (const row of parsed.rows.filter((each) => each.estimate?.fixed)) {
      expect(row.estimate.label, row.id).toBe("PolicyEngine, build fcfac709, 2027-28");
      expect(estimateFor(row, { ageRows: [], packageRows: [], packageKey: null, year: 2027 })).toBeNull();
    }
    expect(parsed.rows.find((row) => row.id === "uc_health_no_work_requirements").estimate.fixed).toBe("232,000");
    expect(parsed.rows.find((row) => row.id === "employer_nics_under_25").estimate.fixed).toBe("£4.43bn a year");
    const ucRow = { id: "x", estimate: { package: false, reformId: "uc_health_element_removed_under_25", metric: "young_people_worse_off" } };
    const neetRow = parsed.rows.find((row) => row.id === "neet_16_24");
    const packageRow = parsed.rows.find((row) => row.id === "package_young_people_affected");
    const ageRows = [ageRow("uc_health_element_removed_under_25")];
    const packageRows = [ageRow("combined--abc", { pct_worse_off: "20" })];
    const sources = { ageRows, packageRows, packageKey: "combined--abc", year: 2027 };
    expect(estimateFor(ucRow, sources)).toBe(100000);
    expect(estimateFor(packageRow, sources)).toBe(200000);
    expect(estimateFor(neetRow, sources)).toBeNull();
    expect(estimateFor(ucRow, { ...sources, ageRows: null })).toBeNull();
    expect(estimateFor(packageRow, { ...sources, packageRows: null, packageKey: null })).toBeNull();
  });
});

describe("the benchmark charts", () => {
  const parsed = parseBenchmarks(benchmarksFile);
  const row = (id) => parsed.rows.find((each) => each.id === id);

  it("read a figure as a number only where it is one plain number", () => {
    expect(figureNumber("260,000")).toEqual({ number: 260000, unit: "count", text: "260,000" });
    expect(figureNumber("£4.43bn a year")).toEqual({ number: 4.43, unit: "bn", text: "£4.43bn" });
    for (const wording of ["About 1.0 million", "About £8bn a year", "£1.3bn (2022) to £2.0bn (2025)", "About 1 in 5", ""]) {
      expect(figureNumber(wording), wording).toBeNull();
    }
  });

  it("pair a published figure with a fixed estimate in the same unit, with the gap as a % of the published figure", () => {
    expect(parsed.rows.filter((each) => comparisonFor(each)).map((each) => each.id)).toEqual([
      "uc_health_no_work_requirements",
      "employer_nics_under_25",
    ]);
    const health = comparisonFor(row("uc_health_no_work_requirements"));
    expect(health).toMatchObject({ unit: "count", published: 260000, estimate: 232000 });
    expect(health.gapPct).toBeCloseTo(((232000 - 260000) / 260000) * 100, 10);
    const nics = comparisonFor(row("employer_nics_under_25"));
    expect(nics).toMatchObject({ unit: "bn", published: 5.1, estimate: 4.43, publishedText: "£5.1bn", estimateText: "£4.43bn" });
    expect(nics.gapPct).toBeCloseTo(((4.43 - 5.1) / 5.1) * 100, 10);
    // Different units, or no fixed estimate, are never paired
    expect(comparisonFor({ value: "260,000", estimate: { fixed: "£4.43bn a year" } })).toBeNull();
    expect(comparisonFor(row("package_young_people_affected"))).toBeNull();
    expect(comparisonFor(row("neet_16_24"))).toBeNull();
  });

  it("read a dated range and a share from their wording", () => {
    expect(figureRange(row("incapacity_spending_18_24").value)).toEqual([
      { label: "2022", text: "£1.3bn", number: 1.3 },
      { label: "2025", text: "£2.0bn", number: 2 },
    ]);
    expect(figureRange("£5.1bn a year")).toBeNull();
    expect(figureShare(row("pip_no_extra_costs").value)).toEqual({ count: 1, of: 5 });
    expect(figureShare("About 6 in 5")).toBeNull();
    expect(figureShare("120,000")).toBeNull();
  });

  it("give every figure in the file its own icon", () => {
    const icons = parsed.rows.map((each) => BENCHMARK_SHORT[each.id]?.icon);
    expect(icons.every(Boolean)).toBe(true);
    expect(new Set(icons).size).toBe(icons.length);
  });
});

describe("the measures we cannot compute", () => {
  it("lists the four, each with a reason and no figure", () => {
    expect(NOT_COMPUTABLE_MEASURES.map((measure) => measure.id)).toEqual([
      "severe_conditions_higher_rate",
      "additional_cost_allowance",
      "youth_conditionality",
      "youth_guarantee_expansion",
    ]);
    for (const measure of NOT_COMPUTABLE_MEASURES) {
      expect(measure.notModelled, measure.id).toBeTruthy();
      expect(JSON.stringify(measure), measure.id).not.toMatch(/£0/);
    }
  });
});

describe("the household calculator", () => {
  it("adds no Autumn Budget calculator-only measure to a request", () => {
    expect(CALCULATOR_ONLY_MEASURES).toEqual({});
    expect(withCalculatorOnly(["uc_health_element_removed_under_25"])).toEqual(["uc_health_element_removed_under_25"]);
  });
});
