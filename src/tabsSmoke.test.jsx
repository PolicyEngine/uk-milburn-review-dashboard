/**
 * Smoke test of the four tabs, and Population impact's other sub-tabs,
 * on the real data.
 *
 * Each tab is opened by its address (?tab=, ?sub=), as a shared link opens it, and
 * rendered with every data file served from public/ as the deployed page
 * serves it, and the household API answered with its fixture
 * (src/test/fixtures/householdImpact.json, shaped as the route's
 * contract). A tab fails if rendering throws, if anything logs a
 * console error, if a data file it fetches is missing, or if it shows an
 * error message instead of its content.
 *
 * Why jsdom and not a browser: it needs no new dependency or browser
 * download on runners that already queue, runs in the Frontend tests job
 * and on any laptop with bun, and reads the same files the build ships.
 * What jsdom cannot show (that the built site serves the page and these
 * files with HTTP 200) the "Built site" CI job checks against `next start`.
 */
import { expectCompletePills } from "./test/optionsPills";
import { downloadMenus, STANDARD_FORMATS } from "./test/downloadMenus";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App, { VIEWS, preloadAllViews } from "./App";
import { clearHouseholdImpactCache } from "./hooks/useHouseholdImpact";
import { clearBasisIncomeCache } from "./hooks/useBasisIncome";
import { clearOutlookCache } from "./utils/livingStandards/outlook";
import { resetSavedWizard } from "./components/HouseholdCalculator";
import { householdAnswerFor } from "./test/householdFixture";
import { dashboardFixtureFetch } from "./test/dashboardFixture";
import { fixtureJson } from "./test/publicationFixture";
import { receiptEngine } from "./utils/publication/load";
import { receiptDefinitionFor, reportedDefinitions, requestedDefinitions, route } from "./test/definitionsFixture";
import { SAVINGS_INCOME_RATES_ID, withoutCalculatorOnly } from "./utils/calculatorOnlyMeasures";
import { POVERTY_FIGURES_SHOWN } from "./utils/povertyFigures";

// The Autumn Budget's calculator-only measures, so the mechanism stays covered
vi.mock("./utils/calculatorOnlyMeasures", async (original) => (await import("./test/calculatorOnlyFixture")).mockCalculatorOnly(await original()));


// Every view's code is in before a test renders it (App.jsx lazyView)
beforeAll(preloadAllViews, 60_000);

// The receipt fixture's supported year follows the engine's projection
// end (currently beyond the dashboard's Budget-year window). Exercise the
// live calculator in that verified fixture year without rewriting receipts.
vi.mock("./utils/displayYears", async (original) => {
  const actual = await original();
  const { IN_DATA } = await import("./test/publicationFixture");
  // App shows the years yearsForSelection returns and moves a year it does
  // not offer back to DEFAULT_DISPLAY_YEAR, so the fixture year is added
  // there too (the real function closes over the real DISPLAY_YEARS)
  const withFixtureYear = (years) => [...new Set([...years, IN_DATA])];
  return {
    ...actual,
    DEFAULT_DISPLAY_YEAR: IN_DATA,
    DISPLAY_YEARS: withFixtureYear(actual.DISPLAY_YEARS),
    yearsForSelection: (rows, selected) => withFixtureYear(actual.yearsForSelection(rows, selected)),
  };
});

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const API = "https://household-api.test";
const HOUSEHOLD_API = `${API}/api/household-impact`;

// Results by area come only from the disclosure layer, which has not
// published them yet: the page shows "not yet published" on a 404.
// The official costings follow the Budget; until then Public finances shows
// the comparison's card empty, saying when it fills in.
const NOT_YET_PUBLISHED = new Set([
  "/data/regional.csv",
  "/data/constituency.csv",
  "/data/release-index.json",
  "/data/official_costings.json",
  // Written by the pipeline: until then Return to work says its entry cases are unavailable
  "/data/milburn_scenarios.json",
]);

// Text that means a tab failed instead of showing its content.
const FAILURE_TEXT = [
  /This build has no NEXT_PUBLIC_HOUSEHOLD_API_URL/,
  /Results are not available here/,
  /API error/,
  /Application error/,
  /Something went wrong/i,
  /could not be (loaded|fetched|read)/i,
  /HTTP \d{3}/,
];

