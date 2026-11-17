import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

const fixture = readFileSync(join(__dirname, "..", "..", "test", "fixtures", "milburn", "milburn_scenarios.json"), "utf8");
const benchmarks = readFileSync(join(__dirname, "..", "..", "..", "public", "data", "milburn_benchmarks.json"), "utf8");

const state = vi.hoisted(() => ({ ageRows: null, budgetRows: null, catalogue: { combinedId: null } }));

vi.mock("../YoungPeopleSection", () => ({
  useAgeImpactRows: () => (state.measureRows ? { status: "ready", rows: state.measureRows } : { status: "unavailable", rows: null }),
}));
// The package run's own tables (utils/milburn/packageRun.js)
vi.mock("../../utils/milburn/packageRun", () => ({
  usePackageTable: (catalogue, table) => {
    const rows = table === "age_impact" ? state.ageRows : state.budgetRows;
    return rows ? { key: "combined--pkg", status: "ready", rows } : { key: "combined--pkg", status: "unavailable", rows: null };
  },
}));
vi.mock("../../utils/measureCatalogue", () => ({
  useMeasureCatalogue: () => state.catalogue,
}));
vi.mock("recharts", async () => {
  const actual = await vi.importActual("recharts");
  return { ...actual, ResponsiveContainer: ({ children }) => <div style={{ width: 800, height: 400 }}>{children}</div> };
});

const respond = (body) =>
  vi.fn(async () => (body === null ? { ok: false, status: 404, json: async () => null } : { ok: true, status: 200, json: async () => JSON.parse(body) }));

afterEach(() => {
  vi.unstubAllGlobals();
  state.ageRows = null;
  state.budgetRows = null;
  state.measureRows = null;
});

const youngRow = { reform_id: "combined--pkg", year: "2027", age_band: "16-24", people: "1000000", pct_worse_off: "10" };

const summaryText = readFileSync(join(__dirname, "..", "..", "test", "fixtures", "milburn", "summary", "milburn_summary.json"), "utf8");

/** Serves the scenarios and summary files, either missing when null. */
const serve = ({ scenarios = fixture, summary = summaryText } = {}) =>
  vi.fn(async (url) => {
    const body = String(url).endsWith("milburn_summary.json") ? summary : scenarios;
    return body === null ? { ok: false, status: 404, json: async () => null } : { ok: true, status: 200, json: async () => JSON.parse(body) };
  });

describe("Return to work", () => {
  it("leads with the microsimulated entry run, then the entry cases and the break-even arithmetic, with no slider", async () => {
    vi.stubGlobal("fetch", serve());
    const { default: BehaviouralScenarios } = await import("./BehaviouralScenarios");
    render(<BehaviouralScenarios />);
    expect(await screen.findByRole("region", { name: "With a quarter moving into work" })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "One young person moving into work" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Break-even arithmetic" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Return to work" })).toBeInTheDocument();
    expect(screen.queryByRole("slider")).toBeNull();
    // The assumption names the group that moves, and the tab says its figures are for one year
    const tab = screen.getByRole("heading", { name: "Return to work" }).closest(".milburn-scenarios");
    expect(tab.textContent).toContain(
      "Assumption: 25% of non-working 18 to 24-year-olds with PIP or the health element move into 16 hours' work a week at the minimum wage for their age, microsimulated.",
    );
    expect(tab.querySelector("[data-year-only]").textContent).toBe("2027-28 only: the year selector does not change this tab.");
    expect(tab.textContent).not.toMatch(/young people who lose|leaves worse off|Why the effect is small|not a new incentive|not reachable/);
    // The entry cases from the file: 16 hours at £10 an hour
    const cases = screen.getByRole("region", { name: "One young person moving into work" });
    expect(within(cases).getAllByRole("row")[1].textContent).toBe("16 hours£10.00£1,000; £2,000£3,000; £4,000");
  });

  it("shows unavailable states, never zeros, when the files are missing", async () => {
    vi.stubGlobal("fetch", serve({ scenarios: null, summary: null }));
    const { default: BehaviouralScenarios } = await import("./BehaviouralScenarios");
    render(<BehaviouralScenarios />);
    expect(await screen.findByText(/entry cases are not available/)).toBeInTheDocument();
    expect(await screen.findByText(/comparison is not available/)).toBeInTheDocument();
    expect(screen.queryByText(/£0/)).toBeNull();
  });
});

