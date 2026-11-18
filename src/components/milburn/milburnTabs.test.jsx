import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const fixture = readFileSync(join(__dirname, "..", "..", "test", "fixtures", "milburn", "milburn_scenarios.json"), "utf8");
const reviewFigures = readFileSync(join(__dirname, "..", "..", "..", "public", "data", "milburn_review_figures.json"), "utf8");

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

afterEach(() => {
  vi.unstubAllGlobals();
  state.ageRows = null;
  state.budgetRows = null;
  state.measureRows = null;
});

const summaryText = readFileSync(join(__dirname, "..", "..", "test", "fixtures", "milburn", "summary", "milburn_summary.json"), "utf8");
const entryText = readFileSync(join(__dirname, "..", "..", "test", "fixtures", "milburn", "milburn_entry_path.json"), "utf8");

/** Serves the scenarios, summary, entry path and review figures files, each missing when null. */
const serve = ({ scenarios = fixture, summary = summaryText, review = reviewFigures, entry = entryText } = {}) =>
  vi.fn(async (url) => {
    const path = String(url);
    const body = path.endsWith("milburn_summary.json")
      ? summary
      : path.endsWith("milburn_review_figures.json")
        ? review
        : path.endsWith("milburn_entry_path.json")
          ? entry
          : scenarios;
    return body === null ? { ok: false, status: 404, json: async () => null } : { ok: true, status: 200, json: async () => JSON.parse(body) };
  });

const publishedEntry = readFileSync(join(__dirname, "..", "..", "..", "public", "data", "milburn_entry_path.json"), "utf8");
const publishedScenarios = readFileSync(join(__dirname, "..", "..", "..", "public", "data", "milburn_scenarios.json"), "utf8");

