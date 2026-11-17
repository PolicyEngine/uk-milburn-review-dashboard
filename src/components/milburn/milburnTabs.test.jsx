import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";

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

describe("Moves into work (illustrative)", () => {
  it("leads with the microsimulated entry run, then the entry cases and the break-even arithmetic, with no slider", async () => {
    vi.stubGlobal("fetch", serve());
    const { default: BehaviouralScenarios } = await import("./BehaviouralScenarios");
    render(<BehaviouralScenarios />);
    expect(await screen.findByRole("region", { name: "With a quarter moving into work" })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "One young person moving into work" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Break-even arithmetic" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Moves into work (illustrative)" })).toBeInTheDocument();
    expect(screen.queryByRole("slider")).toBeNull();
    // The assumption names the group that moves, and the tab says its figures are for one year
    const tab = screen.getByRole("heading", { name: "Moves into work (illustrative)" }).closest(".milburn-scenarios");
    // in one line: the assumption, the year, the link
    expect(tab.querySelector(".milburn-assumption").textContent).toBe(
      "Assumes 25% of non-working 18 to 24-year-olds with PIP or the health element take 16 hours’ work at their minimum wage · 2027-28 only · Why 25%",
    );
    expect(tab.querySelector("[data-year-only]").textContent).toBe("2027-28 only");
    expect(tab.querySelector("[data-year-only]")).toHaveAttribute("title", "2027-28 only: the year selector does not change this tab.");
    expect(tab.querySelectorAll("[data-year-only]")).toHaveLength(1);
    // The assumption links to the Methodology passage that explains the 25%
    expect(screen.getByRole("link", { name: "Why 25%" })).toHaveAttribute("href", "?tab=methodology#method-behavioural-scenarios");
    // Said once on the tab, each in a folded section: the same gain under both laws; the short break-even line
    const sameGain = [...tab.querySelectorAll("[data-same-gain]")];
    expect(sameGain.every((node) => node.closest("details[data-case-more]"))).toBe(true);
    expect(tab.querySelector("details[data-case-more] > summary")?.textContent ?? "More info").toBe("More info");
    expect(screen.getByRole("region", { name: "Break-even arithmetic" }).textContent).toContain(
      "How many young people would need to move into work to match the 2027-28 saving; the gain per entrant is a 2027-28 figure.",
    );
    expect(tab.textContent).not.toMatch(/young people who lose|leaves worse off|Why the effect is small|not a new incentive|not reachable/);
    // The entry cases from the file: 16 hours at £10 an hour
    const cases = screen.getByRole("region", { name: "One young person moving into work" });
    expect(within(cases).getAllByRole("row")[1].textContent).toBe("16 hours£10.00£1,000; £2,000£3,000; £4,000");
  });

  it("says, visibly, which year the gain per entrant is for: the entry cases' own", async () => {
    // The saving is the summary's year; the gain from work is the scenarios file's
    vi.stubGlobal("fetch", serve({ scenarios: JSON.stringify({ ...JSON.parse(fixture), year: 2026 }) }));
    const { default: BehaviouralScenarios } = await import("./BehaviouralScenarios");
    render(<BehaviouralScenarios />);
    const region = await screen.findByRole("region", { name: "Break-even arithmetic" });
    await waitFor(() => expect(region.textContent).toContain("match the 2027-28 saving; the gain per entrant is a 2026-27 figure."));
    expect(within(region).getByRole("columnheader", { name: "Exchequer gain per entrant, £ a year, 2026-27" })).toBeInTheDocument();
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
    // Ours is labelled as following from the assumed share, not as an estimate
    expect(row("people")).toEqual(["People moving into work", "About 70,000, assumed (25% of the group), not estimated", "About 440,000"]);
    expect(row("when")).toEqual(["When", "2027-28", "By 2036"]);
    expect(row("who")[1]).toBe("25% of non-working 18 to 24-year-olds with PIP or the health element, chosen at random");
    expect(row("method")[1]).toBe("Microsimulation with an assumed move into work; the entry rate is assumed for illustration, not estimated");
    expect(row("method")[2]).toBe(published.employment.method);
    expect(row("work")[2]).toBe(published.employment.hours);
    expect(row("neet")).toEqual(["NEET rate, 16 to 24-year-olds", "Not modelled", "13.1% in 2026/27 to 6.8% in 2036/37; 13.4% in 2036/37 without the reforms; the review’s ambition is around 5%"]);
    // Two cards say whose figure each is: ours an assumption, the review's published
    const card = (side) => section.querySelector(`.milburn-versus-card[data-side="${side}"]`);
    expect(card("ours").querySelector("h4").textContent).toBe("PolicyEngine: assumed move into work (25%)");
    expect(card("ours").querySelector(".milburn-versus-caption").textContent).toBe("people assumed to move into work: an assumed 25%, not an estimate");
    // Ours carries no chip (its title names PolicyEngine); the published one keeps its source label
    expect(card("ours").querySelector("[data-source-kind]")).toBeNull();
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
    // No bars on one axis: an assumed figure is not drawn against the review's estimate
    expect(section.querySelector("[data-single-chart]")).toBeNull();
    expect(section.querySelector("[role=img]")).toBeNull();
    expect(section.textContent).toContain("not drawn on one scale");
    // No source line in view: the table and the full citation, with its link, are folded away
    expect(section.querySelector("[data-review-source-short]")).toBeNull();
    expect(section.textContent).not.toContain("Source: the review");
    expect(within(section.querySelector("details[data-review-more] [data-review-source]")).getAllByRole("link")[0]).toHaveAttribute("href", published.report.url);
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
    // The break-even chart does not draw the review's figure (a different quantity); its notes name it, as the review's and for 2036
    const breakEven = screen.getByRole("region", { name: "Break-even arithmetic" });
    expect(breakEven.querySelector("[data-review-line]").textContent).toContain("Review's own estimate, into work by 2036: 440,000");
    expect(breakEven.querySelector("[data-review-line]").textContent).toMatch(/not drawn on the chart: the entrants needed are for 2027-28/);
    expect([...breakEven.querySelectorAll("svg text")].map((node) => node.textContent).join(" ")).not.toContain("440,000");
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
    const card = (id) => document.querySelector(`[data-benchmark="${id}"]`);
    // A figure's number is large, its qualifier small beside it
    expect(card("milburn_welfare_saving_10y").querySelector(".bm-value").textContent).toBe("£13.7bn by 2036-37");
    expect(card("milburn_welfare_saving_10y").querySelector(".bm-value-main").textContent).toBe("£13.7bn");
    expect(card("milburn_welfare_saving_10y").querySelector(".bm-qualifier").textContent).toBe("by 2036-37");
    // The old notice is gone: nothing above the first section
    expect(screen.queryByText(/PolicyEngine estimates are context, not a check/)).toBeNull();
    // Every figure now cites its own publication: none is a press report
    expect(within(screen.getByRole("region", { name: "Benchmarks" })).queryByText("Press report")).toBeNull();
    for (const link of within(screen.getByRole("region", { name: "Benchmarks" })).getAllByRole("link")) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    // Each figure says whose it is: "Published", or "PolicyEngine estimate"
    const kinds = new Set([...document.querySelectorAll(".bm-kicker")].map((label) => label.textContent.trim().replace(/, \d{4}-\d{2}$/, "")));
    expect([...kinds].sort()).toEqual(["PolicyEngine estimate", "Published"]);
    // The package's estimate from its own run
    expect(screen.getByText("100,000")).toBeInTheDocument();
    expect(screen.queryByText("30,000")).toBeNull();
    // Fixed PolicyEngine figures beside the published ones, each saying what ours is; the build id is in the folded notes, once
    for (const [published, estimate, ours] of [
      ["450,000", "406,919", "Ours: 2025"],
      ["176,000", "233,407", "Ours: 2025"],
      ["£5.1bn a year", "£5.85bn a year", "Ours: 2025-26, cash terms"],
    ]) {
      const row = screen.getByText(published).closest("li");
      expect(row.textContent).toContain(estimate);
      expect(row.querySelector(".bm-ours").textContent).toBe(ours);
      expect(row.textContent).not.toContain("build fcfac709");
    }
    const about = screen.getByText("About these figures").closest("details");
    expect(about.textContent).toContain("Builds: PolicyEngine, build fcfac709, 2025; PolicyEngine, build fcfac709, 2025, cash terms; PolicyEngine, build fcfac709, 2025-26, cash terms.");
    expect(document.querySelectorAll(".bm-group [data-benchmark]").length).toBeGreaterThan(0);
    for (const each of document.querySelectorAll(".bm-group [data-benchmark]")) expect(each.textContent, each.dataset.benchmark).not.toContain("build fcfac709");
    // Each card has one source chip (source and date) and at most one note; none repeats the source
    for (const each of document.querySelectorAll(".bm-group [data-benchmark]")) {
      expect(each.querySelectorAll("[data-source-link]").length, each.dataset.benchmark).toBe(each.dataset.benchmark === "package_young_people_affected" ? 0 : 1);
      expect(each.querySelectorAll(".bm-note").length, each.dataset.benchmark).toBeLessThanOrEqual(1);
      expect(each.querySelector(".bm-note")?.textContent ?? "", each.dataset.benchmark).not.toMatch(/^(Resolution Foundation|IFS|The review's (own )?(count|figure))/);
    }
    // Sections are named for the question each answers, each with one line under it
    expect([...document.querySelectorAll(".bm-group")].map((group) => [group.dataset.section, group.querySelector("h3").textContent])).toEqual([
      ["caseloads", "How do our caseloads compare?"],
      ["spending", "How does our spending compare?"],
      ["review", "The review's own estimates"],
      ["poverty", "Poverty"],
      ["context", "Context from the review"],
    ]);
    for (const group of document.querySelectorAll(".bm-group")) expect(group.querySelector(".bm-group-head p").textContent).toBeTruthy();
    // Each comparable pair is a comparison panel with its gap as a % of the published figure, to the nearest whole per cent
    const region = screen.getByRole("region", { name: "Benchmarks" });
    expect([...region.querySelectorAll(".bm-compare")].map((panel) => panel.dataset.benchmark)).toEqual([
      "uc_health_element_16_24",
      "young_pip_recipients",
      "pip_spend_16_24",
      "uc_health_spend_16_24",
      "young_benefits_spend",
      "employer_nics_under_25",
    ]);
    for (const [id, gap] of [
      ["uc_health_element_16_24", "PolicyEngine is 33% higher"],
      ["pip_spend_16_24", "PolicyEngine is 14% lower"],
      ["uc_health_spend_16_24", "PolicyEngine is 28% higher"],
      ["young_benefits_spend", "Close: PolicyEngine is 6% lower"],
      ["employer_nics_under_25", "PolicyEngine is 15% higher"],
    ]) {
      expect(card(id).querySelector(".bm-verdict").textContent, id).toBe(gap);
      // Why the two differ, said on the card
      expect(card(id).querySelector("[data-gap-note]").textContent, id).toBeTruthy();
    }
    // No two-decimal gap anywhere
    expect(region.textContent).not.toMatch(/\d\.\d\d% (higher|lower)/);
    expect(region.textContent).not.toContain("8.82%");
    // A pair that still counts different things says so, with no gap between the two
    const pip = card("young_pip_recipients");
    expect(pip.textContent).toContain("Not like for like: ours is England and Wales in 2025; the published figure is current, for November 2026");
    expect(pip.textContent).not.toMatch(/PolicyEngine is|% (higher|lower)/);
    expect(pip.querySelector("[data-gap-note]").textContent).toContain("407,505");
    // Our savings are shown apart and labelled as savings; the employer NI figure as a net cost
    expect(card("pip_spend_16_24").querySelector("[data-separate]").textContent).toBe("Our saving from removing PIP at 16 to 24, 2029-30, cash terms: £4.68bn a year");
    expect(card("uc_health_spend_16_24").querySelector("[data-separate]").textContent).toBe("Our saving from removing it for under-25s, 2029-30, cash terms: £1.13bn a year");
    expect(card("young_benefits_spend").querySelector("[data-separate]").textContent).toBe("Our saving from removing them, 2029-30, cash terms: £4.67bn a year");
    expect(card("employer_nics_under_25").querySelector("[data-separate]").textContent).toBe("Our net cost, 2029-30, cash terms: £4.65bn a year");
    // Every other figure is a stat tile under its section, once, with its source and date
    expect([...region.querySelectorAll(".bm-tile")].map((tile) => tile.dataset.benchmark)).toEqual([
      "uc_health_no_work_requirements",
      "package_young_people_affected",
      "review_welfare_saving_2036",
      "milburn_welfare_saving_10y",
      "relative_poverty_review",
      "kept_out_of_poverty",
      "pip_no_extra_costs",
      "neet_16_24",
      "neet_rate_projection_2036",
      "incapacity_benefits_young",
      "dla_pip_16_24",
      "into_sustained_work_2036",
      "review_investment_2036",
      "youth_hiring_incentives_cost",
      "incapacity_spending_18_24",
    ]);
    // The RF figure with no published basis says so, with no PolicyEngine figure
    expect(card("uc_health_no_work_requirements").querySelector(".bm-note").textContent).toMatch(/^Basis not published/);
    expect(card("uc_health_no_work_requirements").querySelector(".is-estimate")).toBeNull();
    // Every row of the file is on the page once
    expect(region.querySelectorAll("[data-benchmark]").length).toBe(JSON.parse(benchmarks).rows.length);
    // The review's own figures link to the review, with its date
    const saving = card("milburn_welfare_saving_10y");
    expect(within(saving).getByRole("link", { name: /Review · 17 Nov 2026/ })).toHaveAttribute(
      "href",
      expect.stringContaining("gov.uk/government/publications/from-a-welfare-state-to-a-working-state"),
    );
    // The chip is short; the full title is the link's tooltip
    expect(within(saving).getByRole("link")).toHaveAttribute("title", "From a Welfare State to a Working State");
    // The review's own estimates are tiles with no PolicyEngine figure beside them
    const annual = card("review_welfare_saving_2036");
    expect(annual.querySelector(".bm-value").textContent).toBe("£3.6bn in 2036-37");
    expect(annual.textContent).not.toContain("£2.64bn to £4.67bn a year");
    expect(annual.querySelector(".is-estimate")).toBeNull();
    const poverty = screen.getByText("50,000 fewer").closest("li");
    expect(poverty.textContent).not.toContain("260,000 more");
    expect(poverty.querySelector(".is-estimate")).toBeNull();
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
