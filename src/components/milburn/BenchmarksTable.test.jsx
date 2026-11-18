import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { BENCHMARK_GRAPHICS, BENCHMARK_TOPICS, heroRows, heroSummary, parseBenchmarks, topicFromSearch } from "../../utils/milburn/benchmarks";
import { heroCsv, heroDomain, heroTicks } from "./BenchmarksHero";

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

const LIKE_FOR_LIKE = ["uc_health_element_16_24", "pip_spend_16_24", "uc_health_spend_16_24", "young_benefits_spend", "employer_nics_under_25"];

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

describe("Benchmarks hero", () => {
  it("draws every comparable pair, like-for-like first, the different-basis pair flagged with no gap", async () => {
    const region = await renderTab();
    const hero = region.querySelector(".bm-hero");
    expect(within(hero).getByRole("heading", { name: "How close are our estimates?" })).toBeInTheDocument();
    expect([...hero.querySelectorAll("[data-hero-row]")].map((row) => row.dataset.heroRow)).toEqual([...LIKE_FOR_LIKE, "young_pip_recipients"]);
    // Every like-for-like pair has a dot and a gap label; the other none
    for (const id of LIKE_FOR_LIKE) {
      const row = hero.querySelector(`[data-hero-row="${id}"]`);
      expect(row.querySelector(".bm-hero-dot"), id).not.toBeNull();
      expect(row.querySelector(".bm-hero-value").textContent, id).toMatch(/^[+−]\d+%$/);
    }
    const flagged = hero.querySelector('[data-hero-row="young_pip_recipients"]');
    expect(flagged.querySelector(".bm-hero-dot")).toBeNull();
    expect(flagged.textContent).toContain("Not like for like");
    expect(flagged.textContent).not.toMatch(/[+−]\d+%/);
    // Headline chips
    expect(hero.querySelector(".bm-hero-chips").textContent).toContain("3 of 5 like-for-like pairs within 15%");
    expect(hero.querySelector(".bm-hero-chips").textContent).toContain("Largest gap: 33% higher");
    expect(hero.querySelector(".bm-hero-chips").textContent).toContain("1 pair not like for like");
    // A table alternative for screen readers, every pair a row
    const table = hero.querySelector("table");
    expect(table.querySelectorAll("tbody tr").length).toBe(6);
    expect(table.textContent).toContain("Ours 33% higher");
    // A download menu
    expect(within(hero).getByRole("button", { name: /Download chart: How close are our estimates\?/ })).toBeInTheDocument();
  });

  it("counts the band on the raw gap and gives no two-decimal gap anywhere", async () => {
    const rows = heroRows(file.rows);
    // Employer NI is 14.7%: inside the band, though it reads as 15%
    expect(rows.find((row) => row.id === "employer_nics_under_25").within).toBe(true);
    expect(rows.find((row) => row.id === "uc_health_spend_16_24").within).toBe(false);
    expect(heroSummary(rows)).toMatchObject({ pairs: 6, like: 5, within: 3, notLike: 1 });
    expect(heroDomain(rows)).toBe(40);
    expect(heroTicks(40)).toEqual([-40, -20, 0, 20, 40]);
    const csv = heroCsv(rows);
    expect(csv).toContain('"PIP spending, 16–24s",£3.8bn,£3.27bn,-14,Yes');
    expect(csv).toContain("No: ours is England and Wales in 2025");
    const region = await renderTab();
    expect(region.textContent).not.toMatch(/\d\.\d\d%/);
  });

  it("opens a pair's card from its hero row", async () => {
    window.requestAnimationFrame = (callback) => callback();
    await renderTab();
    fireEvent.click(screen.getByRole("button", { name: /^PIP spending, 16–24s/ }));
    await waitFor(() => expect(card("pip_spend_16_24")).toHaveClass("is-focused"));
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
      "young_pip_recipients",
      "pip_spend_16_24",
      "uc_health_spend_16_24",
      "young_benefits_spend",
      "employer_nics_under_25",
    ]);
    for (const [id, gap] of [
      ["uc_health_element_16_24", "Ours 33% higher"],
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
  });

  it("holds why they differ, both bases, our build and saving, and the source in More info", async () => {
    await renderTab();
    const info = openMoreInfo("pip_spend_16_24");
    expect(info.textContent).toContain("Why they differ");
    expect(info.textContent).toContain("Why ours is lower: the caseload matches DWP's 2025 count");
    expect(info.textContent).toContain("Published: £3.8bn a year; £1.3bn in 2019-20, forecast at £8.1bn in 2036-37.");
    expect(info.textContent).toContain("PolicyEngine, build fcfac709, 2025, cash terms: £3.27bn a year.");
    expect(info.textContent).toContain("Our saving from removing PIP at 16 to 24, 2029-30, cash terms: £4.68bn a year.");
    const source = within(info).getByRole("link", { name: /From a Welfare State to a Working State/ });
    expect(source).toHaveAttribute("target", "_blank");
    expect(source).toHaveAttribute("rel", "noopener noreferrer");
    expect(info.textContent).toContain("17 November 2026");
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

  it("shows an unavailable state when its file is missing", async () => {
    vi.stubGlobal("fetch", respond(null));
    const { default: BenchmarksTable } = await import("./BenchmarksTable");
    render(<BenchmarksTable />);
    expect(await screen.findByText("The benchmarks are not available.")).toBeInTheDocument();
  });
});