// What each tab shows only once its data has loaded. (jsdom lays nothing
// out, so charts draw no values; these are the data-driven text around them.)
const LOADED = {
  // Impact opens on Young people, which reads the age table (below)
  dashboard: (panel) => within(panel).findAllByText(/Results by age are not available/),
  // Impact's other sub-tabs, by ?sub=
  // Return to work: led by the microsimulated run from milburn_summary.json
  scenarios: (panel) => within(panel).findAllByRole("heading", { name: "With a quarter moving into work" }),
  benchmarks: (panel) => within(panel).findAllByRole("listitem"),
  // Population impact's Poverty while its figures are shown; while they are
  // withheld (povertyFigures.js), ?sub=poverty opens Public finances
  ...(POVERTY_FIGURES_SHOWN
    ? { poverty: (panel) => within(panel).findAllByRole("heading", { name: /Change in the poverty rate/ }) }
    : { povertyFallback: (panel) => within(panel).findAllByText(/Results by age are not available/) }),
  finances: (panel) => within(panel).findAllByRole("heading", { name: /Revenue impact/ }),
  // Population impact's Young people sub-tab (?sub=young): the cards
  // render once age_impact.csv is read.
  // Young people and Pensioners read the age table from verified artifacts;
  // the fixture's carry none, so both say so (#104)
  age: (panel) => within(panel).findAllByText(/Results by age are not available/),
  // Every published measure's card, whatever the band's selection
  policies: (panel) => within(panel).findAllByRole("listitem"),
  methodology: (panel) => within(panel).findAllByRole("heading"),
};

// React's act() warning is a jsdom test artefact (state set after an
// awaited fetch); a browser never logs it. Any other console error fails.
const TEST_ONLY = /^An update to .* inside a test was not wrapped in act/;

let requests;
let consoleErrors;

const publicationFetch = dashboardFixtureFetch();

// The household API must run the model versions the approved receipts
// record, or Household calculator shows nothing: answer with alpha's.
const PUBLISHED_ENGINE = receiptEngine(
  fixtureJson(`${fixtureJson("manifest.json").measures.alpha.artifact}/receipt.json`),
);
// And compute each measure from the definition its receipt approved: answer
// with each requested measure's.
const publishedDefinition = receiptDefinitionFor(fixtureJson);
function publishedAnswerFor(body, url) {
  const answer = householdAnswerFor(body);
  return {
    ...answer,
    engine: { ...answer.engine, ...PUBLISHED_ENGINE },
    definitions: reportedDefinitions(url, publishedDefinition),
  };
}

