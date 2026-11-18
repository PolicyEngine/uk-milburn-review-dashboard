import { afterEach, describe, expect, it } from "vitest";
import { BOOT_SUBS, BOOT_VIEW_SCRIPT, bootView } from "./bootView";
import { POPULATION_SUB_TABS } from "../components/PopulationImpactView";
import { VIEWS } from "../App";
import { subShownOnReportDay } from "./milburn/reportDay";

// A sub-tab the report-day switch hides opens the default, as any unknown sub does
const opens = (sub) => (subShownOnReportDay(sub) ? `dashboard:${sub}` : "dashboard:age");

const CASES = [
  ["", "", "dashboard:age"],
  ["?tab=dashboard&sub=finances", "", "dashboard:finances"],
  ["?tab=dashboard&sub=scenarios", "", opens("scenarios")],
  ["?tab=dashboard&sub=benchmarks", "", opens("benchmarks")],
  // All households and the Household calculator were removed: their links open the default
  ["?tab=dashboard&sub=all", "", "dashboard:age"],
  ["?sub=young", "", "dashboard:age"],
  ["?tab=dashboard&sub=pensioners", "", "dashboard:age"],
  ["?tab=household", "", "household"],
  ["?tab=measures", "", "policies"],
  ["?tab=outlook&sub=forecast", "", "dashboard:age"],
  ["?tab=nonsense", "", "dashboard:age"],
  ["?policies=alpha", "#young-people", "dashboard:age"],
  ["", "#deciles", "dashboard:age"],
];

afterEach(() => document.documentElement.removeAttribute("data-boot-view"));

describe("the view an address opens, before the page's code", () => {
  it.each(CASES)("%s%s opens %s", (search, hash, expected) => {
    expect(bootView({ search, hash })).toBe(expected);
  });

  it("is marked by the inline script exactly as bootView reads it", () => {
    for (const [search, hash, expected] of CASES) {
      window.history.replaceState({}, "", `/${search}${hash}`);
      new Function(BOOT_VIEW_SCRIPT)();
      expect(document.documentElement.getAttribute("data-boot-view")).toBe(expected);
    }
  });

  it("knows the page's views and sub-tabs", () => {
    expect(VIEWS.map((view) => view.value).sort()).toEqual(["dashboard", "household", "methodology", "policies"]);
    expect(BOOT_SUBS.dashboard).toEqual(POPULATION_SUB_TABS.map((tab) => tab.value));
    expect(BOOT_SUBS.outlook).toBeUndefined();
  });
});
