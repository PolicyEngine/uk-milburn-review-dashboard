'use client';

import { DISCLOSURE_OPEN_EVENT, openDisclosuresAround } from "./components/Disclosure";
import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, Suspense } from "react";
import PolicySelector from "./components/PolicySelector";
import YearSlider from "./components/YearSlider";
import LandingPage from "./components/LandingPage";
import LandingBackdrop from "./components/landing/LandingBackdrop";
import useScrollReveal from "./hooks/useScrollReveal";
import ViewTabs from "./components/ViewTabs";
import { SUB_TAB_PARAM } from "./components/SubTabs";
import SectionHeading from "./components/SectionHeading";
import { YOUNG_PEOPLE_ANCHOR } from "./utils/viewAnchors";
import PopulationImpactView from "./components/PopulationImpactView";
import TitleIcon from "./components/TitleIcon";
import { DEFAULT_DISPLAY_YEAR, DisplayYearsContext, EARLY_YEAR, selectableYearOr, yearsForSelection } from "./utils/displayYears";
import { opensLanding } from "./utils/landing";
import { useNarrowViewport } from "./utils/chartTheme";
import TitleMark, { EdgeAboutTab } from "./components/HomeButton";
import OverviewDrawer from "./components/OverviewDrawer";
import { buildMeasureCatalogue, catalogueProvisional, MeasureCatalogueProvider, useMeasureCatalogue } from "./utils/measureCatalogue";
import { dashboardFromParts, loadDashboard, loadDashboardParts, loadVerifiedTablesOnce, budgetChartData, sameParts } from "./utils/loadDashboard";
import { pruneVerifiedCache } from "./utils/publication/cache";
import { selectionPackageKey } from "./utils/geography/selection";

import { loadManifest } from "./utils/publication/load";
import { PublicationCheckContext, serialisedChecks } from "./utils/publication/check";
import UnavailableNotice, { RemoveUnavailable } from "./components/publication/UnavailableNotice";
import ViewSkeleton, { BootSkeleton } from "./components/publication/ViewSkeleton";
import { bootView } from "./utils/bootView";
import { POVERTY_FIGURES_SHOWN } from "./utils/povertyFigures";
import UpdateToast from "./components/publication/UpdateToast";
import { provisionalNotice } from "./utils/publication/manifest";
import { reportCopy } from "./utils/milburn/reportStatus";
import { isLocalBuildRoute, localBuildNotice } from "./utils/milburn/localBuild";
import LocalBuildLabel from "./components/milburn/LocalBuildLabel";
import HouseholdExamples from "./components/milburn/HouseholdExamples";
import { milburnDefaultMeasure } from "./utils/milburn/measureGroups";
import { DownloadContext, policiesLabel } from "./utils/downloadContext";
import { OPEN_VIEW_EVENT } from "./utils/methodLink";
import { lazyView, preloadViewCode } from "./utils/lazyView";
import { trackEngagement, trackEvent, trackLinkClicks } from "./utils/analytics";
import { createBandIntent, createSiteNavIntent, isProgrammaticScroll, LANDSCAPE_PHONE_QUERY, isTouchOnly, pointerWantsSiteNav, SITE_NAV_DWELL_MS, landAt, scrollBelowBars, scrollTopFor, settleHeadings } from "./utils/pageScroll";

// Each view's code (the chart library) loads when a view first opens, or while the page is idle,
// not with the page: the landing page, the band and the placeholders need
// none of it. The chart views share one chunk (components/chartViews.js);
// the text views have their own. A view whose code has loaded renders at once.
const chartViews = () => import("./components/chartViews");
const BudgetaryImpactChart = lazyView(chartViews, (m) => m.BudgetaryImpactChart);
const AgeSection = lazyView(chartViews, (m) => m.AgeSection);
const PovertyMeasuresRow = lazyView(chartViews, (m) => m.PovertyMeasuresRow);
const PolicyCards = lazyView(() => import("./components/PolicyCards"));
const NotComputableMeasures = lazyView(() => import("./components/milburn/NotComputableMeasures"));
const MethodologyTab = lazyView(() => import("./components/MethodologyTab"));
const BehaviouralScenarios = lazyView(chartViews, (m) => m.BehaviouralScenarios);
const BenchmarksTable = lazyView(() => import("./components/milburn/BenchmarksTable"));
const KeyFigures = lazyView(() => import("./components/milburn/KeyFigures"));
const headlineTiles = () => import("./components/milburn/HeadlineTiles");
const PovertyHeadline = lazyView(headlineTiles, (m) => m.PovertyHeadline);
const FinancesHeadline = lazyView(headlineTiles, (m) => m.FinancesHeadline);

// The code each view ("tab" or "tab:sub", as bootView names them) needs
const VIEW_CODE = {
  "dashboard:finances": [BudgetaryImpactChart],
  "dashboard:age": [AgeSection],
  // Withheld for now (povertyFigures.js): no sub-tab, so no code to load
  ...(POVERTY_FIGURES_SHOWN ? { "dashboard:poverty": [PovertyMeasuresRow] } : {}),
  "dashboard:scenarios": [BehaviouralScenarios],
  "dashboard:benchmarks": [BenchmarksTable],
  policies: [PolicyCards, NotComputableMeasures],
  methodology: [MethodologyTab],
};

/** Load every view's code (tests: views then render without suspending). */
export function preloadAllViews() {
  return Promise.all(Object.values(VIEW_CODE).flat().map((view) => view.preload()));
}

/** Load one view's code ("tab" or "tab:sub"); resolves when in, never rejects. */
export function preloadView(view) {
  return preloadViewCode(VIEW_CODE[view] ?? VIEW_CODE[view.split(":")[0]] ?? []);
}

// A link to a view starts that view's code now, beside the page's own,
// rather than after hydration and the publication check
if (typeof window !== "undefined" && !opensLanding(window.location)) {
  preloadView(bootView(window.location));
}

/** The placeholder a view shows while its code loads. */
function viewFallback(value) {
  if (value === "dashboard") return <ViewSkeleton view={loadingView(value)} />;
  return <ViewSkeleton view={value} />;
}

// The views, as tabs under the band. `year` and `policies` say which of
// the band's pills apply to a view; the others stay in the band, faded and
// inactive, their reason in their accessible names. Policies describes
// every measure and Methodology is text: no pill applies to them.
// Impact's sub-tabs (Young people, Poverty, Public finances, Return to
// work, Benchmarks) are in PopulationImpactView. The URL values stay as
// they were ("dashboard", "policies"); only the labels changed.
export const VIEWS = [
  { value: "dashboard", label: "Impact", year: true, policies: true },
  { value: "policies", label: "Measures", year: false, policies: false },
  { value: "methodology", label: "Methodology", year: false, policies: false },
];

const VIEW_BY_KEY = Object.fromEntries(VIEWS.map((view) => [view.value, view]));

// The accessible names' reason on a band pill that does not change the
// view shown (no visible tip)
export const YEAR_INACTIVE = "The year doesn't change this tab";
export const POLICIES_INACTIVE = "Policy choices don't change this tab";

// Old ?tab= values still opened by shared links, and the view each is now;
// the address is rewritten to the new value. The Household calculator tab
// was removed: its links open Impact.
const VIEW_ALIASES = { personal: "dashboard", household: "dashboard" };
const viewKey = (tab) => VIEW_ALIASES[tab] ?? tab;

