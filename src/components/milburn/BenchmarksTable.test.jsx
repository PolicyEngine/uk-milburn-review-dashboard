import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { BENCHMARK_GRAPHICS, BENCHMARK_SECTIONS, BENCHMARK_SHORT, BENCHMARK_TOPICS, benchmarkGroups, parseBenchmarks, topicFromSearch } from "../../utils/milburn/benchmarks";

const benchmarks = readFileSync(join(__dirname, "..", "..", "..", "public", "data", "milburn_benchmarks.json"), "utf8");
const file = parseBenchmarks(JSON.parse(benchmarks));

const state = vi.hoisted(() => ({ ageRows: null, measureRows: null, catalogue: { combinedId: null } }));

vi.mock("../YoungPeopleSection", () => ({
  useAgeImpactRows: () => (state.measureRows ? { status: "ready", rows: state.measureRows } : { status: "unavailable", rows: null }),
}));
vi.mock("../../utils/milburn/packageRun", () => ({
  usePackageTable: () => (state.ageRows ? { key: "combined--pkg", status: "ready", rows: state.ageRows } : { key: "combined--pkg", status: "unavailable", rows: null }),
}));
vi.mock("../../utils/measureCatalogue", () => ({
  useMeasureCatalogue: () => state.catalogue,
}));

const respond = (body) =>
  vi.fn(async () => (body === null ? { ok: false, status: 404, json: async () => null } : { ok: true, status: 200, json: async () => JSON.parse(body) }));

afterEach(() => {
  vi.unstubAllGlobals();
  state.ageRows = null;
  state.measureRows = null;
  window.history.replaceState({}, "", "/");
});

// The benchmarks file's year (policyengine_estimate_year), 2029-30
const youngRow = { reform_id: "combined--pkg", year: "2029", age_band: "16-24", people: "1000000", pct_worse_off: "10" };

async function renderTab() {
  vi.stubGlobal("fetch", respond(benchmarks));
  state.ageRows = [youngRow];
  const { default: BenchmarksTable } = await import("./BenchmarksTable");
  render(<BenchmarksTable />);
  await screen.findByRole("region", { name: "Benchmarks" });
  return screen.getByRole("region", { name: "Benchmarks" });
}

const card = (id) => document.querySelector(`[data-benchmark="${id}"]`);

/** Open a card's More info and return its content. */
function openMoreInfo(id) {
  const toggle = within(card(id)).getByRole("button", { name: "More info" });
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  return card(id).querySelector(".disclosure-content");
}

describe("Benchmarks layout", () => {
  it("has no hero chart: the topic filter and the all-figures download come first", async () => {
    const region = await renderTab();
    expect(region.querySelector(".bm-hero")).toBeNull();
    expect(screen.queryByRole("heading", { name: "How close are our estimates?" })).toBeNull();
    expect(region.firstElementChild).toHaveClass("bm-toolbar");
    expect(within(region.querySelector(".bm-toolbar")).getByRole("button", { name: /Download the benchmarks/ })).toBeInTheDocument();
    expect(region.textContent).not.toMatch(/\d\.\d\d%/);
  });

  it("builds every card the same way: a flex column, title first, the foot last", async () => {
    const region = await renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Show all 13 figures" }));
    for (const grid of region.querySelectorAll(".bm-cards")) {
      // One grid a section, every child a card
      expect([...grid.children].every((child) => child.matches("li.bm-card"))).toBe(true);
    }
    for (const each of region.querySelectorAll(".bm-card")) {
      const id = each.dataset.benchmark;
      expect(each.firstElementChild.tagName, id).toBe("H4");
      expect(each.lastElementChild, id).toHaveClass("bm-foot");
      // At most one line of words besides the title and figures (the gap or a flag), and the 15% verdict
      expect(each.querySelectorAll(".bm-gap:not(.bm-tolerance)").length, id).toBeLessThanOrEqual(1);
      expect(each.querySelectorAll(".bm-tolerance").length, id).toBeLessThanOrEqual(1);
      expect(each.querySelector(".disclosure-preview"), id).toBeNull();
    }
    const css = readFileSync(join(__dirname, "BenchmarksTable.css"), "utf8");
    expect(css).toMatch(/\.bm-cards \{[^}]*align-items: stretch;/);
    expect(css).toMatch(/grid-auto-rows: 1fr;/);
    expect(css).toMatch(/\.bm-card \{[^}]*display: flex;[^}]*flex-direction: column;/);
    expect(css).toMatch(/\.bm-foot \{[^}]*margin-top: auto;/);
  });

  it("keeps titles and section introductions short", () => {
    for (const [id, short] of Object.entries(BENCHMARK_SHORT)) {
      expect(short.label.length, id).toBeLessThanOrEqual(40);
      expect(short.label, id).not.toMatch(/the review (says|estimates|expects|projects)/);
    }
    for (const section of BENCHMARK_SECTIONS) {
      expect(section.intro.length, section.key).toBeLessThanOrEqual(90);
      expect(section.intro.split(/[.;] /).length, section.key).toBe(1);
    }
  });
});

