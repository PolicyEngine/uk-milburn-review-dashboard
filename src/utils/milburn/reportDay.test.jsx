/**
 * The report-day switch (reportDay.js), in both states: off, the page has
 * every sub-tab and landing box; on, Moves into work (illustrative) and Benchmarks are left
 * out of Impact's sub-tabs, Moves into work's box is left off the landing
 * page and the About drawer, and a link to either opens the default.
 *
 * No case pins which state the file is in today, so flipping REPORT_DAY
 * leaves this file green.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { REPORT_DAY, REPORT_DAY_HIDDEN_SUBS, subShownOnReportDay } from "./reportDay";
import { POPULATION_SUB_TABS, populationSubTabs } from "../../components/PopulationImpactView";
import { LandingBoxes, landingBoxes } from "../../components/LandingPage";
import { POVERTY_FIGURES_SHOWN } from "../povertyFigures";

const ALWAYS = ["age", ...(POVERTY_FIGURES_SHOWN ? ["poverty"] : []), "finances"];
const values = (tabs) => tabs.map((tab) => tab.value);
const hrefs = () => screen.getAllByRole("link").map((link) => link.getAttribute("href"));

afterEach(() => {
  cleanup();
  vi.doUnmock("./reportDay");
  vi.resetModules();
  window.history.replaceState({}, "", "/");
});

describe("the switch", () => {
  it("is a boolean, and hides exactly Moves into work (illustrative) and Benchmarks", () => {
    expect(typeof REPORT_DAY).toBe("boolean");
    expect(REPORT_DAY_HIDDEN_SUBS).toEqual(["scenarios", "benchmarks"]);
  });

  it("off, shows every sub-tab", () => {
    for (const sub of [...ALWAYS, "scenarios", "benchmarks", undefined]) expect(subShownOnReportDay(sub, false), String(sub)).toBe(true);
  });

  it("on, hides only its two sub-tabs", () => {
    for (const sub of [...ALWAYS, undefined]) expect(subShownOnReportDay(sub, true), String(sub)).toBe(true);
    for (const sub of ["scenarios", "benchmarks"]) expect(subShownOnReportDay(sub, true), sub).toBe(false);
  });

  it("is what the page reads when no state is given", () => {
    expect(subShownOnReportDay("scenarios")).toBe(!REPORT_DAY);
    expect(values(POPULATION_SUB_TABS)).toEqual(values(populationSubTabs({ reportDay: REPORT_DAY })));
    expect(landingBoxes()).toEqual(landingBoxes({ reportDay: REPORT_DAY }));
  });
});

describe("Impact's sub-tabs", () => {
  it("off: Young people, Poverty, Public finances, Moves into work (illustrative), Benchmarks", () => {
    expect(values(populationSubTabs({ reportDay: false }))).toEqual([...ALWAYS, "scenarios", "benchmarks"]);
    expect(populationSubTabs({ reportDay: false }).map((tab) => tab.label).slice(-2)).toEqual(["Moves into work (illustrative)", "Benchmarks"]);
  });

  it("on: Moves into work (illustrative) and Benchmarks are left out, the rest keep their order", () => {
    expect(values(populationSubTabs({ reportDay: true }))).toEqual(ALWAYS);
  });
});

describe("the landing boxes", () => {
  it("off: Young people, Moves into work (illustrative), the measures", () => {
    expect(landingBoxes({ reportDay: false }).map(([tab, sub, , title]) => [tab, sub, title])).toEqual([
      ["dashboard", "age", "Young people"],
      ["dashboard", "scenarios", "Moves into work (illustrative)"],
      ["policies", undefined, "Measures we model"],
    ]);
  });

  it("on: Moves into work's box is left out", () => {
    expect(landingBoxes({ reportDay: true }).map(([tab, sub, , title]) => [tab, sub, title])).toEqual([
      ["dashboard", "age", "Young people"],
      ["policies", undefined, "Measures we model"],
    ]);
  });

  it.each([[false], [true]])("draw the same boxes on the landing page and in the About drawer's list (on: %s)", (reportDay) => {
    const expected = ["?tab=dashboard&sub=age", ...(reportDay ? [] : ["?tab=dashboard&sub=scenarios"]), "?tab=policies"];
    const { unmount } = render(<LandingBoxes onOpen={() => {}} reportDay={reportDay} />);
    expect(hrefs()).toEqual(expected);
    expect(screen.queryByText("Moves into work (illustrative)") === null).toBe(reportDay);
    unmount();
    render(<LandingBoxes onOpen={() => {}} list reportDay={reportDay} />);
    expect(hrefs()).toEqual(expected);
  });
});

// The one line flipped: every reader of the switch, loaded afresh under it
describe.each([[false], [true]])("the page with REPORT_DAY = %s", (on) => {
  const load = async () => {
    vi.resetModules();
    vi.doMock("./reportDay", async (original) => {
      const actual = await original();
      return { ...actual, REPORT_DAY: on, subShownOnReportDay: (sub, reportDay = on) => actual.subShownOnReportDay(sub, reportDay) };
    });
    const view = await import("../../components/PopulationImpactView");
    const landing = await import("../../components/LandingPage");
    return { PopulationImpactView: view.default, tabs: view.POPULATION_SUB_TABS, LandingBoxes: landing.LandingBoxes };
  };
  const tabNames = () => screen.getAllByRole("tab").map((tab) => tab.textContent);

  it(`${on ? "leaves out" : "has"} the Moves into work (illustrative) and Benchmarks sub-tabs`, async () => {
    const { PopulationImpactView, tabs } = await load();
    expect(values(tabs)).toEqual([...ALWAYS, ...(on ? [] : ["scenarios", "benchmarks"])]);
    render(<PopulationImpactView>{(sub) => <p>{`panel ${sub}`}</p>}</PopulationImpactView>);
    await screen.findAllByRole("tab");
    expect(tabNames().includes("Moves into work (illustrative)")).toBe(!on);
    expect(tabNames().includes("Benchmarks")).toBe(!on);
    expect(tabNames()).toHaveLength(ALWAYS.length + (on ? 0 : 2));
  });

  it.each([["scenarios", "Moves into work (illustrative)"], ["benchmarks", "Benchmarks"]])(`?sub=%s opens ${on ? "the default, Young people" : "%s"}`, async (sub, label) => {
    window.history.replaceState({}, "", `/?tab=dashboard&sub=${sub}`);
    const { PopulationImpactView } = await load();
    render(<PopulationImpactView>{(open) => <p>{`panel ${open}`}</p>}</PopulationImpactView>);
    expect(await screen.findByRole("tab", { selected: true })).toHaveTextContent(on ? "Young people" : label);
    expect(screen.getByText(`panel ${on ? "age" : sub}`)).toBeInTheDocument();
    expect(screen.queryByText(`panel ${on ? sub : "age"}`)).toBeNull();
  });

  it(`${on ? "leaves out" : "has"} Moves into work's landing box`, async () => {
    const { LandingBoxes } = await load();
    render(<LandingBoxes onOpen={() => {}} />);
    expect(hrefs().includes("?tab=dashboard&sub=scenarios")).toBe(!on);
    expect(hrefs()).toHaveLength(on ? 2 : 3);
  });
});
