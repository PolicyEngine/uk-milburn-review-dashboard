import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import BenchmarkCallout, { PUBLISHED_FIGURES_LINE } from "./BenchmarkCallout";
import { OPEN_POPULATION_SUB } from "../../utils/populationSub";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BenchmarkCallout", () => {
  it.each(["young", "poverty", "finances"])("%s: one line pointing to Benchmarks, no figures repeated", (place) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { container } = render(<BenchmarkCallout place={place} reportDay={false} />);
    const line = container.querySelector(".bm-callout");
    expect(line.dataset.place).toBe(place);
    expect(line.textContent).toBe(`${PUBLISHED_FIGURES_LINE} see Benchmarks`);
    expect(line.textContent).toBe("Published figures for comparison: see Benchmarks");
    // No cards, no disclosure and no file read: the figures are on Benchmarks
    expect(container.querySelector("details, li")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("links to the Benchmarks sub-tab without leaving the page", () => {
    const opened = vi.fn();
    const onOpen = (event) => opened(event.detail);
    window.addEventListener(OPEN_POPULATION_SUB, onOpen);
    render(<BenchmarkCallout place="finances" reportDay={false} />);
    const link = screen.getByRole("link", { name: "Benchmarks" });
    expect(link).toHaveAttribute("href", "?tab=dashboard&sub=benchmarks");
    fireEvent.click(link);
    window.removeEventListener(OPEN_POPULATION_SUB, onOpen);
    expect(opened).toHaveBeenCalledWith("benchmarks");
  });

  it("shows nothing while the report-day switch takes Benchmarks down", () => {
    const { container } = render(<BenchmarkCallout place="young" reportDay />);
    expect(container).toBeEmptyDOMElement();
  });
});
