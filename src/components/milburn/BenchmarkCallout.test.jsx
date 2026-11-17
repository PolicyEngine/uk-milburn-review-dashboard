import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import BenchmarkCallout, { BENCHMARK_PLACES, calloutItems } from "./BenchmarkCallout";
import { parseBenchmarks } from "../../utils/milburn/benchmarks";
import { OPEN_POPULATION_SUB } from "../../utils/populationSub";

const text = readFileSync(join(__dirname, "..", "..", "..", "public", "data", "milburn_benchmarks.json"), "utf8");
const file = parseBenchmarks(JSON.parse(text));
const rowOf = (id) => file.rows.find((row) => row.id === id);

const serve = (body) =>
  vi.fn(async () => (body === null ? { ok: false, status: 404, json: async () => null } : { ok: true, status: 200, json: async () => JSON.parse(body) }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the published figures chosen for each place", () => {
  it.each(Object.keys(BENCHMARK_PLACES))("%s: two to four rows of the file, none twice, each with a figure and a source", (place) => {
    const ids = BENCHMARK_PLACES[place].map((item) => item.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(ids.length).toBeLessThanOrEqual(4);
    expect(new Set(ids).size).toBe(ids.length);
    const items = calloutItems(place, file.rows);
    expect(items.map((item) => item.id)).toEqual(ids);
    for (const item of items) {
      // The figure is the file's wording, never retyped here
      expect(rowOf(item.id).value.startsWith(item.value), item.id).toBe(true);
      expect(item.row.url, item.id).toMatch(/^https:\/\//);
      expect(item.row.source, item.id).not.toBe("");
      expect(item.row.date, item.id).not.toBe("");
    }
    // No figure twice in one place
    const values = items.map((item) => item.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("says in one sentence-case line how each differs from our figure", () => {
    for (const item of Object.values(BENCHMARK_PLACES).flat()) {
      expect(item.differs, item.id).toMatch(/^[A-Z].*\.$/);
      expect(item.differs.length, item.id).toBeLessThanOrEqual(110);
      expect(item.differs, item.id).toMatch(/ours|our |not a /);
    }
  });

  it("shows the figures asked for in each place", () => {
    const shown = (place) => calloutItems(place, file.rows).map((item) => item.value);
    expect(shown("finances")).toEqual(["£3.6bn in 2036-37", "£13.7bn by 2036-37", "£3.8bn a year", "£0.92bn a year"]);
    expect(shown("poverty")).toEqual(["50,000 fewer", "120,000"]);
    expect(shown("young")).toEqual(["176,000", "450,000", "981,000", "Over £2bn"]);
  });

  it("leaves out an id the file lacks", () => {
    expect(calloutItems("poverty", file.rows.filter((row) => row.id !== "kept_out_of_poverty")).map((item) => item.id)).toEqual(["relative_poverty_review"]);
    expect(calloutItems("nowhere", file.rows)).toEqual([]);
  });
});

describe("BenchmarkCallout", () => {
  it("shows each figure with its icon, basis, source link and date", async () => {
    vi.stubGlobal("fetch", serve(text));
    render(<BenchmarkCallout place="poverty" reportDay={false} />);
    const strip = await screen.findByRole("complementary", { name: "Published figures" });
    // The summary row is a disclosure: a chevron, then what opening or closing it does, with the count
    const summary = strip.querySelector("summary");
    expect(summary.firstElementChild).toHaveClass("bm-callout-chevron");
    expect(summary.querySelector(".bm-callout-chevron svg")).not.toBeNull();
    expect(summary.querySelector(".bm-callout-show").textContent).toBe("Show 2 published figures");
    expect(summary.querySelector(".bm-callout-hide").textContent).toBe("Hide published figures");
    expect(strip.textContent).not.toContain("PolicyEngine estimate");
    const items = within(within(strip).getByRole("list", { name: "Published figures, with sources" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("50,000 fewer");
    expect(items[0]).toHaveTextContent("our relative figure is static");
    // The source is one chip-link: short name and date, the full title as its tooltip
    const review = within(items[0]).getByRole("link", { name: /^Review, annex · 17 Nov 2026/ });
    expect(review).toHaveAttribute("title", rowOf("relative_poverty_review").source);
    expect(review).toHaveAttribute("href", rowOf("relative_poverty_review").url);
    expect(items[0].querySelector(".pub-card-icon svg")).not.toBeNull();
    expect(items[0].querySelector(".pub-card-value strong").textContent).toBe("50,000 fewer");
    const link = within(items[1]).getByRole("link", { name: /^Resolution Foundation · 13 Nov 2026/ });
    expect(link).toHaveAttribute("href", rowOf("kept_out_of_poverty").url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("sets a figure's qualifier smaller beside its value", async () => {
    vi.stubGlobal("fetch", serve(text));
    render(<BenchmarkCallout place="finances" reportDay={false} />);
    const strip = await screen.findByRole("complementary", { name: "Published figures" });
    const card = strip.querySelector('[data-benchmark="review_welfare_saving_2036"]');
    expect(card.querySelector(".pub-card-value strong").textContent).toBe("£3.6bn");
    expect(card.querySelector(".pub-card-qualifier").textContent.trim()).toBe("in 2036-37");
    expect(strip.querySelector(".bm-callout-show").textContent).toBe("Show 4 published figures");
  });

  it.each([
    ["finances", "the review"],
    ["poverty", "the review, Resolution Foundation"],
    ["young", "Resolution Foundation, ONS, the review"],
  ])("%s: the folded line lists whose figures they are", async (place, line) => {
    vi.stubGlobal("fetch", serve(text));
    render(<BenchmarkCallout place={place} reportDay={false} />);
    const strip = await screen.findByRole("complementary", { name: "Published figures" });
    expect(strip.querySelector("summary [data-published-by]").textContent).toBe(line);
  });

  it("links to the Benchmarks sub-tab without leaving the page", async () => {
    vi.stubGlobal("fetch", serve(text));
    const opened = vi.fn();
    const onOpen = (event) => opened(event.detail);
    window.addEventListener(OPEN_POPULATION_SUB, onOpen);
    render(<BenchmarkCallout place="finances" reportDay={false} />);
    const more = await screen.findByRole("link", { name: "All benchmarks" });
    expect(more).toHaveAttribute("href", "?tab=dashboard&sub=benchmarks");
    fireEvent.click(more);
    window.removeEventListener(OPEN_POPULATION_SUB, onOpen);
    expect(opened).toHaveBeenCalledWith("benchmarks");
  });

  it("shows nothing when the file is missing or is not a benchmarks file", async () => {
    for (const body of [null, JSON.stringify({ runs: [] })]) {
      const fetch = serve(body);
      vi.stubGlobal("fetch", fetch);
      const { container, unmount } = render(<BenchmarkCallout place="young" reportDay={false} />);
      await waitFor(() => expect(fetch).toHaveBeenCalled());
      await Promise.resolve();
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });

  it("shows nothing while the report-day switch takes Benchmarks down", async () => {
    const fetch = serve(text);
    vi.stubGlobal("fetch", fetch);
    const { container } = render(<BenchmarkCallout place="young" reportDay />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });
});
