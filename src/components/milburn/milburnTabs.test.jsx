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

describe("Behavioural scenarios", () => {
  it("shows an unavailable state, never zeros, when the file is missing", async () => {
    vi.stubGlobal("fetch", respond(null));
    const { default: BehaviouralScenarios } = await import("./BehaviouralScenarios");
    render(<BehaviouralScenarios />);
    expect(await screen.findByText(/data file has not been published/)).toBeInTheDocument();
    expect(screen.getByText("Illustrative scenarios, not a PolicyEngine estimate. The main figures are static.")).toBeInTheDocument();
    expect(screen.queryByText(/£0/)).toBeNull();
  });

  it("shows an unavailable state when the verified results give no count of young people", async () => {
    vi.stubGlobal("fetch", respond(fixture));
    state.budgetRows = [{ reform_id: "combined--pkg", year: "2027", value: "1.2" }];
    const { default: BehaviouralScenarios } = await import("./BehaviouralScenarios");
    render(<BehaviouralScenarios />);
    expect(await screen.findByText(/give no count of young people affected/)).toBeInTheDocument();
  });

  it("works out the movers and the offset from the file and the verified results", async () => {
    vi.stubGlobal("fetch", respond(fixture));
    state.ageRows = [youngRow];
    state.budgetRows = [{ reform_id: "combined--pkg", year: "2027", value: "1.2" }];
    const { default: BehaviouralScenarios } = await import("./BehaviouralScenarios");
    render(<BehaviouralScenarios />);
    // 20% of 100,000 young people worse off, each £4,000 to the Exchequer
    expect(await screen.findByText("20,000")).toBeInTheDocument();
    expect(screen.getAllByText("+£80.0m").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+£1,280.0m").length).toBeGreaterThan(0);
    expect(screen.getByRole("slider")).toHaveAttribute("max", "50");
    for (const preset of ["0%", "20%", "45%"]) expect(screen.getByRole("button", { name: preset })).toBeInTheDocument();
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
    expect(screen.getByText("Press report")).toBeInTheDocument();
    for (const link of within(screen.getByRole("table")).getAllByRole("link")) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    // The package's estimate from its own run; no other row has a comparable figure
    expect(screen.getByText("100,000")).toBeInTheDocument();
    expect(screen.queryByText("30,000")).toBeNull();
  });

  it("shows an unavailable state when its file is missing", async () => {
    vi.stubGlobal("fetch", respond(null));
    const { default: BenchmarksTable } = await import("./BenchmarksTable");
    render(<BenchmarksTable />);
    expect(await screen.findByText("The benchmarks are not available.")).toBeInTheDocument();
  });
});
