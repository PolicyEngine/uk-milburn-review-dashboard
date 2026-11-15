import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { packageStaticBn, parseScenarios, scenarioFigures } from "./scenarios";
import { youngPeopleWorseOff } from "./youngPeople";
import { packageKeyOf, packageYearShown } from "./packageRun";
import { estimateFor, parseBenchmarks } from "./benchmarks";
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

describe("a scenario's figures", () => {
  const entryCase = parseScenarios(fixture).entryCases[0];

  it("multiplies the movers by the package's gain to the Exchequer, in £m", () => {
    const figures = scenarioFigures({ entryCase, sharePct: 20, affected: 100000, staticBn: 1.5 });
    expect(figures.movers).toBe(20000);
    expect(figures.offsetM).toBeCloseTo(80);
    expect(figures.staticM).toBeCloseTo(1500);
    expect(figures.afterM).toBeCloseTo(1580);
  });

  it("is null when the count or the static figure is missing", () => {
    expect(scenarioFigures({ entryCase, sharePct: 20, affected: null, staticBn: 1 })).toBeNull();
    expect(scenarioFigures({ entryCase, sharePct: 20, affected: 1, staticBn: null })).toBeNull();
  });

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
    expect(parsed.rows.find((row) => row.id === "pip_16_24").pressReport).toBe(true);
  });

  it("fills a PolicyEngine estimate only where the verified results have one", () => {
    // Only the package's figure is comparable; every other row is blank
    expect(parsed.rows.filter((row) => row.estimate).map((row) => row.id)).toEqual(["package_young_people_affected"]);
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