describe("Benchmarks", () => {
  it("lists every published figure with its source, opening in a new tab", async () => {
    vi.stubGlobal("fetch", respond(benchmarks));
    state.ageRows = [youngRow];
    state.measureRows = [{ ...youngRow, reform_id: "uc_health_element_removed_under_25", pct_worse_off: "3" }];
    const { default: BenchmarksTable } = await import("./BenchmarksTable");
    render(<BenchmarksTable />);
    expect(await screen.findByText("260,000")).toBeInTheDocument();
    expect(screen.getByText("62,570")).toBeInTheDocument();
    expect(screen.getAllByText("Press report").length).toBeGreaterThan(0);
    for (const link of within(screen.getByRole("region", { name: "Benchmarks" })).getAllByRole("link")) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    // The package's estimate from its own run
    expect(screen.getByText("100,000")).toBeInTheDocument();
    expect(screen.queryByText("30,000")).toBeNull();
    // Fixed PolicyEngine figures beside the published ones, each labelled with its build and year
    for (const [published, estimate] of [["260,000", "232,000"]]) {
      const row = screen.getByText(published).closest("li");
      expect(row.textContent).toContain(estimate);
      expect(row.textContent).toContain("PolicyEngine, build fcfac709, 2027-28");
    }
    expect(screen.getByText("£4.43bn a year").closest("li").textContent).toContain("£5.1bn a year");
    // Each comparable pair is a comparison panel with its gap as a % of the published figure
    const region = screen.getByRole("region", { name: "Benchmarks" });
    expect([...region.querySelectorAll(".bm-compare")].map((panel) => panel.dataset.benchmark)).toEqual([
      "uc_health_no_work_requirements",
      "employer_nics_under_25",
    ]);
    expect(screen.getByText("260,000").closest("li").textContent).toContain("PolicyEngine is 10.77% lower");
    expect(screen.getByText("£4.43bn a year").closest("li").textContent).toContain("PolicyEngine is 13.14% lower");
    // Every other figure is a stat tile under its theme, once, with its source and date
    expect([...region.querySelectorAll(".bm-tile")].map((tile) => tile.dataset.benchmark)).toEqual([
      "neet_16_24",
      "uc_lcwra_16_24",
      "package_young_people_affected",
      "incapacity_spending_18_24",
      "young_benefits_spend",
      "kept_out_of_poverty",
      "pip_no_extra_costs",
    ]);
    const lcwra = screen.getByText("62,570").closest("li");
    expect(within(lcwra).getByRole("link", { name: /DWP, via Benefits and Work/ })).toBeInTheDocument();
    expect(lcwra.textContent).toContain("May 2026");
    expect(lcwra.textContent).toContain("Press report");
    // The page's notes are folded away
    expect(screen.getByText("About these figures").closest("details")).not.toHaveAttribute("open");
    // Rows without a source are gone, and no link carries a stray %20 or points elsewhere than its label
    expect(screen.queryByText(/465,000/)).toBeNull();
    expect(screen.queryByText(/440,000 by 2036/)).toBeNull();
    for (const link of within(screen.getByRole("region", { name: "Benchmarks" })).getAllByRole("link")) {
      expect(link.getAttribute("href")).not.toContain("%20");
      expect(link.getAttribute("href")).not.toContain("aol.");
    }
  });

  it("shows an unavailable state when its file is missing", async () => {
    vi.stubGlobal("fetch", respond(null));
    const { default: BenchmarksTable } = await import("./BenchmarksTable");
    render(<BenchmarksTable />);
    expect(await screen.findByText("The benchmarks are not available.")).toBeInTheDocument();
  });
});
