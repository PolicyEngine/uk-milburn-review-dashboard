import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

const fixture = readFileSync(join(__dirname, "..", "..", "test", "fixtures", "milburn", "milburn_scenarios.json"), "utf8");
const reviewFigures = readFileSync(join(__dirname, "..", "..", "..", "public", "data", "milburn_review_figures.json"), "utf8");
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

// The benchmarks file's year (policyengine_estimate_year), 2029-30
const youngRow = { reform_id: "combined--pkg", year: "2029", age_band: "16-24", people: "1000000", pct_worse_off: "10" };

const summaryText = readFileSync(join(__dirname, "..", "..", "test", "fixtures", "milburn", "summary", "milburn_summary.json"), "utf8");

/** Serves the scenarios, summary and review figures files, each missing when null. */
const serve = ({ scenarios = fixture, summary = summaryText, review = reviewFigures } = {}) =>
  vi.fn(async (url) => {
    const path = String(url);
    const body = path.endsWith("milburn_summary.json") ? summary : path.endsWith("milburn_review_figures.json") ? review : scenarios;
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
    // The assumption links to the Methodology passage that explains the 25%
    expect(screen.getByRole("link", { name: "Why 25%, and how it is run" })).toHaveAttribute("href", "?tab=methodology#method-behavioural-scenarios");
    expect(tab.textContent).not.toMatch(/young people who lose|leaves worse off|Why the effect is small|not a new incentive|not reachable/);
    // The entry cases from the file: 16 hours at £10 an hour
    const cases = screen.getByRole("region", { name: "One young person moving into work" });
    expect(within(cases).getAllByRole("row")[1].textContent).toBe("16 hours£10.00£1,000; £2,000£3,000; £4,000");
  });

  it("sets its illustrative run beside the review's own estimate as a different exercise, citing the report", async () => {
    vi.stubGlobal("fetch", serve());
    const { default: BehaviouralScenarios, DIFFERENT_EXERCISES_SENTENCE, REVIEW_COMPARISON_TITLE } = await import("./BehaviouralScenarios");
    render(<BehaviouralScenarios />);
    const section = await screen.findByRole("region", { name: REVIEW_COMPARISON_TITLE });
    // The review's figures come from the published file, never from the component
    const published = JSON.parse(reviewFigures);
    expect(published.employment.people).toBe(440000);
    expect(published.employment.by_year).toBe(2036);
    const row = (key) => [...section.querySelector(`tr[data-row="${key}"]`).children].map((cell) => cell.textContent);
    // The fixture’s entry run moves 70,400 people in 2027-28
    expect(row("people")).toEqual(["People moving into work", "About 70,000", "About 440,000"]);
    expect(row("when")).toEqual(["When", "2027-28", "By 2036"]);
    expect(row("who")[1]).toBe("25% of non-working 18 to 24-year-olds with PIP or the health element, chosen at random");
    expect(row("method")[1]).toBe("Microsimulation with an assumed move into work; the entry rate is assumed for illustration, not estimated");
    expect(row("method")[2]).toBe(published.employment.method);
    expect(row("work")[2]).toBe(published.employment.hours);
    expect(row("neet")).toEqual(["NEET rate, 16 to 24-year-olds", "Not modelled", "13.1% in 2026/27 to 6.8% in 2036/37; 13.4% in 2036/37 without the reforms; the review’s ambition is around 5%"]);
    // Two cards say whose figure each is: ours an estimate, the review's published
    const card = (side) => section.querySelector(`.milburn-versus-card[data-side="${side}"]`);
    expect(card("ours").querySelector("h4").textContent).toBe("PolicyEngine: illustrative scenario");
    expect(card("ours").querySelector("[data-source-kind]").textContent).toBe("PolicyEngine estimate");
    expect(card("ours").querySelector(".milburn-versus-figure").textContent).toBe("About 70,000");
    expect(card("theirs").querySelector("h4").textContent).toBe("The review’s modelling");
    expect(card("theirs").querySelector("[data-source-kind]").textContent).toBe("Published: the review");
    expect(card("theirs").querySelector(".milburn-versus-figure").textContent).toBe("About 440,000");
    for (const side of ["ours", "theirs"]) {
      const lines = [...card(side).querySelectorAll("[data-card-row]")];
      expect(lines.map((line) => line.dataset.cardRow)).toEqual(["when", "who", "measures", "method", "work", "neet"]);
      // One short line each, with an icon; the full wording is in the table
      for (const line of lines) {
        expect(line.querySelector("svg")).not.toBeNull();
        expect(line.textContent.split(/\s+/).length, line.textContent).toBeLessThanOrEqual(13);
      }
    }
    expect(card("theirs").querySelector('[data-card-row="neet"]').textContent).toBe("NEET rate: 13.1% to 6.8% by 2036/37; ambition around 5%");
    // The bars say whose each is
    expect(section.querySelector("[data-single-chart] [role=img]").getAttribute("aria-label")).toMatch(/PolicyEngine estimate, 2027-28: about 70,000\. The review \(published\), by 2036: about 440,000/);
    // One short source line in view; the table and the full citation are folded away
    expect(section.querySelector("[data-review-source-short]").textContent).toBe("Source: the review (17 November 2026)");
    expect(within(section.querySelector("[data-review-source-short]")).getByRole("link")).toHaveAttribute("href", published.report.url);
    expect(section.querySelector("details[data-full-comparison] > summary").textContent).toBe("Full comparison");
    expect(section.querySelector("details[data-full-comparison] table")).not.toBeNull();
    expect(section.querySelector("details[data-review-more] > summary").textContent).toBe("More info");
    expect(section.querySelector("details[data-review-more] [data-review-source]").textContent).toMatch(/^Source for the review’s figures: /);
    // Two exercises, neither called right
    expect(section.textContent).toContain(DIFFERENT_EXERCISES_SENTENCE);
    expect(section.textContent).not.toMatch(/overstat|understat|too high|too low|optimistic|pessimistic|more accurate|unrealistic|correct/i);
    // The report is cited, every link opening in a new tab
    const links = within(section).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toContain(published.report.url);
    for (const link of links) {
      expect(link.getAttribute("href")).toMatch(/^https:\/\/(www\.gov\.uk|assets\.publishing\.service\.gov\.uk)\//);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    // The annex's own rounding is said
    expect(section.querySelector("[data-review-annex]").textContent).toContain("around 400,000 more 16 to 24-year-olds in work in 2036");
    // The break-even chart marks the review's figure, labelled as the review's and for 2036
    const breakEven = screen.getByRole("region", { name: "Break-even arithmetic" });
    expect(breakEven.textContent).toContain("Review's own estimate, into work by 2036: 440,000");
    expect(breakEven.querySelector("[data-review-line]").textContent).toMatch(/drawn for scale: the entrants needed are for 2027-28/);
    expect(within(breakEven.querySelector("[data-review-line]")).getByRole("link")).toHaveAttribute("target", "_blank");
  });

  it("draws the review's line only beside the package runs, and nothing of the review when its file is missing", async () => {
    // A single measure's run: the package's figures under another id
    const withSingle = JSON.parse(summaryText);
    withSingle.runs.push({ ...withSingle.runs.find((run) => run.id === "milburn_package"), id: "one_measure_alone" });
    vi.stubGlobal("fetch", serve({ summary: JSON.stringify(withSingle) }));
    const { default: BehaviouralScenarios, REVIEW_COMPARISON_TITLE } = await import("./BehaviouralScenarios");
    const { unmount } = render(<BehaviouralScenarios selectedRun="one_measure_alone" />);
    await screen.findByRole("region", { name: REVIEW_COMPARISON_TITLE });
    const breakEven = screen.getByRole("region", { name: "Break-even arithmetic" });
    expect(breakEven.textContent).toContain("Entrants needed to match the Exchequer saving");
    expect(breakEven.textContent).not.toContain("Review's own estimate");
    expect(breakEven.querySelector("[data-review-line]")).toBeNull();
    unmount();
    vi.stubGlobal("fetch", serve({ review: null }));
    render(<BehaviouralScenarios />);
    expect(await screen.findByText(/review’s own figures are not available/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: REVIEW_COMPARISON_TITLE })).toBeNull();
    expect(document.body.textContent).not.toMatch(/Review.s own estimate|by 2036/);
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
    expect(screen.getByText("440,000")).toBeInTheDocument();
    expect(screen.getByText("£13.7bn by 2036-37")).toBeInTheDocument();
    // Every figure now cites its own publication: none is a press report
    expect(within(screen.getByRole("region", { name: "Benchmarks" })).queryByText("Press report")).toBeNull();
    for (const link of within(screen.getByRole("region", { name: "Benchmarks" })).getAllByRole("link")) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    // Each figure says whose it is: "Published", or "PolicyEngine estimate"
    const kinds = new Set([...document.querySelectorAll(".bm-pair dt, .bm-kicker")].map((label) => label.textContent.trim().replace(/, \d{4}-\d{2}$/, "")));
    expect([...kinds].sort()).toEqual(["PolicyEngine estimate", "Published"]);
    // The package's estimate from its own run
    expect(screen.getByText("100,000")).toBeInTheDocument();
    expect(screen.queryByText("30,000")).toBeNull();
    // Fixed PolicyEngine figures beside the published ones, each labelled with its build and year
    for (const [published, estimate] of [["260,000", "232,000"]]) {
      const row = screen.getByText(published).closest("li");
      expect(row.textContent).toContain(estimate);
      // A caseload is the 2027-28 baseline's, and says so; the savings are 2029-30's
      expect(row.textContent).toContain("PolicyEngine, build fcfac709, 2027-28 baseline caseload");
    }
    expect(screen.getByText("£4.65bn a year").closest("li").textContent).toContain("PolicyEngine, build fcfac709, 2029-30");
    expect(screen.getByText("£4.65bn a year").closest("li").textContent).toContain("£5.1bn a year");
    // Each comparable pair is a comparison panel with its gap as a % of the published figure
    const region = screen.getByRole("region", { name: "Benchmarks" });
    expect([...region.querySelectorAll(".bm-compare")].map((panel) => panel.dataset.benchmark)).toEqual([
      "uc_health_no_work_requirements",
      "uc_health_element_16_24",
      "young_pip_recipients",
      "pip_spend_16_24",
      "uc_health_spend_16_24",
      "employer_nics_under_25",
    ]);
    expect(screen.getByText("£4.65bn a year").closest("li").textContent).toContain("PolicyEngine is 8.82% lower");
    // A pair that counts different things says so, with no gap between the two
    for (const [published, difference] of [
      ["£4.68bn a year", "a saving in 2029-30 against spending in 2025-26"],
      ["£1.13bn a year", "a saving in 2029-30 against spending in 2025-26"],
      ["260,000", "benefit units against people"],
      ["176,000", "benefit units against people"],
      ["450,000", "ours leaves out 16 and 17-year-olds"],
    ]) {
      const panel = screen.getByText(published).closest("li");
      expect(panel.textContent, published).toContain(`Not like for like: ${difference}`);
      expect(panel.textContent, published).not.toMatch(/PolicyEngine is|% (higher|lower)/);
    }
    // Every other figure is a stat tile under its theme, once, with its source and date
    expect([...region.querySelectorAll(".bm-tile")].map((tile) => tile.dataset.benchmark)).toEqual([
      "neet_16_24",
      "neet_rate_projection_2036",
      "incapacity_benefits_young",
      "dla_pip_16_24",
      "into_sustained_work_2036",
      "package_young_people_affected",
      "young_benefits_spend",
      "review_welfare_saving_2036",
      "milburn_welfare_saving_10y",
      "review_investment_2036",
      "youth_hiring_incentives_cost",
      "incapacity_spending_18_24",
      "relative_poverty_review",
      "kept_out_of_poverty",
      "pip_no_extra_costs",
    ]);
    // The review's own figures link to the review, with its date
    const saving = screen.getByText("£13.7bn by 2036-37").closest("li");
    expect(within(saving).getByRole("link", { name: /From a Welfare State to a Working State/ })).toHaveAttribute(
      "href",
      expect.stringContaining("gov.uk/government/publications/from-a-welfare-state-to-a-working-state"),
    );
    expect(saving.textContent).toContain("17 November 2026");
    // A figure on another basis is a tile with the PolicyEngine range beside it, not a gap
    const annual = screen.getByText("£3.6bn in 2036-37").closest("li");
    expect(annual.textContent).toContain("£2.64bn to £4.67bn a year");
    expect(annual.textContent).not.toContain("PolicyEngine is");
    const poverty = screen.getByText("50,000 fewer").closest("li");
    expect(poverty.textContent).toContain("260,000 more");
    // The page's notes are folded away
    expect(screen.getByText("About these figures").closest("details")).not.toHaveAttribute("open");
    // Rows without a source are gone, and no link carries a stray %20 or points elsewhere than its label
    expect(screen.queryByText(/465,000/)).toBeNull();
    expect(screen.queryByText(/62,570/)).toBeNull();
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