describe("Benchmarks topic filter", () => {
  it("shows one topic's sections, pressed state and address kept in step", async () => {
    await renderTab();
    const filter = screen.getByRole("group", { name: "Show figures on" });
    expect(within(filter).getAllByRole("button").map((button) => button.dataset.topic)).toEqual(BENCHMARK_TOPICS.map((topic) => topic.key));
    expect(within(filter).getByRole("button", { name: /^All/ })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelectorAll(".bm-group").length).toBe(6);
    fireEvent.click(within(filter).getByRole("button", { name: /^Spending/ }));
    expect(within(filter).getByRole("button", { name: /^Spending/ })).toHaveAttribute("aria-pressed", "true");
    expect([...document.querySelectorAll(".bm-group")].map((group) => group.dataset.section)).toEqual(["spending"]);
    expect(new URLSearchParams(window.location.search).get("bm")).toBe("spending");
    fireEvent.click(within(filter).getByRole("button", { name: /^All/ }));
    expect(new URLSearchParams(window.location.search).has("bm")).toBe(false);
  });

  it("picks out the cards with a PolicyEngine figure, across sections (issue #6, item 9)", async () => {
    await renderTab();
    const filter = screen.getByRole("group", { name: "Show figures on" });
    const ours = within(filter).getByRole("button", { name: /^With a PolicyEngine figure/ });
    const withOurs = file.rows.filter((row) => row.estimate);
    expect(ours.querySelector(".bm-filter-count").textContent).toBe(String(withOurs.length));
    fireEvent.click(ours);
    expect(ours).toHaveAttribute("aria-pressed", "true");
    expect(new URLSearchParams(window.location.search).get("bm")).toBe("ours");
    expect([...document.querySelectorAll("[data-benchmark]")].map((card) => card.dataset.benchmark).sort()).toEqual(withOurs.map((row) => row.id).sort());
    expect([...document.querySelectorAll(".bm-group")].map((group) => group.dataset.section)).toEqual(["caseloads", "spending"]);
    fireEvent.click(within(filter).getByRole("button", { name: /^All/ }));
  });

  it("opens on the address's topic and ignores one it does not know", async () => {
    expect(topicFromSearch("?bm=context")).toBe("context");
    expect(topicFromSearch("?bm=nonsense")).toBe("all");
    window.history.replaceState({}, "", "/?sub=benchmarks&bm=review");
    await renderTab();
    await waitFor(() => expect([...document.querySelectorAll(".bm-group")].map((group) => group.dataset.section)).toEqual(["review"]));
  });

  it("folds the context figures past eight behind Show all", async () => {
    await renderTab();
    const context = document.querySelector('[data-section="context"]');
    expect(context.querySelectorAll("[data-benchmark]").length).toBe(8);
    fireEvent.click(within(context).getByRole("button", { name: "Show all 13 figures" }));
    expect(context.querySelectorAll("[data-benchmark]").length).toBe(13);
    expect(within(context).getByRole("button", { name: "Show fewer" })).toHaveAttribute("aria-expanded", "true");
  });
});