// The view under the landing page, and the one an address with no ?tab=
// opens when it links to a section or selection (?sub=, ?policies=,
// #young-people). The bare address is the landing page (utils/landing.js);
// every view, this one included, writes its ?tab=.
const DEFAULT_VIEW = "dashboard";

const tabId = (view) => `tab-${view}`;
const panelId = (view) => `panel-${view}`;

/** Whether the band's year pill applies: on the views that use a year. */
export function yearPillShown(view) {
  return Boolean(VIEW_BY_KEY[view]?.year);
}

/**
 * Whether a page address is an old link to the Young people view
 * (#young-people or ?tab=young), now Impact's Young people
 * sub-tab.
 */
export function opensYoungPeople({ search, hash }) {
  return (
    hash === `#${YOUNG_PEOPLE_ANCHOR}` || new URLSearchParams(search).get("tab") === "young"
  );
}

/**
 * An old link to the Young people or Pensioners sub-tab (?sub=young,
 * ?sub=pensioners), now By age (?sub=age) with that group chosen (?age=):
 * the group, or null when the address is not one.
 */
export function oldAgeSubGroup({ search }) {
  const sub = new URLSearchParams(search).get(SUB_TAB_PARAM);
  if (sub === "young") return "16-24";
  if (sub === "pensioners") return "pensioners";
  return null;
}

/** The view a page address opens: an old Young people link, else ?tab=, else the default. */
export function viewFromLocation({ search, hash }) {
  if (opensYoungPeople({ search, hash })) return DEFAULT_VIEW;
  const tab = viewKey(new URLSearchParams(search).get("tab"));
  return VIEW_BY_KEY[tab] ? tab : DEFAULT_VIEW;
}


// The ui-kit shell's sticky site nav, as globals.css selects it to hide it
// until the pointer reaches the window's top (@policyengine/ui-kit 0.12.0). Kept in step with globals.css.
export const SHELL_STICKY_NAV_SELECTOR =
  '.min-h-screen.flex.flex-col > div:first-child[style*="sticky"]';
// Once shown, the site nav stays this long (unless the reader scrolls down),
// and hides this long after the pointer or focus leaves it.
export const SITE_NAV_MIN_MS = 1500;
export const SITE_NAV_LEAVE_MS = 750;

/** Take the open sub-tab (?sub=) out of the address, or put `sub` there. */
function dropSubTab(sub, extra = {}) {
  const params = new URLSearchParams(window.location.search);
  if (!sub && !params.has(SUB_TAB_PARAM)) return;
  if (sub) params.set(SUB_TAB_PARAM, sub);
  else params.delete(SUB_TAB_PARAM);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  const search = params.toString();
  window.history.replaceState(
    {},
    "",
    `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`,
  );
}

// With no Budget results to show: the page's shell and the views that need
// none (Living standards, Methodology) still render
const NOTHING_PUBLISHED = Object.freeze({
  status: "no-manifest", catalogue: buildMeasureCatalogue(),
  budgetary: [], distributional: [], winnersLosers: [], metrics: [],
});

// The views whose figures come from the publication
const BUDGET_VIEWS = new Set(["dashboard"]);

// The placeholder for a Budget view while its results load: the linked
// sub-tab's on Impact (bootView), as the server's HTML drew it
function loadingView(value) {
  if (value !== "dashboard") return value;
  const linked = typeof window === "undefined" ? "dashboard:finances" : bootView(window.location);
  return linked.startsWith("dashboard:") ? linked : "dashboard:finances";
}

// The tables no first view waits for, loaded when the page is idle
const IDLE_TABLES = ["age_impact"];

function whenIdle(run) {
  if (typeof window === "undefined") return undefined;
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(run, { timeout: 2000 });
    return () => window.cancelIdleCallback?.(handle);
  }
  const handle = setTimeout(run, 200);
  return () => clearTimeout(handle);
}

const requestedPolicies = (requested) =>
  requested === null ? [] : [...new Set(requested.split(",").map((id) => id.trim()).filter(Boolean))];