function serve(input, init = {}) {
  const url = typeof input === "string" ? input : input.url;
  const method = (init.method ?? input.method ?? "GET").toUpperCase();
  if (url.startsWith(HOUSEHOLD_API)) {
    const ok = route(url) === HOUSEHOLD_API && method === "POST";
    requests.push({ url, status: ok ? 200 : 404, body: init.body });
    return ok
      ? new Response(JSON.stringify(publishedAnswerFor(init.body, url)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      : new Response("{}", { status: 404 });
  }
  if (url.startsWith(API)) {
    // Any other route on the API
    requests.push({ url, status: 404 });
    return new Response("{}", { status: 404 });
  }
  const { pathname } = new URL(url, "http://localhost");
  if (pathname === "/data/manifest.json" || pathname.startsWith("/data/artifacts/")) return publicationFetch(url, init);
  const path = normalize(join(PUBLIC, decodeURIComponent(pathname)));
  const found = path.startsWith(PUBLIC) && existsSync(path) && statSync(path).isFile();
  requests.push({ url: pathname, status: found ? 200 : 404 });
  return found ? new Response(readFileSync(path), { status: 200 }) : new Response("", { status: 404 });
}

beforeEach(() => {
  requests = [];
  consoleErrors = [];
  vi.stubEnv("NEXT_PUBLIC_HOUSEHOLD_API_URL", HOUSEHOLD_API);
  clearHouseholdImpactCache();
  clearBasisIncomeCache();
  // Each test reads the outlook afresh, so its requests can be counted
  clearOutlookCache();
  // Each tab opens as a new visit would: the form at its first step
  resetSavedWizard();
  vi.stubGlobal("fetch", vi.fn(async (input, init) => serve(input, init)));
  vi.spyOn(console, "error").mockImplementation((...args) => {
    const message = args.map((a) => (a instanceof Error ? a.message : String(a))).join(" ");
    if (!TEST_ONLY.test(message)) consoleErrors.push(message);
  });
  try {
    window.localStorage.clear();
  } catch {
    // no storage: nothing saved to clear
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// What a withheld poverty or people-affected figure would say (povertyFigures.js),
// and the views that must say none of it
const WITHHELD_TEXT = /poverty|people affected|of people move|winners and losers|better off|worse off/i;
const WITHHELD_IN = new Set(["dashboard", "age", "finances", "povertyFallback"]);

// Each tab by its address, and Population impact's other sub-tabs:
// [name, LOADED key, address, the panel's label]
const CASES = [
  // Impact opens on Young people
  ...VIEWS.map((v) => [v.label, v.value, `/?tab=${v.value}`, v.label]),
  ["Population impact: Young people", "age", "/?sub=age", "Young people"],
  ["Population impact: Return to work", "scenarios", "/?sub=scenarios", "Return to work"],
  ["Population impact: Benchmarks", "benchmarks", "/?sub=benchmarks", "Benchmarks"],
  POVERTY_FIGURES_SHOWN
    ? ["Population impact: Poverty", "poverty", "/?sub=poverty", "Poverty"]
    : ["Population impact: ?sub=poverty, withheld", "povertyFallback", "/?sub=poverty", "Young people"],
  // The bare address is the landing page, over this view (landing.test.jsx)
  ["Population impact: Public finances", "finances", "/?tab=dashboard&sub=finances", "Public finances"],
];

describe("each of the four tabs and Population impact's sub-tabs, on a verified publication and real baseline data", () => {
  it("covers every tab", () => {
    expect(CASES.map((c) => c[1]).sort()).toEqual(Object.keys(LOADED).sort());
  });

  it.each(CASES)(
    "%s renders its content with no error",
    async (_name, value, address, label) => {
      window.history.replaceState({}, "", address);
      render(<App />);
      await waitFor(() => expect(document.querySelector('.app[data-publication="verified"]')).not.toBeNull());
      const panel = await screen.findByRole("tabpanel", { name: label });
      expect(await LOADED[value](panel, { timeout: 5000 })).not.toHaveLength(0);
      // Let every request the tab started settle.
      await new Promise((resolve) => setTimeout(resolve, 50));
      // Every Options pill on the tab names every choice its dialog holds
      expectCompletePills(panel);
      // Every card's Download offers the same formats (CSV, PNG, SVG)
      const menus = downloadMenus(panel);
      for (const menu of menus) expect(menu.formats, menu.name).toEqual(STANDARD_FORMATS);
      // While the poverty and people-affected figures are withheld
      // (povertyFigures.js), no Population impact sub-tab or the Household
      // calculator shows or offers one
      if (!POVERTY_FIGURES_SHOWN && WITHHELD_IN.has(value)) {
        expect(panel.textContent).not.toMatch(WITHHELD_TEXT);
        for (const menu of menus) expect(menu.name ?? "").not.toMatch(WITHHELD_TEXT);
        expect(within(panel.closest("#panel-dashboard") ?? panel).queryByRole("tab", { name: "Poverty" })).toBeNull();
      }
      if (value === "povertyFallback") expect(new URLSearchParams(window.location.search).get("sub")).toBeNull();

      for (const pattern of FAILURE_TEXT) {
        expect(document.body.textContent, String(pattern)).not.toMatch(pattern);
      }
      expect(consoleErrors).toEqual([]);
      const missing = requests.filter(
        (r) => r.status !== 200 && !NOT_YET_PUBLISHED.has(r.url),
      );
      expect(missing).toEqual([]);
    },
    15000,
  );
});