describe("Benchmarks cards", () => {
  it("keeps the face to title, figures, gap, bars and source; the rest in More info", async () => {
    const region = await renderTab();
    expect([...region.querySelectorAll(".bm-compare")].map((panel) => panel.dataset.benchmark)).toEqual([
      "uc_health_element_16_24",
      "uc_health_pip_overlap",
      "young_pip_recipients",
      "pip_spend_16_24",
      "uc_health_spend_16_24",
      "young_benefits_spend",
      "employer_nics_under_25",
    ]);
    for (const [id, gap] of [
      ["uc_health_element_16_24", "Ours 33% higher"],
      // A share differs in percentage points, never as a % of a %
      ["uc_health_pip_overlap", "Ours 28.1pp higher"],
      ["pip_spend_16_24", "Ours 14% lower"],
      ["uc_health_spend_16_24", "Ours 28% higher"],
      ["young_benefits_spend", "Ours 6% lower"],
      ["employer_nics_under_25", "Ours 15% higher"],
    ]) {
      expect(card(id).querySelector("[data-gap]").textContent, id).toBe(gap);
      // The long notes are not on the face
      const row = file.rows.find((each) => each.id === id);
      expect(card(id).textContent, id).not.toContain(row.estimate.note.slice(0, 40));
      expect(card(id).textContent, id).not.toContain("build fcfac709");
      expect(card(id).querySelectorAll("[data-source-link]").length, id).toBe(1);
      expect(card(id).querySelectorAll(".bm-bar").length, id).toBe(2);
    }
    const pip = card("young_pip_recipients");
    expect(pip.querySelector("[data-different-basis]").textContent).toBe("Not like for like");
    expect(pip.textContent).not.toMatch(/Ours \d+% (higher|lower)/);
    // The 15% tolerance: tested only against a matched figure (DWP's count), else marked untested
    expect(pip.querySelector("[data-tolerance]").dataset.tolerance).toBe("within");
    expect(pip.querySelector("[data-tolerance]").textContent).toBe("Within 15% of DWP's 2025 count");
    for (const id of ["uc_health_element_16_24", "uc_health_pip_overlap", "pip_spend_16_24", "uc_health_spend_16_24", "young_benefits_spend", "employer_nics_under_25"]) {
      expect(card(id).querySelector("[data-tolerance]").dataset.tolerance, id).toBe("untested");
    }
  });

  it("holds why they differ, both bases, our build and saving in More info; the source only in the foot", async () => {
    await renderTab();
    const info = openMoreInfo("pip_spend_16_24");
    expect(info.textContent).toContain("Why they differ");
    expect(info.textContent).toContain("Why ours is lower: the caseload matches DWP's 2025 count");
    expect(info.textContent).toContain("Published: £3.8bn a year; £1.3bn in 2019-20, forecast at £8.1bn in 2036-37.");
    expect(info.textContent).toContain("PolicyEngine, build fcfac709, 2025, cash terms: £3.27bn a year.");
    expect(info.textContent).toContain("Our saving from removing PIP at 16 to 24, 2029-30, cash terms: £4.68bn a year.");
    // The source is the foot's chip, not repeated in More info (issue #6, item 8)
    expect(within(info).queryByRole("link", { name: /From a Welfare State to a Working State/ })).toBeNull();
    expect(info.textContent).toContain("Not tested against the 15% tolerance: the review's figure gives no area.");
    // The different-basis pair says how, and DWP's count
    const pip = openMoreInfo("young_pip_recipients");
    expect(pip.textContent).toContain("Not like for like: ours is England and Wales in 2025; the published figure is current, for November 2026.");
    expect(pip.textContent).toContain("407,505");
    // The employer NI pair's net cost
    expect(openMoreInfo("employer_nics_under_25").textContent).toContain("Our net cost, 2029-30, cash terms: £4.65bn a year.");
  });

  it("lists every figure once, with its source, and the package's estimate from its own run", async () => {
    const region = await renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Show all 13 figures" }));
    expect(region.querySelectorAll("[data-benchmark]").length).toBe(file.rows.length);
    for (const each of region.querySelectorAll("[data-benchmark]")) {
      expect(each.querySelectorAll("[data-source-link]").length, each.dataset.benchmark).toBe(each.dataset.benchmark === "package_young_people_affected" ? 0 : 1);
    }
    expect(card("package_young_people_affected").textContent).toContain("100,000");
    expect(card("uc_health_no_work_requirements").querySelector("[data-unpublished-basis]")).not.toBeNull();
    expect(card("review_welfare_saving_2036").querySelector(".bm-value").textContent).toBe("£3.6bn in 2036-37");
    expect(card("review_welfare_saving_2036").querySelector(".is-estimate")).toBeNull();
    for (const link of within(region).getAllByRole("link")) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(screen.getByText("About these figures").closest("details")).not.toHaveAttribute("open");
  });

  it("draws each graphic's points as worded in the file", () => {
    for (const [id, graphic] of Object.entries(BENCHMARK_GRAPHICS)) {
      const row = file.rows.find((each) => each.id === id);
      expect(row, id).toBeTruthy();
      for (const point of graphic.points) expect(`${row.value} ${row.basis}`, `${id} ${point.text}`).toContain(point.text);
    }
  });

  it("writes every figure to the CSV once, with its source, link and date as in the file", async () => {
    const { benchmarksCsv } = await import("./BenchmarksTable");
    const csv = benchmarksCsv(benchmarkGroups(file.rows), new Map());
    const lines = csv.replace(/^\uFEFF/, "").trim().split("\r\n").filter((line) => !/^"?#/.test(line));
    expect(lines.length - 1).toBe(file.rows.length);
    const pip = lines.find((line) => line.includes("PIP spending, 16–24s"));
    expect(pip).toContain("https://www.gov.uk/government/publications/from-a-welfare-state-to-a-working-state-a-new-settlement-for-the-next-generation/from-a-welfare-state-to-a-working-state-a-new-settlement-for-the-next-generation");
    expect(pip).toContain("17 November 2026");
    expect(pip).toContain("£3.27bn a year");
    expect(pip).toContain(",-14,,Yes,Not tested: the review's figure gives no area,");
    // A share's gap in percentage points, in its own column
    expect(lines.find((line) => line.includes("UC health element and PIP, 16–24s"))).toContain(",,28.1,Yes,");
    expect(lines.find((line) => line.includes("PIP recipients, 16–24s"))).toContain("No: ours is England and Wales in 2025");
  });

  it("shows an unavailable state when its file is missing", async () => {
    vi.stubGlobal("fetch", respond(null));
    const { default: BenchmarksTable } = await import("./BenchmarksTable");
    render(<BenchmarksTable />);
    expect(await screen.findByText("The benchmarks are not available.")).toBeInTheDocument();
  });
});