function Dashboard({ published, unavailable = null, updated = false, fromBuild = false, checkedBy = "page" }) {
  const catalogue = useMeasureCatalogue();
  const POLICIES = catalogue.measures;
  // A link's ?policies= is a chosen selection. Without one the selection is
  // the default, every displayable measure, and follows the publication.
  // With the build's figures the first render is the server's (hydration),
  // which knows no address: the link's selection is read before paint, with
  // the rest of the address, below.
  const readRequested = () => typeof window === "undefined" || !catalogue.manifest ? null : new URLSearchParams(window.location.search).get("policies");
  const requested = fromBuild ? null : readRequested();
  // One policy at a time while the publication has no combined run of the
  // whole package (no published run adds the measures up), on the
  // population tabs only: the picker is single-select there, the default
  // the first measure in the catalogue's order, and a link naming several
  // opens on the first of them. Once a combined run is published it is
  // multi-select again, by itself.
  const singleSelect = Boolean(catalogue.manifest) && catalogue.displayable.length > 1 && !catalogue.combinedId;
  // A link's ?policies= is the open tab's own choice while single-select:
  // on Impact (or the landing page) the one policy; on a tab the policies
  // do not change, both. An old ?tab= value counts as the view it opens.
  const linkTab = () => (typeof window === "undefined" ? null : viewKey(new URLSearchParams(window.location.search).get("tab")));
  const linkSetsHousehold = (link) => link !== null && (!singleSelect || (linkTab() !== null && linkTab() !== "dashboard"));
  const linkSetsOne = (link) => link !== null && singleSelect;
  const [chosenPolicies, setChosenPolicies] = useState(() => (linkSetsHousehold(requested) ? requestedPolicies(requested) : []));
  const [selectionChosen, setSelectionChosen] = useState(() => linkSetsHousehold(requested));
  // The population tabs' one policy while single-select (below): its own
  // choice, so the multi-policy selection is kept beside it
  const [chosenOne, setChosenOne] = useState(() => (linkSetsOne(requested) ? requestedPolicies(requested) : []));
  // The default is derived, never stored: an artifact that verifies later
  // under the same manifest joins it, as on a fresh load (review of
  // 3d52cff, finding 1). A newer manifest remounts the view instead.
  // Every displayable measure: the default, and the Policies tab's cards
  // whatever is chosen
  const defaultPolicies = useMemo(() => catalogue.displayable.map((measure) => measure.id), [catalogue]);
  const allPolicyIds = defaultPolicies;
  // A withdrawn measure in a link or a kept selection drops out silently;
  // the address writer below then rewrites ?policies= without it.
  // The multi-policy selection: every policy by default, any several
  const multiPolicies = useMemo(() => {
    const chosen = selectionChosen ? chosenPolicies : defaultPolicies;
    return catalogue.withdrawn?.size ? chosen.filter((id) => !catalogue.withdrawn.has(id)) : chosen;
  }, [selectionChosen, chosenPolicies, defaultPolicies, catalogue]);
  // The population tabs' selection: the same, or while single-select one
  // policy, its own choice (the first a link names, in the catalogue's
  // order), else the first in the catalogue's order
  const selectedPolicies = useMemo(() => {
    if (!singleSelect) return multiPolicies;
    const kept = catalogue.withdrawn?.size ? chosenOne.filter((id) => !catalogue.withdrawn.has(id)) : chosenOne;
    const first = catalogue.displayable.find((measure) => kept.includes(measure.id));
    if (first) return [first.id];
    // A link naming only an unavailable policy keeps it, so the page says
    // it is unavailable rather than swapping in another
    if (kept.length) return [kept[0]];
    // On the local build route, the first run the selector offers (the full
    // abolition package), not the catalogue's first (the largest saving)
    const fallback = catalogue.localBuild ? milburnDefaultMeasure(catalogue.displayable) : catalogue.displayable[0];
    return fallback ? [fallback.id] : [];
  }, [singleSelect, multiPolicies, chosenOne, catalogue]);
  // Once the first view has painted, every other view's tables load and
  // verify while the page is idle, so a tab switch need not wait
  useEffect(() => {
    if (!catalogue.manifest || !catalogue.tablesByKey) return undefined;
    // One step per idle period, the views' own tables first
    const steps = [
      // Every view's code, so a tab switch need not wait for it
      ...Object.keys(VIEW_CODE).map((view) => () => preloadView(view)),
      ...IDLE_TABLES.map((table) => () => loadVerifiedTablesOnce(catalogue, table).catch(() => {})),
      () => pruneVerifiedCache().catch(() => {}),
    ];
    let cancel;
    const next = () => {
      const step = steps.shift();
      if (!step) return;
      cancel = whenIdle(() => {
        Promise.resolve(step()).finally(next);
      });
    };
    // Not before the opened view's own code is in: on a slow connection the
    // prefetches would otherwise share the line with it
    const opened = opensLanding(window.location) ? Promise.resolve() : preloadView(bootView(window.location));
    opened.then(next);
    return () => {
      steps.length = 0;
      cancel?.();
    };
  }, [catalogue]);
  const [distributionalYear, setDistributionalYear] = useState(DEFAULT_DISPLAY_YEAR);
  const [activeTab, setActiveTab] = useState(DEFAULT_VIEW);
  const [locationReady, setLocationReady] = useState(false);
  // The landing page (LandingPage.jsx), at the bare address only, over the
  // default view (Public finances), which stays mounted behind it, faded
  // and inert. Choosing any view leaves it.
  const [landing, setLanding] = useState(true);
  // The overview drawer, opened by the "About" tab on the window's edge,
  // or first in the view tabs row on a phone, whose margin has no room for
  // a side tab (HomeButton.jsx)
  const [overviewOpen, setOverviewOpen] = useState(false);
  const aboutTabRef = useRef(null);
  const aboutInRow = useNarrowViewport();
  const closeOverview = useCallback(() => setOverviewOpen(false), []);
  const PRESETS = [{ id: "milburn-package", name: "All measures" }];
  // Cards fade and rise in as they scroll into view
  const mainRef = useRef(null);
  useScrollReveal(mainRef);
  // The views opened so far: each stays mounted once opened, hidden while
  // another is shown, so its state, open expanders and any calculation in
  // flight carry on. None is mounted for the landing page, so it paints
  // and settles without them; the first opens with the first box or tab.
  const [visited, setVisited] = useState([]);
  if (!landing && !visited.includes(activeTab)) setVisited([...visited, activeTab]);

  // The server and first hydrated render share the default shell. Read the
  // browser address before paint, and only then allow the URL writer below.
  useLayoutEffect(() => {
    // An old link to the Young people view opens its sub-tab; the hash
    // stays, so the page scrolls to the section
    const view = viewFromLocation(window.location);
    // (By age, with 16 to 24 chosen; an old Pensioners sub-tab link opens
    // By age with pensioners chosen)
    const oldGroup = oldAgeSubGroup(window.location);
    if (opensYoungPeople(window.location)) dropSubTab("age", { age: "16-24" });
    else if (oldGroup) dropSubTab("age", { age: oldGroup });
    setLanding(opensLanding(window.location));
    setActiveTab(view);
    // A shared link's ?year= opens that year; one not offered opens the
    // default. 2026-27 is kept here and dropped below if the selection has
    // no effect in it
    const askedYear = new URLSearchParams(window.location.search).get("year");
    if (askedYear !== null) setDistributionalYear(Number(askedYear) === EARLY_YEAR ? EARLY_YEAR : selectableYearOr(askedYear));
    if (fromBuild) {
      const linked = readRequested();
      if (linked !== null) {
        if (linkSetsOne(linked)) setChosenOne(requestedPolicies(linked));
        if (linkSetsHousehold(linked)) {
          setChosenPolicies(requestedPolicies(linked));
          setSelectionChosen(true);
        }
      }
    }
    setLocationReady(true);
    // Once, on mount: the address as the page opened
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!locationReady) return;
    const params = new URLSearchParams(window.location.search);
    if (landing) params.delete("tab");
    else params.set("tab", activeTab);
    if (!unavailable) {
      // A chosen selection, an empty one included, stays in the address on
      // every view, so a later snapshot's remount restores exactly it: a
      // withdrawn measure shows as unavailable rather than dropping out,
      // and a newly published one is not added unasked. The default stays
      // out of the address, so a remount shows every measure then
      // displayable, a newly published one included.
      // (not on the landing page, whose address is the bare one; the
      // selection comes back to the address with the next view)
      // The open tab's own selection. One policy at a time on the population
      // tabs: the address always names it, so a shared link opens on it
      // Single-select: Impact always names its one policy; another tab the
      // chosen selection, else a chosen one policy
      if (landing) params.delete("policies");
      else if (singleSelect && activeTab === "dashboard") params.set("policies", selectedPolicies.join(","));
      else if (selectionChosen) params.set("policies", multiPolicies.join(","));
      else if (singleSelect && chosenOne.length > 0) params.set("policies", selectedPolicies.join(","));
      else params.delete("policies");
    }
    // The year chosen in the header, so a shared link opens on it; the
    // default stays out of the address, as the selection's does
    if (!landing && distributionalYear !== DEFAULT_DISPLAY_YEAR) params.set("year", String(distributionalYear));
    else params.delete("year");
    window.history.replaceState({}, "", `${window.location.pathname}${params.size ? `?${params}` : ""}${window.location.hash}`);
  }, [selectedPolicies, multiPolicies, selectionChosen, singleSelect, chosenOne, activeTab, landing, locationReady, unavailable, distributionalYear]);

  // The years shown: 2026-27 first only while a selected policy has an
  // effect in it (yearsForSelection)
  const shownYears = useMemo(() => yearsForSelection(published.budgetary, selectedPolicies), [published, selectedPolicies]);
  // A year no longer shown (2026-27 after its last policy is deselected)
  // falls back to the default, once the published figures are in (set
  // while rendering, as `visited` is above)
  if (published.budgetary?.length && !shownYears.includes(distributionalYear)) setDistributionalYear(DEFAULT_DISPLAY_YEAR);
  const results = useMemo(() => ({
    // The net line from the selected policies' combined run when one is
    // published, else the bars' sum
    budgetData: budgetChartData(published.budgetary, catalogue.displayable, selectedPolicies, shownYears, selectionPackageKey(catalogue.manifest, selectedPolicies)),
    // Every verified run's rows: the summary statistics read one run, not a
    // sum; an artifact's poverty_inequality table is merged into its rows
    rawMetrics: published.metrics,
  }), [published, catalogue, selectedPolicies, shownYears]);

  const handlePolicyToggle = (policyId) => {
    if (!catalogue.byId.get(policyId)?.displayable) return;
    // One at a time on the population tabs: picking a policy selects only it
    if (singleSelect) {
      setChosenOne([policyId]);
      return;
    }
    setChosenPolicies(multiPolicies.includes(policyId) ? multiPolicies.filter((id) => id !== policyId) : [...multiPolicies, policyId]);
    setSelectionChosen(true);
  };
  // Select all and Clear: the whole selection in one update (a run of
  // toggles read the same render's selection, so only the last one stuck)
  const handlePoliciesSet = (ids) => {
    setChosenPolicies(ids.filter((id) => catalogue.byId.get(id)?.displayable));
    setSelectionChosen(true);
  };
  // The one preset is the default, every displayable measure, so choosing
  // it hands the selection back to the publication
  const handlePresetClick = () => {
    setSelectionChosen(false);
  };
  // Only on the reader's request: an unavailable measure leaves the selection
  const removeFromSelection = (ids) => {
    setChosenPolicies(multiPolicies.filter((id) => !ids.includes(id)));
    setSelectionChosen(true);
  };

  const titleSentinelRef = useRef(null);
  const [titleStuck, setTitleStuck] = useState(false);
  useEffect(() => {
    const sentinel = titleSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(([entry]) =>
      setTitleStuck(!entry.isIntersecting),
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // The site nav is in the page's flow at its top (globals.css), so it is
  // in view on load above the title band and a scroll down takes it away
  // with the page. Scrolling never brings it back: once it has scrolled
  // away it slides in above the band when the pointer rests at the top
  // edge of the window (SITE_NAV_EDGE_PX for SITE_NAV_DWELL_MS:
  // utils/pageScroll pointerWantsSiteNav), or when the reader tabs into it
  // (globals.css: data-site-nav-shown on <html>, --site-nav-height; the
  // band and tab rows move down under it, so it never covers the Year and
  // Policies pills; the slide is instant under reduced motion). Once in, it stays
  // SITE_NAV_MIN_MS, and while the pointer or focus is in it or one of its
  // menus is open, then hides SITE_NAV_LEAVE_MS after they leave. Any
  // scroll down by the reader hides it at once (unless it is in use), and
  // within its own height of the page's top it goes back to its place in
  // the flow. A touch-only device has no pointer to bring it in with: there
  // it shows only while the page is at its very top (createSiteNavIntent).
  useEffect(() => {
    const root = document.documentElement;
    const nav = document.querySelector(SHELL_STICKY_NAV_SELECTOR);
    const measure = () => {
      if (nav) root.style.setProperty("--site-nav-height", `${nav.offsetHeight}px`);
    };
    measure();
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (nav) resize?.observe(nav);
    const intent = createSiteNavIntent({ y: window.scrollY });
    let frame = 0;
    let shownAt = 0;
    let timer = 0;
    // The pointer resting at the window's top edge, before the nav shows
    let edgeTimer = 0;
    let pointerIn = false;
    let touchY = null;
    // Touch-only, at the page's very top: shown for as long as it stays there
    let pinned = false;
    const isShown = () => root.hasAttribute("data-site-nav-shown");
    // The ui-kit menus (About, country) put a full-window overlay with
    // role="presentation" inside the nav while they are open
    const holds = () =>
      !!nav &&
      (pointerIn ||
        pinned ||
        nav.contains(document.activeElement) ||
        !!nav.querySelector('[role="presentation"]'));
    const clear = () => {
      if (timer) window.clearTimeout(timer);
      timer = 0;
    };
    const hideAfter = (delay) => {
      if (!isShown()) return;
      clear();
      const wait = Math.max(delay, shownAt + SITE_NAV_MIN_MS - Date.now());
      timer = window.setTimeout(() => {
        timer = 0;
        if (holds()) hideAfter(SITE_NAV_LEAVE_MS);
        else root.removeAttribute("data-site-nav-shown");
      }, wait);
    };
    const show = () => {
      clear();
      shownAt = Date.now();
      root.setAttribute("data-site-nav-shown", "");
      hideAfter(SITE_NAV_MIN_MS);
    };
    const hideNow = () => {
      if (!isShown() || holds()) return;
      clear();
      root.removeAttribute("data-site-nav-shown");
    };
    const follow = (what) => {
      if (what === "show") show();
      else if (what === "hide") hideNow();
    };
    const check = () => {
      frame = 0;
      const y = window.scrollY;
      // A scroll the page made (utils/pageScroll) is not the reader's: it
      // never hides the nav. Near the page's top the nav is hidden, so the
      // top looks as it does on load (unless the pointer or focus is in
      // it), whoever scrolled; on a touch-only device it is in only at the
      // very top
      const top = nav?.offsetHeight || 0;
      const programmatic = isProgrammaticScroll(y);
      const touchOnly = isTouchOnly();
      pinned = touchOnly && y <= 0;
      follow(intent.scroll(y, performance.now(), { programmatic, top, touchOnly }));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(check);
    };
    // The reader's own scrolling input, and which way it goes
    const onWheel = (event) => {
      if (event.ctrlKey || !event.deltaY) return;
      follow(intent.input("wheel", event.deltaY < 0 ? "up" : "down", performance.now()));
    };
    const KEYS_UP = new Set(["ArrowUp", "PageUp", "Home"]);
    const KEYS_DOWN = new Set(["ArrowDown", "PageDown", "End"]);
    const onKey = (event) => {
      // Keys typed into a field, or moving a slider, do not scroll the page
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable]")) return;
      const up = KEYS_UP.has(event.key) || (event.key === " " && event.shiftKey);
      const down = KEYS_DOWN.has(event.key) || (event.key === " " && !event.shiftKey);
      if (up || down) follow(intent.input("key", up ? "up" : "down", performance.now()));
    };
    const onTouchStart = (event) => {
      touchY = event.touches[0]?.clientY ?? null;
    };
    // A finger moving down the screen scrolls the page up
    const onTouchMove = (event) => {
      const y = event.touches[0]?.clientY;
      if (y === undefined || touchY === null || y === touchY) return;
      follow(intent.input("touch", y > touchY ? "up" : "down", performance.now()));
      touchY = y;
    };
    // Held on the window's scrollbar (right of the page's content box)
    const onPointerDown = (event) => {
      if (event.clientX >= root.clientWidth) intent.input("drag", "hold", performance.now());
    };
    const onPointerUp = () => intent.input("drag", "release", performance.now());
    const onPointer = (event) => {
      // A tap's emulated mouse events do not count on a touch-only device
      if (isTouchOnly()) return;
      // Over the nav, or over the title band it pushes down (the Year and
      // Policies pills), so the band never jumps back from under the pointer
      const bandHeight = document.querySelector(".title-row")?.offsetHeight ?? 0;
      const over =
        !!nav &&
        isShown() &&
        ((event.target instanceof Node && nav.contains(event.target)) ||
          event.clientY <= nav.offsetHeight + bandHeight);
      if (pointerWantsSiteNav(event.clientY)) {
        if (isShown()) {
          pointerIn = true;
          show();
        } else if (!edgeTimer) {
          edgeTimer = window.setTimeout(() => {
            edgeTimer = 0;
            pointerIn = true;
            show();
          }, SITE_NAV_DWELL_MS);
        }
        return;
      }
      if (edgeTimer) {
        window.clearTimeout(edgeTimer);
        edgeTimer = 0;
      }
      if (over) {
        if (!pointerIn) clear();
        pointerIn = true;
      } else if (pointerIn) {
        pointerIn = false;
        hideAfter(SITE_NAV_LEAVE_MS);
      }
    };
    // The pointer leaving the window (toward the tabs and address bar)
    // before the rest is up: the nav does not open behind it (HDR1)
    const onPointerOut = (event) => {
      if (event.relatedTarget || !edgeTimer) return;
      window.clearTimeout(edgeTimer);
      edgeTimer = 0;
    };
    const onFocusIn = () => show();
    const onFocusOut = (event) => {
      if (!(nav && event.relatedTarget instanceof Node && nav.contains(event.relatedTarget))) {
        hideAfter(SITE_NAV_LEAVE_MS);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("mousemove", onPointer, { passive: true });
    document.addEventListener("mouseout", onPointerOut, { passive: true });
    nav?.addEventListener("focusin", onFocusIn);
    nav?.addEventListener("focusout", onFocusOut);
    // On a touch-only device the nav is in at the page's top from the start
    check();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("mousemove", onPointer);
      document.removeEventListener("mouseout", onPointerOut);
      nav?.removeEventListener("focusin", onFocusIn);
      nav?.removeEventListener("focusout", onFocusOut);
      if (frame) window.cancelAnimationFrame(frame);
      if (edgeTimer) window.clearTimeout(edgeTimer);
      clear();
      resize?.disconnect();
      root.removeAttribute("data-site-nav-shown");
      root.style.removeProperty("--site-nav-height");
    };
  }, []);

  // The first load (?tab=&sub=, a #hash) and back/forward land with the
  // target, and every section heading, clear of the sticky bars: the
  // page places itself (utils/pageScroll), not the browser's restore
  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    let timer = 0;
    const land = () => {
      window.clearTimeout(timer);
      // The views load their data after mounting: give them a moment
      timer = window.setTimeout(() => {
        const id = decodeURIComponent(window.location.hash.slice(1));
        const target = id ? document.getElementById(id) : null;
        if (target) scrollBelowBars(target);
        else settleHeadings();
      }, 600);
    };
    land();
    window.addEventListener("popstate", land);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", land);
    };
  }, []);

  // globals.css moves the ui-kit site nav with a selector written
  // against the shell's markup. Say so in development if it stops matching.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (!document.querySelector(SHELL_STICKY_NAV_SELECTOR)) {
      console.warn(
        "The ui-kit site nav was not found by SHELL_STICKY_NAV_SELECTOR; " +
          "update it in App.jsx and globals.css so the site nav hides on scroll down.",
      );
    }
  }, []);

  // A link to #young-people from elsewhere on the page opens Impact
  // impact's Young people sub-tab (PopulationImpactView shows it if open)
  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash === `#${YOUNG_PEOPLE_ANCHOR}`) {
        dropSubTab("age", { age: "16-24" });
        setLanding(false);
        setActiveTab(DEFAULT_VIEW);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // The tab bar's place in the page, before it sticks under the band
  const tabsSentinelRef = useRef(null);
  // Once the reader scrolls past it, the view tabs (and a sub-tab band)
  // stick under the title row in a compact form (globals.css,
  // data-tabs-stuck). The sentinel sits above the bar, so the bar's own
  // change of height never flips this back.
  const [tabsStuck, setTabsStuck] = useState(false);
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const sentinel = tabsSentinelRef.current;
      const app = appRef.current;
      if (!sentinel || !app) return;
      const style = getComputedStyle(app);
      const band =
        (parseFloat(style.getPropertyValue("--nav-offset")) || 0) +
        (parseFloat(style.getPropertyValue("--title-row-height")) || 0);
      setTabsStuck(sentinel.getBoundingClientRect().top < band - 1);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  // On a phone on its side the title band tucks away above the window
  // while the reader scrolls down and slides back on a scroll up, so the
  // bars do not take half the window (globals.css, data-band-hidden;
  // utils/pageScroll createBandIntent). Never while one of its pills is
  // open or focused, nor near the page's top. Elsewhere it stays in view.
  const [bandHidden, setBandHidden] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia(LANDSCAPE_PHONE_QUERY);
    const intent = createBandIntent({ y: window.scrollY });
    let frame = 0;
    const check = () => {
      frame = 0;
      const y = window.scrollY;
      if (!query.matches) {
        intent.scroll(y, { held: true });
        setBandHidden(false);
        return;
      }
      const sentinel = titleSentinelRef.current;
      const band = document.querySelector(".title-row");
      // The band's own place: until the page has scrolled past it, it is
      // not stuck, so there is nothing to tuck away
      const top = sentinel ? sentinel.getBoundingClientRect().top + y + (band?.offsetHeight ?? 0) : 0;
      const held =
        !!band &&
        (band.contains(document.activeElement) || !!band.querySelector('[aria-expanded="true"]'));
      const next = intent.scroll(y, { top, held, programmatic: isProgrammaticScroll(y) });
      if (next !== null) setBandHidden(next);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(check);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    query.addEventListener?.("change", onScroll);
    // A pill opened from the tucked band's edge brings it back
    document.addEventListener("focusin", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      query.removeEventListener?.("change", onScroll);
      document.removeEventListener("focusin", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  // Switch view. If the reader had scrolled past the tabs, bring the new
  // view's top up under them, so it does not open part way down. The band
  // can change height with the view (compact on a phone when the view has
  // no year pill), so this runs once the new view is laid out.
  const appRef = useRef(null);
  const tabScrollPending = useRef(false);
  // Each view's scroll position when it was left, to return to it
  const tabScroll = useRef({});
  // `sub` opens the new view at one of its sub-tabs (Methodology's links).
  const handleTabChange = (requested, sub, extra) => {
    const tab = viewKey(requested);
    // Leaving the landing page opens the view even when it is the one
    // behind it (a box, or the Impact tab)
    const changing = tab !== activeTab || landing;
    // A sub-tab (?sub=, SubTabs.jsx) belongs to the view that wrote it, so
    // it goes before another view opens and reads the address
    if (changing) {
      dropSubTab(sub, extra);
      if (!landing) tabScroll.current[activeTab] = window.scrollY;
    }
    setLanding(false);
    setActiveTab(tab);
    if (changing) trackEvent("view_opened", { view: tab, sub: sub ?? undefined });
    // A hash that belongs to the Young people sub-tab goes when another view
    // is chosen, so the address never opens a different view from this one
    if (tab !== DEFAULT_VIEW && window.location.hash === `#${YOUNG_PEOPLE_ANCHOR}`) {
      window.history.replaceState({}, "", window.location.pathname + window.location.search);
    }
    // Choosing the open view changes nothing, so there is nothing to keep
    tabScrollPending.current = changing;
  };
  // A card's link to Methodology (utils/methodLink): switch to it in place,
  // then bring the term or section into view, opening any folded details
  // it sits in
  const openViewRef = useRef(handleTabChange);
  useEffect(() => {
    openViewRef.current = handleTabChange;
  });
  // Clicks on the report's download, our posts and other sites, and how
  // far and how long people stay (utils/analytics.js)
  useEffect(() => trackLinkClicks(), []);
  useEffect(() => trackEngagement(), []);
  useEffect(() => {
    const onOpenView = (event) => {
      const { tab, anchor } = event.detail || {};
      if (!tab) return;
      openViewRef.current(tab);
      if (!anchor) return;
      window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}#${anchor}`);
      // The view mounts, and some of its parts load their data, after the
      // switch: look for the target for up to 3 seconds
      let tries = 0;
      const find = () => {
        const target = document.getElementById(anchor);
        if (!target) {
          if ((tries += 1) < 30) setTimeout(find, 100);
          return;
        }
        // Opens folded details and the Methodology topics (Disclosure) it
        // sits in, the target itself included, then scrolls once they open
        openDisclosuresAround(target);
        target.dispatchEvent(new CustomEvent(DISCLOSURE_OPEN_EVENT));
        scrollBelowBars(target);
        setTimeout(() => scrollBelowBars(target), 350);
      };
      setTimeout(find, 100);
    };
    window.addEventListener(OPEN_VIEW_EVENT, onOpenView);
    return () => window.removeEventListener(OPEN_VIEW_EVENT, onOpenView);
  }, []);
  // A Policies card's "See its effect": Impact with only that
  // measure selected (the address then carries ?policies=<id>)
  const handleShowEffect = (policyId) => {
    // One at a time: the population tabs' own choice, the selection kept
    if (singleSelect) setChosenOne([policyId]);
    else {
      setChosenPolicies([policyId]);
      setSelectionChosen(true);
    }
    // Open on a year the measure moves revenue in: one in force in a single
    // later year opened on 2027-28 showed only empty charts, and the
    // household energy payment (winter 2026-27) opens on 2026-27
    const moves = (year) =>
      published.budgetary.some((row) => row.reform_id === policyId && Number(row.year) === year && Math.abs(Number(row.value)) > 0.0005);
    if (!moves(distributionalYear)) {
      const first = yearsForSelection(published.budgetary, [policyId]).find(moves);
      if (first !== undefined) setDistributionalYear(first);
    }
    handleTabChange("dashboard");
  };
  useLayoutEffect(() => {
    if (!tabScrollPending.current) return;
    tabScrollPending.current = false;
    const sentinel = tabsSentinelRef.current;
    if (!sentinel || !appRef.current) return;
    // Where the tabs sit right under the bars above them, measured from
    // the bars as they are (utils/pageScroll). That scroll is the page's,
    // so the site nav stays as it is; at the page's top it goes if shown.
    const top = scrollTopFor(sentinel, { gap: 0, above: sentinel });
    // A view opened before returns to where it was left, if that was below
    // the tabs; otherwise the tabs come back up under the band. (At the
    // page's top, where a shown nav cannot be cleared, the second branch
    // takes it away.)
    const saved = tabScroll.current[activeTab];
    if (saved !== undefined && saved > Math.max(0, top)) landAt(saved);
    else scrollBelowBars(sentinel, { gap: 0, above: true, onlyUp: true });
  }, [activeTab, landing]);

  // An explicit URL selection is never silently narrowed into another
  // selection. Impact with an unavailable member has no complete set of Budget figures.
  // Each opened view stays mounted, so the check is per view, not for the
  // open one only.
  const unavailableIds = selectedPolicies.filter((id) => !catalogue.byId.get(id)?.displayable);
  const selectionUnavailable = unavailableIds.length ? {
    reason: "Some selected policies are unavailable",
    // One line inside the view: each selected measure and why it is out
    // (a withdrawn one never reaches here; it drops from the selection)
    detail: unavailableIds.map((id) => {
      const measure = catalogue.byId.get(id);
      return `${measure?.name ?? id} (${measure?.availability.reason || "Not yet published"})`;
    }).join("; "),
  } : null;
  const viewUnavailable = (value) => unavailable ?? (value === "dashboard" ? selectionUnavailable : null);
  // The views with sub-tabs open into their band (SubTabs); not while
  // Impact shows its unavailable notice instead, nor on the
  // landing page, where no view tab is chosen
  const hasSubTabs = !landing && activeTab === "dashboard" && !viewUnavailable("dashboard");

  const view = VIEW_BY_KEY[activeTab] ?? VIEW_BY_KEY[DEFAULT_VIEW];
  // Both pills show on the landing page: the band stays the same from the
  // start, and they drive the view behind it
  const yearShown = landing || yearPillShown(activeTab);
  const policiesShown = landing || view.policies;

  // A caveat on the results while any shown measure is provisional: one
  // small badge on the landing page, nowhere above the views
  const provisional = catalogueProvisional(catalogue);
  // The notice shown for it: the candidate label before the Budget, none
  // for Budget-day statement figures
  const notice = catalogue.localBuild ? localBuildNotice(catalogue.localBuild) : provisional ? provisionalNotice(catalogue.manifest) : "";

  // What a downloaded chart says it shows (ChartDownloadMenu's frame): the
  // band's policies on the views it drives, the provisional label while
  // any shown measure is provisional
  const downloadContext = (value) =>
    VIEW_BY_KEY[value]?.policies
      ? {
          policies: policiesLabel(selectedPolicies, POLICIES),
          provisional: notice || null,
        }
      : { policies: null, provisional: null };

  // Which policies the charts show, when not all (under Impact
  // impact's sub-tabs)
  // Not on the Milburn route: the header's policy button already names the one run shown
  const showingLine = !catalogue.localBuild && selectedPolicies.length > 0 &&
    selectedPolicies.length < POLICIES.length && (
      <p className="showing-line milburn-status-chip">
        <TitleIcon name="layers" bare size={14} />
        <span className="visually-hidden">Showing: </span>
        {selectedPolicies.length === 1
          ? POLICIES.find((policy) => policy.id === selectedPolicies[0])?.name
          : `${selectedPolicies.length} of ${POLICIES.length} policies`}
      </p>
    );

  // With no policies chosen, the policy-driven views offer the full Budget
  const emptyState = (
    <div className="empty-state">
      <p>
        Select policies to analyse their impact on government revenue and
        household incomes.
      </p>
      <div className="preset-buttons">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            className="preset-button"
            onClick={handlePresetClick}
          >
            {preset.name}
          </button>
        ))}
      </div>
    </div>
  );


  // A Impact sub-tab's content. With no policies chosen, each
  // offers the full Budget; the charts wait for the CSVs.
  // Each sub-tab's code loads when it first opens (lazyView), its
  // placeholder showing meanwhile
  const populationPanel = (sub) => (
    <Suspense fallback={<ViewSkeleton view={`dashboard:${sub}`} subTabs={false} />}>
      {populationContent(sub)}
    </Suspense>
  );
  const populationContent = (sub) => {
    // Illustrative and reference material: neither follows the band's
    // selection or year (each says what it reads)
    if (sub === "scenarios") return <BehaviouralScenarios selectedRun={selectedPolicies.length === 1 ? selectedPolicies[0] : undefined} />;
    if (sub === "benchmarks") return <BenchmarksTable />;
    if (selectedPolicies.length === 0) return emptyState;
    // The sub-tab is not offered while the poverty figures are withheld
    // (povertyFigures.js); this keeps it from rendering if asked for anyway
    if (sub === "poverty") {
      if (!results || !POVERTY_FIGURES_SHOWN) return null;
      return (
        <div className="results-container">
          <SectionHeading
            icon="lifebuoy"
            title="How the policies change poverty"
            subtitle="Change in poverty rates with the selected policies."
          />
          <PovertyHeadline runId={selectedPolicies.length === 1 ? selectedPolicies[0] : undefined} />
          {/* The change by year beside which measures move it */}
          <section id="poverty" className="report-section">
            <PovertyMeasuresRow
              rows={results.rawMetrics}
              policies={POLICIES}
              selectedPolicies={selectedPolicies}
              selectedYear={distributionalYear}
            />
          </section>
        </div>
      );
    }
    if (sub === "age") {
      // By age: every age group, pensioners and all ages, one group chosen
      // (?age=); the Young people and Pensioners sub-tabs were here
      // On the local build route, the selected run's key figures first
      // (milburn_summary.json; the full package unless one run is chosen)
      return (
        <>
          {catalogue.localBuild && (
            <div className="results-container milburn-key-wrap">
              <KeyFigures
                runId={selectedPolicies.length === 1 ? selectedPolicies[0] : undefined}
              />
            </div>
          )}
          <AgeSection
            selectedPolicies={selectedPolicies}
            selectedYear={distributionalYear}
            policies={POLICIES}
          />
        </>
      );
    }
    if (!results) return null;
    if (sub === "finances") {
      return (
        <div className="results-container">
          <SectionHeading
            icon="banknote"
            title="Public finances"
            subtitle="Net effect on revenue and spending, by year."
          />
          <FinancesHeadline runId={selectedPolicies.length === 1 ? selectedPolicies[0] : undefined} selectedYear={distributionalYear} />
          <section id="revenue" className="report-section hero-chart">
            <BudgetaryImpactChart data={results.budgetData} selectedYear={distributionalYear} selectedPolicies={selectedPolicies} />
          </section>
        </div>
      );
    }
    return null;
  };

  return (
    <DisplayYearsContext.Provider value={shownYears}>
    {/* A view without the year pill has a one-row band on a phone */}
    <div
      className="app"
      ref={appRef}
      data-sub-band={hasSubTabs ? "" : undefined}
      data-tabs-stuck={tabsStuck ? "" : undefined}
      data-band-hidden={bandHidden ? "" : undefined}
      data-publication={unavailable ? "unavailable" : "verified"}
      data-publication-check={checkedBy}>
      {/* A div, not <main>: the PolicyEngine shell around the page is the
          main landmark, and a second one inside it is a landmark error */}
      <div className="main-content" ref={mainRef}>
        {/* The title row is the page's sticky header: it docks at the top
            once the reader scrolls past it, compact, with the policy
            selector still in reach. The sentinel tells it when it is stuck. */}
        <div ref={titleSentinelRef} className="title-sentinel" aria-hidden="true" />
        <div className={`title-row ${titleStuck ? "is-stuck" : ""}`}>
          <div className="title-head">
            <TitleMark />
            <h1>Milburn review: young people and work</h1>
          </div>

          {/* The year applies to every chart on Impact, and the revenue
              chart highlights it; it lives in the band so it can be changed
              from anywhere. The policy pill applies to Impact. A pill that does
              not apply stays in its place, faded, and does not open; its
              reason is in its accessible name only. Both are on every view, so the band never moves. */}
          <div className={`band-year${yearShown ? "" : " is-inactive"}`}>
            <YearSlider
              years={shownYears}
              selectedYear={distributionalYear}
              onYearChange={setDistributionalYear}
              inactiveReason={yearShown ? undefined : YEAR_INACTIVE}
            />
          </div>
          <div className={`band-policy${policiesShown ? "" : " is-inactive"}`}>
            <PolicySelector
              policies={POLICIES}
              selectedPolicies={selectedPolicies}
              onPolicyToggle={handlePolicyToggle}
              onPoliciesSet={handlePoliciesSet}
              single={singleSelect}
              loading={Boolean(unavailable?.loading)}
              noneReason={unavailable?.reason}
              inactiveReason={policiesShown ? undefined : POLICIES_INACTIVE}
            />
          </div>
        </div>

        {/* A newer publication replaced the figures: a passing note, once */}
        <UpdateToast show={updated} />

        <div ref={tabsSentinelRef} className="view-tabs-sentinel" aria-hidden="true" />
        {/* "About": a tab on the window's left edge that opens the
            overview drawer (below) from the same edge; on a phone, first
            in the view tabs row */}
        {!landing && !aboutInRow && (
          <EdgeAboutTab open={overviewOpen} onToggle={() => setOverviewOpen((was) => !was)} buttonRef={aboutTabRef} />
        )}
        <ViewTabs
          leading={!landing && aboutInRow && (
            <EdgeAboutTab placement="row" open={overviewOpen} onToggle={() => setOverviewOpen((was) => !was)} buttonRef={aboutTabRef} />
          )}
          tabs={VIEWS}
          value={landing ? null : activeTab}
          onChange={handleTabChange}
          tabId={tabId}
          panelId={panelId}
          notch={hasSubTabs}
          // On the landing page its three boxes are the navigation; the
          // tabs appear once a view opens
          hidden={landing}
        />

        {/* A link to a view, before the page's code opens it: the landing
            page is hidden (LandingPage.css), so placeholders show instead */}
        {landing && <BootSkeleton viewTabs={VIEWS} />}
        <div className={`view-stage${landing ? " is-landing" : ""}`}>
        {landing && (
          <LandingPage
            onOpen={handleTabChange}
            provisionalWording={provisional}
            provisional={notice ? (
              <p className="publication-provisional" role="status">{notice}</p>
            ) : null}
          />
        )}
        {/* Behind the landing page, a silhouette of Public finances, drawn
            with the page (no data, no charts to load), faded and blurred */}
        {landing && <LandingBackdrop />}
        <div className="view-panels">
        {VIEWS.filter(({ value }) => visited.includes(value)).map(({ value }) => (
        <div
          key={value}
          id={panelId(value)}
          role="tabpanel"
          aria-labelledby={tabId(value)}
          className="tab-panel"
          hidden={landing || value !== activeTab}
        >
        <DownloadContext.Provider value={downloadContext(value)}>
        {/* The local build's label, near every view's figures (Impact
            impact carries it under its sub-tabs) */}
        {value !== "dashboard" && <LocalBuildLabel />}
        <Suspense fallback={viewFallback(value)}>
        {BUDGET_VIEWS.has(value) && unavailable?.loading ? (
          // Placeholders at once while the verified figures load; the
          // "not published yet" line is only for an empty publication
          <ViewSkeleton view={loadingView(value)} />
        ) : BUDGET_VIEWS.has(value) && viewUnavailable(value) ? (
          <UnavailableNotice reason={viewUnavailable(value).reason}>
            {viewUnavailable(value).detail && <p>{viewUnavailable(value).detail}</p>}
            {unavailable ? (
              unavailable.empty && <p>{reportCopy().measuresEmptyLine}</p>
            ) : (
              <>
                <p>No figures are shown for a selection while any of it is unavailable.</p>
                <RemoveUnavailable
                  names={unavailableIds.map((id) => catalogue.byId.get(id)?.name ?? id)}
                  onRemove={() => removeFromSelection(unavailableIds)}
                />
              </>
            )}
          </UnavailableNotice>
        ) : value === "policies" ? (
          // Every published measure's card, whatever the band's selection
          <div className="results-container">
            {/* Typical young people under current law and the report's runs (household calculations) */}
            <HouseholdExamples />
            <SectionHeading
              icon="fileText"
              title="Measures we model"
              subtitle={`${notice ? `${notice}. ` : ""}${reportCopy().measuresSubtitle}`}
            />
            <section id="policy-details" className="report-section policy-details-content">
              <PolicyCards
                policies={POLICIES}
                // Every modelled policy, whatever the header has chosen: the
                // selection drives the results tabs only ("See its effect"
                // picks one from here)
                selectedPolicies={allPolicyIds}
                onShowEffect={handleShowEffect}
              />
            </section>
            {/* The candidate measures the dashboard cannot compute, with the reason */}
            <NotComputableMeasures />
          </div>
        ) : value === "methodology" ? (
          <MethodologyTab onShowTab={handleTabChange} />
        ) : (
          // Impact and its sub-tabs (populationPanel)
          // Hidden under the landing page, it leaves the address alone
          <PopulationImpactView note={<div className="milburn-status">{showingLine}<LocalBuildLabel /></div>} active={activeTab === value && !landing}>
            {populationPanel}
          </PopulationImpactView>
        )}
        </Suspense>
        </DownloadContext.Provider>
        </div>
        ))}
        </div>
        </div>
        {/* The overview drawer, opened by the "About" pill in the tab row */}
        {!landing && (
          <>
            <OverviewDrawer
              open={overviewOpen}
              onClose={closeOverview}
              onOpen={handleTabChange}
              returnFocus={aboutTabRef}
              provisionalWording={provisional}
              provisional={notice ? (
                <p className="publication-provisional" role="status">{notice}</p>
              ) : null}
            />
          </>
        )}
      </div>
    </div>
    </DisplayYearsContext.Provider>
  );
}
/**
 * The page's own check of the build's figures (app/publicationBoot.ts):
 * once the opened view's code is in, so it does not share a slow line with
 * it, the live manifest and every artifact load through the same checks as
 * a page without them. Resolves to null when the result is exactly the
 * build's, otherwise to the page's own parts; rejects when a check fails.
 */
