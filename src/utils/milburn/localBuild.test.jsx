/**
 * The local build route (localBuild.js): the flat results the pipeline
 * writes per run, turned into the shapes the page's charts read, and the
 * runs not yet made. Fixtures: src/test/fixtures/milburn/local-build/
 * (invented figures; two runs present, the others missing).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  isLocalBuildRoute,
  loadLocalBuildParts,
  loadRun,
  localBuildNotice,
  NOT_YET_RUN,
  parseBuildRecord,
  parseMeasuresFile,
  runTables,
} from "./localBuild";
import { budgetChartData, dashboardFromParts, loadVerifiedTables } from "../loadDashboard";
import { loadPackageTable, packageKeyOf, packageYearShown } from "./packageRun";
import { youngPeopleWorseOff } from "./youngPeople";
import { packageStaticBn } from "./scenarios";
import { MeasureCatalogueProvider } from "../measureCatalogue";
import LocalBuildLabel from "../../components/milburn/LocalBuildLabel";
import NotComputableMeasures, { NOT_YET_RUN_TITLE } from "../../components/milburn/NotComputableMeasures";

const FIXTURE = join(__dirname, "..", "..", "test", "fixtures", "milburn", "local-build");
const LABEL = "build 6f918b81, policyengine-uk 2.177.7, not in a policyengine.py release";
const RAN = ["milburn_package", "pip_removed_under_25"];
const PACKAGE_ID = "milburn_package";

/** A fetch serving the fixture as public/ serves /data/, 404 for anything missing. */
function fixtureFetch(root = FIXTURE, { drop = [] } = {}) {
  return async (url) => {
    const path = url.replace(/^\/data\//, "");
    if (drop.some((file) => path.endsWith(file))) return new Response(null, { status: 404 });
    try {
      return new Response(readFileSync(join(root, path)), { status: 200 });
    } catch {
      return new Response(null, { status: 404 });
    }
  };
}

const loadParts = (options = {}) => loadLocalBuildParts("", { fetchImpl: fixtureFetch(FIXTURE, options) });

describe("the route", () => {
  it("is the local build route only when NEXT_PUBLIC_DATA_ROUTE says so", () => {
    expect(isLocalBuildRoute("local-build")).toBe(true);
    expect(isLocalBuildRoute("verified")).toBe(false);
    expect(isLocalBuildRoute(undefined)).toBe(false);
  });
});

describe("the measures file", () => {
  const file = parseMeasuresFile(JSON.parse(readFileSync(join(FIXTURE, "milburn_measures.json"), "utf8")));

  it("lists the six computable runs, the package included, and the four not computable", () => {
    expect(file.computable.map((measure) => measure.id)).toEqual([
      "milburn_package",
      "uc_health_element_removed_under_25",
      "uc_health_element_removed_under_25_new_claims",
      "pip_removed_under_25",
      "youth_allowance_at_25_plus_rate",
      "employer_nics_zero_under_25",
    ]);
    expect(file.notComputable.map((measure) => measure.id)).toEqual([
      "severe_conditions_higher_rate",
      "additional_cost_allowance",
      "youth_conditionality",
      "youth_guarantee_expansion",
    ]);
    for (const measure of file.notComputable) expect(measure.reason, measure.id).toBeTruthy();
    expect(file.computable[0].members).toEqual(["uc_health_element_removed_under_25", "pip_removed_under_25"]);
  });

  it("is null when it is not that file", () => {
    expect(parseMeasuresFile(null)).toBeNull();
    expect(parseMeasuresFile({ measures: "x" })).toBeNull();
  });
});

describe("a run's build record", () => {
  const record = JSON.parse(readFileSync(join(FIXTURE, "milburn", "milburn_package", "model_build.json"), "utf8"));

  it("carries the label, the engine and the years", () => {
    const parsed = parseBuildRecord(record, "milburn_package");
    expect(parsed.label).toBe(LABEL);
    expect(parsed.certified).toBe(false);
    expect(parsed.engine).toEqual({ "policyengine-uk": "2.177.7", "policyengine-core": "3.34.10" });
    expect(parsed.years).toEqual([2027, 2028]);
  });

  it("is refused if certified, for another run, or without a label or years", () => {
    expect(parseBuildRecord({ ...record, certified: true }, "milburn_package")).toBeNull();
    expect(parseBuildRecord(record, "pip_removed_under_25")).toBeNull();
    expect(parseBuildRecord({ ...record, label: "" }, "milburn_package")).toBeNull();
    expect(parseBuildRecord({ ...record, years: [] }, "milburn_package")).toBeNull();
  });
});

describe("a run's tables", () => {
  const files = (id) =>
    Object.fromEntries(
      ["budgetary_impact", "distributional_impact", "winners_losers", "metrics", "age_impact"].map((table) => [
        table,
        readFileSync(join(FIXTURE, "milburn", id, `${table}.csv`), "utf8"),
      ]),
    );

  it("are typed as the verified route types them, metrics with its poverty columns", () => {
    const tables = runTables("milburn_package", files("milburn_package"));
    expect(tables.budgetary_impact[0]).toEqual({ reform_id: "milburn_package", reform_name: "Milburn package (combined)", year: 2027, value: 1 });
    expect(tables.distributional_impact).toHaveLength(20);
    expect(typeof tables.winners_losers[0].avg_change).toBe("number");
    expect(tables.metrics[0]).toHaveProperty("poverty_abs_bhc_change_pp");
    // A percentage of people, as the pipeline writes it (calculators.py)
    expect(tables.metrics[0].people_affected).toBe(2.5);
    const young = tables.age_impact.find((row) => row.year === 2027 && row.age_band === "16-24");
    expect(young.people).toBe(6000000);
    expect(young.pct_worse_off).toBe(5);
  });

  it("refuse a file with another run's rows", () => {
    expect(() => runTables("pip_removed_under_25", files("milburn_package"))).toThrow(/rows for milburn_package/);
  });
});

describe("a run's folder", () => {
  it("is not yet run (null) without its build record, never zero", async () => {
    expect(await loadRun("youth_allowance_at_25_plus_rate", { fetchImpl: fixtureFetch() })).toBeNull();
    expect(await loadRun("milburn_package", { fetchImpl: fixtureFetch(FIXTURE, { drop: ["milburn_package/model_build.json"] }) })).toBeNull();
  });

  it("is an error with its build record but a table missing", async () => {
    const run = await loadRun("milburn_package", { fetchImpl: fixtureFetch(FIXTURE, { drop: ["milburn_package/age_impact.csv"] }) });
    expect(run.error).toMatch(/age_impact\.csv missing/);
  });
});

describe("the page's figures from the local build", () => {
  it("make each present run a displayable measure, and the others not yet run", async () => {
    const parts = await loadParts();
    const { catalogue, budgetary, distributional, winnersLosers, metrics } = dashboardFromParts(parts);
    expect(catalogue.localBuild.label).toBe(LABEL);
    expect(catalogue.displayable.map((measure) => measure.id).sort()).toEqual(RAN);
    // No combined run: one run is shown at a time, never a sum
    expect(catalogue.combinedId).toBeNull();
    for (const id of ["uc_health_element_removed_under_25", "uc_health_element_removed_under_25_new_claims", "youth_allowance_at_25_plus_rate", "employer_nics_zero_under_25"]) {
      const measure = catalogue.byId.get(id);
      expect(measure.displayable, id).toBe(false);
      expect(measure.availability.reason, id).toBe(NOT_YET_RUN);
    }
    expect(catalogue.localBuild.notRun).toHaveLength(4);
    // The not-computable measures are not in the catalogue: no picker row, no figure
    expect(catalogue.byId.has("youth_conditionality")).toBe(false);
    expect(catalogue.localBuild.notComputable).toHaveLength(4);
    for (const rows of [budgetary, distributional, winnersLosers, metrics]) {
      expect(new Set(rows.map((row) => row.reform_id))).toEqual(new Set(RAN));
    }
    expect(budgetary.find((row) => row.reform_id === "pip_removed_under_25" && row.year === 2028).value).toBeCloseTo(0.66);
  });

  it("chart a measure not yet run as unpublished, not zero", async () => {
    const { catalogue, budgetary } = dashboardFromParts(await loadParts());
    const [point] = budgetChartData(budgetary, catalogue.displayable, ["pip_removed_under_25"], [2027]);
    expect(point["measure:pip_removed_under_25"]).toBeCloseTo(0.6);
    expect(point.netImpact).toBeCloseTo(0.6);
    const [missing] = budgetChartData(budgetary, catalogue.measures, ["employer_nics_zero_under_25"], [2027]);
    expect(missing["measure:employer_nics_zero_under_25"]).toBeNull();
    expect(missing.netImpact).toBeNull();
  });

  it("give the lazily loaded tables from the runs already read, the scatter only where written", async () => {
    const { catalogue } = dashboardFromParts(await loadParts());
    const age = await loadVerifiedTables(catalogue, "age_impact");
    expect(age.failures).toEqual([]);
    expect(new Set(age.rows.map((row) => row.reform_id))).toEqual(new Set(RAN));
    const scatter = await loadVerifiedTables(catalogue, "household_scatter_binned");
    // Present for the package only: the PIP run's scatter is unavailable
    expect(scatter.rows.map((row) => row.reform_id)).toEqual([PACKAGE_ID, PACKAGE_ID]);
    expect(scatter.failures).toEqual(["pip_removed_under_25"]);
  });

  it("feed the package's people affected and static cost to Behavioural scenarios and Benchmarks", async () => {
    const { catalogue } = dashboardFromParts(await loadParts());
    expect(packageKeyOf(catalogue)).toBe(PACKAGE_ID);
    expect(packageYearShown(catalogue, PACKAGE_ID, 2027)).toBe(true);
    expect(packageYearShown(catalogue, PACKAGE_ID, 2031)).toBe(false);
    const age = await loadPackageTable(catalogue, PACKAGE_ID, "age_impact");
    const budgetary = await loadPackageTable(catalogue, PACKAGE_ID, "budgetary_impact");
    // 6,000,000 aged 16 to 24, 5% worse off
    expect(youngPeopleWorseOff(age, PACKAGE_ID, 2027)).toBe(300000);
    expect(packageStaticBn(budgetary, PACKAGE_ID, 2027)).toBeCloseTo(1);
  });

  it("have no package without its folder", async () => {
    const { catalogue } = dashboardFromParts(await loadParts({ drop: ["milburn_package/model_build.json"] }));
    expect(packageKeyOf(catalogue)).toBeNull();
    expect(catalogue.byId.get(PACKAGE_ID).availability.reason).toBe(NOT_YET_RUN);
  });

  it("list a folder that cannot be read as unavailable, with the reason", async () => {
    const { catalogue } = dashboardFromParts(await loadParts({ drop: ["pip_removed_under_25/metrics.csv"] }));
    const measure = catalogue.byId.get("pip_removed_under_25");
    expect(measure.displayable).toBe(false);
    expect(measure.availability.reason).toMatch(/^Results unavailable: metrics\.csv missing/);
  });

  it("change their snapshot key when a run is added", async () => {
    const before = await loadParts({ drop: ["pip_removed_under_25/model_build.json"] });
    const after = await loadParts();
    expect(before.snapshotSha256).not.toBe(after.snapshotSha256);
    expect(after.manifest.snapshotSha256).toBe(after.snapshotSha256);
  });

  it("are none without the measures file", async () => {
    expect(await loadParts({ drop: ["milburn_measures.json"] })).toEqual({ status: "no-manifest" });
  });
});

describe("the label and the Policies lists", () => {
  it("say the build and that it is not certified", async () => {
    const { catalogue } = dashboardFromParts(await loadParts());
    expect(localBuildNotice(catalogue.localBuild)).toBe(`Local build: ${LABEL}, not certified`);
    render(
      <MeasureCatalogueProvider catalogue={catalogue}>
        <LocalBuildLabel />
        <NotComputableMeasures />
      </MeasureCatalogueProvider>,
    );
    expect(screen.getByRole("note").textContent).toContain(`Figures from ${LABEL}: not certified.`);
    expect(screen.getByRole("note").textContent).toContain("Not yet run: ");
    const pending = screen.getByRole("region", { name: NOT_YET_RUN_TITLE });
    expect(pending.textContent).toContain("Employer NICs zero rate extended to under-25s");
    expect(pending.textContent).not.toContain("PIP removed for 18 to 24-year-olds");
    expect(pending.textContent).not.toMatch(/£0/);
    const notComputable = screen.getByRole("region", { name: "Candidate measures we cannot compute" });
    expect(notComputable.textContent).toContain("The data hold no severe conditions flag");
  });
});