// The published files, not the fixture: a crash on real data (c48f71da) is caught here
describe("Moves into work on the published files", () => {
  it.each([2027, 2029, 2031])("renders the tab and its entry-path cards in %i", async (year) => {
    vi.stubGlobal("fetch", serve({ entry: publishedEntry, scenarios: publishedScenarios }));
    const { default: BehaviouralScenarios } = await import("./BehaviouralScenarios");
    const { EntryShares, EntryYear } = await import("./EntryPathCards");
    const { parseEntryPath } = await import("../../utils/milburn/entryPath");
    const label = `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
    render(<BehaviouralScenarios year={year} />);
    expect(await screen.findByRole("region", { name: "Share assumed in work, by year" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: `Static and with the assumed move into work, ${label}` })).toBeInTheDocument();
    const review = await screen.findByRole("region", { name: "Beside the review's own estimate" });
    const ours = review.querySelector('[data-side="ours"] .milburn-versus-figure').textContent;
    if (year < 2029) expect(ours).toBe("None: the changes start in April 2029");
    else expect(ours).toMatch(/^About \d/);
    expect(review.textContent).not.toContain("Not yet run");
    // The cards alone, on the parsed file
    const data = parseEntryPath(JSON.parse(publishedEntry));
    const { container } = render(
      <>
        <EntryShares data={data} />
        <EntryYear data={data} year={year} />
      </>,
    );
    expect(container.querySelector("[data-entry-shares]")).not.toBeNull();
    if (year >= 2029) {
      const change = [...container.querySelector('tr[data-row="change_exchequer"]').children].map((cell) => cell.textContent);
      // The flat path's change, in £m: visible where £bn to two places is not
      expect(change[3]).toMatch(/^\+£\d+\.\dm$/);
    }
  });
});

describe("Moves into work (illustrative)", () => {
  it("leads with the share assumed in work by year and the selected year's figures, then the entry cases and the break-even arithmetic", async () => {
    vi.stubGlobal("fetch", serve());
    const { default: BehaviouralScenarios } = await import("./BehaviouralScenarios");
    render(<BehaviouralScenarios year={2029} />);
    const shares = await screen.findByRole("region", { name: "Share assumed in work, by year" });
    const year = screen.getByRole("region", { name: "Static and with the assumed move into work, 2029-30" });
    expect(await screen.findByRole("region", { name: "One young person moving into work" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Break-even arithmetic" })).toBeInTheDocument();
    expect(screen.queryByRole("slider")).toBeNull();
    const tab = screen.getByRole("heading", { name: "Moves into work (illustrative)" }).closest(".milburn-scenarios");
    // in one line: the assumption and the link; the tab follows the year selector
    expect(tab.querySelector(".milburn-assumption").textContent).toBe(
      "Assumes a share of non-working 18 to 24-year-olds whose Universal Credit health element the package removes take 16 hours a week at the minimum wage for their age: none before April 2029, then a phased share rising to 4.4% by 2031-32, or 9% with no ramp · Why this path",
    );
    expect(tab.querySelector("[data-year-only]")).toBeNull();
    expect(screen.getByRole("link", { name: "Why this path" })).toHaveAttribute("href", "?tab=methodology#method-behavioural-scenarios");
    // Shares and people by year, with the review's NEET gap beside them
    const row2029 = [...shares.querySelector('[data-entry-shares] tr[data-year="2029"]').children].map((cell) => cell.textContent);
    // The rollout path: its movers over the whole group, then its 9% of those reached
    expect(row2029).toEqual(["2029-30", "1.3% (about 1,000)", "9.0% (about 9,000)", "1.3% (about 4,000)", "4.0% (about 4,000); 9.0% of those reached", "1.7pp"]);
    expect(shares.querySelector('[data-entry-shares] tr[data-year="2028"]').textContent).toBe("2028-290%0%0%0%0.9pp");
    // The 9%'s reading, the pairing and the review's 440,000 are said, as ours and theirs
    const notes = shares.querySelector("[data-entry-path-notes]").textContent;
    expect(notes).toContain("read here as 9 percentage points; the annex does not say whether it is points or per cent");
    expect(notes).toContain("That pairing is ours");
    expect(shares.querySelector("[data-review-caveat]").textContent).toContain("The review gives no figure for the benefit changes on their own");
    // The year's table: static and each path; a withheld figure says so, never zero
    const cells = (key) => [...year.querySelector(`tr[data-row="${key}"]`).children].map((cell) => cell.textContent);
    expect(cells("exchequer")).toEqual(["Exchequer saving", "£4.00bn", "£4.01bn", "£4.09bn", "£4.02bn", "£2.04bn"]);
    expect(cells("povertyAbs")[4]).toBe("Withheld");
    expect(cells("povertyAbs")[1]).toBe("+1.00pp (+700,000)");
    expect(year.querySelector("[data-entry-run-comparison]").textContent).toContain("arithmetic on two runs");
    expect(year.querySelector("[data-entry-run-comparison]").textContent).toContain("the fall in their benefits and any tax on their earnings");
    expect(tab.textContent).not.toMatch(/25% move into work|chosen at random|Why 25%/);
    // The entry cases from the file: 16 hours at £10 an hour
    const cases = screen.getByRole("region", { name: "One young person moving into work" });
    expect(within(cases).getAllByRole("row")[1].textContent).toBe("16 hours£10.00£1,000; £2,000£3,000; £4,000");
  });

  it("says there is no change before April 2029 rather than showing zeros", async () => {
    vi.stubGlobal("fetch", serve());
    const { default: BehaviouralScenarios } = await import("./BehaviouralScenarios");
    render(<BehaviouralScenarios year={2027} />);
    const year = await screen.findByRole("region", { name: "Static and with the assumed move into work, 2027-28" });
    expect(year.querySelector("[data-no-change]").textContent).toMatch(/^No change before April 2029/);
    expect(year.querySelector("table")).toBeNull();
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
    render(<BehaviouralScenarios year={2029} />);
    const section = await screen.findByRole("region", { name: REVIEW_COMPARISON_TITLE });
    // The review's figures come from the published file, never from the component
    const published = JSON.parse(reviewFigures);
    expect(published.employment.people).toBe(440000);
    expect(published.employment.by_year).toBe(2036);
    const row = (key) => [...section.querySelector(`tr[data-row="${key}"]`).children].map((cell) => cell.textContent);
    // The fixture's phased path moves about 1,000 people in 2029-30
    // Ours is labelled as following from the assumed share, not as an estimate
    expect(row("people")).toEqual(["People moving into work", "About 1,000, assumed (1.3% of the group), not estimated", "About 440,000"]);
    expect(row("when")).toEqual(["When", "2029-30", "By 2036"]);
    expect(row("who")[1]).toBe("1.3% of non-working 18 to 24-year-olds whose Universal Credit health element the package removes");
    expect(row("method")[1]).toBe("Microsimulation with an assumed move into work; the entry rate is assumed for illustration, not estimated");
    expect(row("method")[2]).toBe(published.employment.method);
    expect(row("work")[2]).toBe(published.employment.hours);
    expect(row("neet")).toEqual(["NEET rate, 16 to 24-year-olds", "Not modelled", "13.1% in 2026/27 to 6.8% in 2036/37; 13.4% in 2036/37 without the reforms; the review’s ambition is around 5%"]);
    // Two cards say whose figure each is: ours an assumption, the review's published
    const card = (side) => section.querySelector(`.milburn-versus-card[data-side="${side}"]`);
    expect(card("ours").querySelector("h4").textContent).toBe("PolicyEngine: assumed phased move into work");
    expect(card("ours").querySelector(".milburn-versus-caption").textContent).toBe("people assumed to move into work in 2029-30: an assumed 1.3%, not an estimate");
    // Ours carries no chip (its title names PolicyEngine); the published one keeps its source label
    expect(card("ours").querySelector("[data-source-kind]")).toBeNull();
    expect(card("ours").querySelector(".milburn-versus-figure").textContent).toBe("About 1,000");
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
    // Its one line under the title says the two are different exercises, ours an assumed share
    expect(section.querySelector(".chart-description").textContent).toBe("Different exercises, not a check on each other: ours assumes 1.3% move into work in 2029-30.");
    // No source line in view: the table and the full citation, with its link, are folded away
    expect(section.querySelector("[data-review-source-short]")).toBeNull();
    expect(section.textContent).not.toContain("Source: the review");
    expect(within(section.querySelector("details[data-review-more] [data-review-source]")).getAllByRole("link")[0]).toHaveAttribute("href", published.report.url);
    expect(section.querySelector("details[data-full-comparison] > summary").textContent).toBe("Full comparison");
    expect(section.querySelector("details[data-full-comparison] table")).not.toBeNull();
    expect(section.querySelector("details[data-review-more] > summary").textContent).toBe("More info");
    expect(section.querySelector("details[data-review-more] [data-review-source]").textContent).toMatch(/^Source for the review’s figures: /);
    // Two exercises, neither called right (the full sentence is in the card's CSV units line)
    expect(section.textContent).toContain("Different exercises, not a check on each other");
    expect(DIFFERENT_EXERCISES_SENTENCE).toMatch(/neither figure is a check on the other/);
    // The card's CSV keeps the full sentence in its units line
    const blobs = [];
    const createUrl = vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      blobs.push(blob);
      return "blob:review";
    });
    const revokeUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clickLink = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    fireEvent.click(section.querySelector(".chart-download-button"));
    fireEvent.click(section.querySelector('[data-format="csv"]'));
    await waitFor(() => expect(blobs).toHaveLength(1));
    const text = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsText(blobs[0]);
    });
    const units = text.split("\r\n")[1];
    expect(units).toContain(DIFFERENT_EXERCISES_SENTENCE);
    createUrl.mockRestore();
    revokeUrl.mockRestore();
    clickLink.mockRestore();
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
    withSingle.runs.push({ ...withSingle.runs.find((run) => run.id === "milburn_report_package"), id: "one_measure_alone" });
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
    // The review's published wording stays in the scenario's caveat; nothing read from the missing file shows
    expect(document.body.textContent).not.toMatch(/Review.s own estimate|About 440,000/);
  });

  it("shows unavailable states, never zeros, when the files are missing", async () => {
    vi.stubGlobal("fetch", serve({ scenarios: null, summary: null, entry: null }));
    const { default: BehaviouralScenarios } = await import("./BehaviouralScenarios");
    render(<BehaviouralScenarios />);
    expect(await screen.findByText(/entry cases are not available/)).toBeInTheDocument();
    expect(await screen.findByText(/scenario is not available/)).toBeInTheDocument();
    expect(screen.queryByText(/£0/)).toBeNull();
  });
});
