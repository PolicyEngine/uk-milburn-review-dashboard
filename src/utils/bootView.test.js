import { afterEach, describe, expect, it } from "vitest";
import { BOOT_SUBS, BOOT_VIEW_SCRIPT, bootView } from "./bootView";
import { POPULATION_SUB_TABS } from "../components/PopulationImpactView";
import { VIEWS } from "../App";

const CASES = [
  ["", "", "dashboard:age"],
  ["?tab=dashboard&sub=finances", "", "dashboard:finances"],
  ["?tab=dashboard&sub=scenarios", "", "dashboard:scenarios"],
  ["?tab=dashboard&sub=benchmarks", "", "dashboard:benchmarks"],
  ["?tab=dashboard&sub=all", "", "dashboard:all"],
  ["?sub=young", "", "dashboard:age"],
  ["?tab=dashboard&sub=pensioners", "", "dashboard:age"],
  ["?tab=household", "", "household"],
  ["?tab=outlook&sub=forecast", "", "dashboard:age"],
  ["?tab=nonsense", "", "dashboard:age"],
  ["?policies=alpha", "#young-people", "dashboard:age"],
  ["", "#deciles", "dashboard:all"],
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