async function reverifyBoot(base, boot, signal) {
  await (opensLanding(window.location) ? Promise.resolve() : preloadView(bootView(window.location)));
  if (signal.aborted) return null;
  const parts = await loadDashboardParts(base, { signal });
  return sameParts(parts, boot) ? null : parts;
}

// How often an open page checks for a newer publication, besides when it
// regains focus
const RECHECK_MS = 5 * 60 * 1000;

/** @param {{ boot?: Object | null }} props */
function App({ boot = null }) {
  // The publication the build verified (app/publicationBoot.ts), shown from
  // the first paint; the page's own check below then confirms it, or
  // withdraws it. Without one the page loads and checks before it shows.
  const [fromBuild] = useState(() => (boot ? dashboardFromParts(boot) : null));
  const [published, setPublished] = useState(fromBuild);
  const [error, setError] = useState(null);
  const [updated, setUpdated] = useState(false);
  // Who has checked the figures shown: "build" until the page has checked
  // them itself, then "page" (data-publication-check)
  const [checkedBy, setCheckedBy] = useState(fromBuild ? "build" : "page");
  const current = useRef(fromBuild);
  const confirmer = useRef(null);
  // Stable for the page's life: each Household calculator request waits on it
  const confirmPublication = useCallback(
    (snapshot) => (confirmer.current ? confirmer.current(snapshot) : Promise.resolve(false)),
    [],
  );
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const controller = new AbortController();
    // The Milburn review's local build route (utils/milburn/localBuild.js)
    const localRoute = isLocalBuildRoute();
    const show = (result) => {
      current.current = result;
      setPublished(result);
      setError(null);
    };
    let initialComplete = false;
    const initial = (fromBuild && !localRoute
      ? reverifyBoot(base, boot, controller.signal).then((parts) => {
        if (controller.signal.aborted) return;
        // The page's check found exactly the build's figures: they stay
        if (parts === null) return setCheckedBy("page");
        // Anything else: the page's own verified figures replace them
        // (none, if the publication has gone)
        const result = dashboardFromParts(parts);
        show(result);
        setCheckedBy("page");
        if ((result.catalogue.manifest?.snapshotSha256 ?? null) !== boot.snapshotSha256 && parts.status === "ready") setUpdated(true);
      })
      : loadDashboard(base, { signal: controller.signal })
        .then((result) => { if (!controller.signal.aborted) show(result); }))
      .catch((failure) => {
        if (controller.signal.aborted) return;
        // A check that fails withdraws the build's figures too
        current.current = null;
        setPublished(null);
        setError(failure.message);
        setCheckedBy("page");
      })
      .finally(() => { initialComplete = true; });

    // An open page follows the publication: a newer manifest replaces the
    // figures with its own verified ones. A missing, invalid or unreachable
    // manifest takes them away until a later check verifies publication again.
    // Under the same manifest, artifacts that failed to verify are tried again.
    // Each check resolves to the live snapshot it found, or null for none.
    const run = async () => {
      try {
        const catalogue = current.current?.catalogue;
        const shown = catalogue?.manifest?.snapshotSha256 ?? null;
        // The local build route has no manifest to check: its runs are read
        // again, so a run that has finished since appears
        if (localRoute) {
          const next = await loadDashboard(base, { signal: controller.signal });
          if (controller.signal.aborted) return null;
          const found = next.catalogue.manifest?.snapshotSha256 ?? null;
          if (found !== shown) {
            show(next);
            if (shown !== null) setUpdated(true);
          }
          return found;
        }
        const live = await loadManifest(base, { signal: controller.signal });
        const failed = Object.keys(catalogue?.failures ?? {}).length > 0;
        if (current.current !== null && (live?.snapshotSha256 ?? null) === shown && !failed) return shown;
        const next = await loadDashboard(base, { signal: controller.signal });
        if (controller.signal.aborted) return null;
        show(next);
        const found = next.catalogue.manifest?.snapshotSha256 ?? null;
        if (found !== shown) setUpdated(true);
        return found;
      } catch (failure) {
        if (controller.signal.aborted) return null;
        current.current = null;
        setPublished(null);
        setError(failure.message);
        return null;
      }
    };
    // One check at a time; one asked for mid-check runs when it ends
    const check = serialisedChecks(run);
    // The local build route's runs are static files: a page showing them
    // never reads them again; one whose load failed tries again
    const recheck = () => {
      if (controller.signal.aborted || !initialComplete) return;
      if (localRoute && current.current !== null) return;
      check();
    };
    // A household request waits for a check that started after it was made:
    // true only if the snapshot it was made under is still the live one.
    confirmer.current = async (snapshot) => {
      await initial;
      if (controller.signal.aborted) return false;
      return (await check()) === snapshot;
    };
    const onVisible = () => { if (document.visibilityState === "visible") recheck(); };
    const timer = setInterval(recheck, RECHECK_MS);
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      confirmer.current = null;
      clearInterval(timer);
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // Once, on mount: the build's figures are the first render's
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const unavailable = !published && !error
    ? { reason: "Loading published policies…", loading: true }
    : error
    ? { reason: "Published results are unavailable", detail: error }
    : published.status === "no-manifest"
      ? { reason: "No results are published yet", empty: true }
      : null;
  const shown = unavailable ? NOTHING_PUBLISHED : published;
  // One snapshot per mount: a newer one starts the views afresh
  const snapshot = shown.catalogue.manifest?.snapshotSha256 ?? "none";
  return (
    <PublicationCheckContext.Provider value={confirmPublication}>
      <MeasureCatalogueProvider catalogue={shown.catalogue}>
        <Dashboard key={snapshot} published={shown} unavailable={unavailable} updated={updated && !unavailable} fromBuild={Boolean(boot)} checkedBy={checkedBy} />
      </MeasureCatalogueProvider>
    </PublicationCheckContext.Provider>
  );
}

export default App;
