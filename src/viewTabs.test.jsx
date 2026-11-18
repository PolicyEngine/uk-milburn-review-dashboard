import { beforeAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App, { POLICIES_INACTIVE, VIEWS, YEAR_INACTIVE, opensYoungPeople, viewFromLocation, preloadAllViews } from "./App";
import { BASE_PATH, fixtureFetch, fixtureJson } from "./test/publicationFixture";
import { POVERTY_FIGURES_SHOWN } from "./utils/povertyFigures";
import { reportCopy } from "./utils/milburn/reportStatus";

// Every view's code is in before a test renders it (App.jsx lazyView)
beforeAll(preloadAllViews, 60_000);

beforeEach(() => {
  const original = fixtureJson("manifest.json");
  const manifest = { ...original, measures: { alpha: original.measures.alpha }, combined: {} };
  const serve = fixtureFetch({ overrides: { "manifest.json": JSON.stringify(manifest) } });
  vi.stubGlobal("fetch", (url, init) => serve(`${BASE_PATH}${url}`, init));
  // The bare address is the landing page, with no tab bar (landing.test.jsx)
  window.history.replaceState({}, "", "/?tab=dashboard");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderApp() {
  const rendered = render(<App />);
  await screen.findByRole("tablist", { name: "Views" });
  await waitFor(() => expect(rendered.container.querySelector('.app[data-publication="verified"]')).not.toBeNull());
  return rendered;
}

const viewList = () => screen.getByRole("tablist", { name: "Views" });
const tabs = () => within(viewList()).getAllByRole("tab");
const subList = () => screen.getByRole("tablist", { name: "Impact sections" });
const subTabs = () => within(subList()).getAllByRole("tab");
const band = (container) => container.querySelector(".title-row");
// A pill is always in the band (never hidden or inert); "shown" is whether
// it applies to the view: not faded, its button not aria-disabled
const visible = (pill) => !pill.classList.contains("is-hidden") && !pill.hasAttribute("inert") && !pill.hasAttribute("aria-hidden");
const shown = (pill) => visible(pill) && !pill.classList.contains("is-inactive") && !pill.querySelector('.band-control[aria-disabled="true"]');

describe("the view tabs", () => {
  it("are four tabs under the band, in order, with no view pill in the band", async () => {
    // The bare address is the landing page (landing.test.jsx)
    window.history.replaceState({}, "", "/?tab=dashboard");
    const { container } = await renderApp();
    expect(tabs().map((tab) => tab.textContent)).toEqual([
      "Impact",
      "Household impact",
      "Measures",
      "Methodology",
    ]);
    expect(tabs()[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs()[0]).toHaveAttribute("tabindex", "0");
    expect(tabs()[1]).toHaveAttribute("tabindex", "-1");
    expect(band(container).querySelector(".band-view")).toBeNull();
    expect(screen.queryByRole("button", { name: /^View:/ })).toBeNull();
    // The intro is on the landing page only, never over a view
    expect(container.querySelector(".dashboard-intro")).toBeNull();
    expect(container.querySelector(".landing")).toBeNull();
    expect(container).not.toHaveTextContent("This dashboard uses");
    expect(screen.getByRole("tabpanel", { name: "Impact" })).toBeInTheDocument();
  });

  it("shows no candidate banner on any view", async () => {
    const { container } = await renderApp();
    VIEWS.forEach((view, index) => {
      fireEvent.click(tabs()[index]);
      expect(container.querySelectorAll(".milburn-banner")).toHaveLength(0);
    });
  });

  it("show the year and policy pills only where they apply", async () => {
    const { container } = await renderApp();
    const expected = {
      dashboard: [true, true],
      // Household impact follows the header's one policy, not its year
      household: [false, true],
      outlook: [false, false],
      policies: [false, false],
      methodology: [false, false],
    };
    VIEWS.forEach((view, index) => {
      fireEvent.click(tabs()[index]);
      const year = band(container).querySelector(".band-year");
      const policy = band(container).querySelector(".band-policy");
      // Both stay in the band, visible, so the band never moves; one that
      // does not apply is faded and says why
      expect([visible(year), visible(policy)]).toEqual([true, true]);
      expect([shown(year), shown(policy)]).toEqual(expected[view.value]);
      expect(container.querySelector(".app")).not.toHaveAttribute("data-band");
      if (!expected[view.value][0]) {
        expect(year.querySelector(".band-control")).toHaveAttribute("aria-label", expect.stringContaining(YEAR_INACTIVE));
        fireEvent.click(year.querySelector(".band-control"));
        expect(year.querySelector('[role="listbox"]')).toBeNull();
        // No visible tip: the reason is in the name only
        fireEvent.mouseEnter(year.querySelector(".band-control"));
        fireEvent.pointerEnter(year.querySelector(".band-control"));
        fireEvent.focus(year.querySelector(".band-control"));
        fireEvent.mouseOver(year.querySelector(".band-control"));
        fireEvent.focusIn(year.querySelector(".band-control"));
        expect(document.querySelector(".tip")).toBeNull();
      }
      if (!expected[view.value][1]) {
        expect(policy.querySelector(".band-control")).toHaveAttribute("aria-label", expect.stringMatching(new RegExp(`^Policies .*: ${POLICIES_INACTIVE}$`)));
        fireEvent.click(policy.querySelector(".band-control"));
        expect(policy.querySelector(".policy-selector-dropdown")).toBeNull();
        fireEvent.mouseEnter(policy.querySelector(".band-control"));
        fireEvent.pointerEnter(policy.querySelector(".band-control"));
        fireEvent.focus(policy.querySelector(".band-control"));
        fireEvent.mouseOver(policy.querySelector(".band-control"));
        fireEvent.focusIn(policy.querySelector(".band-control"));
        expect(document.querySelector(".tip")).toBeNull();
      }
    });
  });

  it("keep ?tab= in step, the default selection out of the address and a chosen one on every view", async () => {
    // Review of 15439f4, finding 2: the default follows the publication,
    // and a chosen selection survives a view without the policy pill
    const search = () => new URLSearchParams(window.location.search);
    const tabParam = { dashboard: "dashboard", household: "household", outlook: "outlook", policies: "policies", methodology: "methodology" };
    const { unmount } = await renderApp();
    VIEWS.forEach((view, index) => {
      fireEvent.click(tabs()[index]);
      expect([search().get("tab"), search().get("policies")]).toEqual([tabParam[view.value], null]);
    });
    unmount();
    window.history.replaceState({}, "", "/?policies=alpha");
    await renderApp();
    VIEWS.forEach((view, index) => {
      fireEvent.click(tabs()[index]);
      expect([search().get("tab"), search().get("policies")]).toEqual([tabParam[view.value], "alpha"]);
    });
  });

  it("open the view an old or new link names", async () => {
    for (const [url, label] of [
      // The Autumn Budget's Household calculator link opens Impact; ?tab=household
      // is now the Milburn Household impact tab
      ["/?tab=household", "Household impact"],
      ["/?tab=personal", "Impact"],
      // The Autumn Budget's Pre-measures forecast is not in this dashboard
      ["/?tab=outlook", "Impact"],
      ["/?tab=living", "Impact"],
      ["/?tab=policies", "Measures"],
      ["/?tab=measures", "Measures"],
      ["/?tab=dashboard", "Impact"],
      ["/?tab=methodology", "Methodology"],
      ["/?tab=nonsense", "Impact"],
    ]) {
      window.history.replaceState({}, "", url);
      const { unmount } = await renderApp();
      expect(screen.getByRole("tab", { name: label })).toHaveAttribute("aria-selected", "true");
      unmount();
    }
    expect(viewFromLocation({ search: "?tab=personal", hash: "" })).toBe("dashboard");
    expect(viewFromLocation({ search: "?tab=measures", hash: "" })).toBe("policies");
    expect(viewFromLocation({ search: "?tab=household", hash: "" })).toBe("household");
    expect(viewFromLocation({ search: "?tab=living", hash: "#young-people" })).toBe("dashboard");
    expect(viewFromLocation({ search: "?tab=young", hash: "" })).toBe("dashboard");
    expect(viewFromLocation({ search: "?tab=outlook&sub=baseline", hash: "" })).toBe("dashboard");
    expect(opensYoungPeople({ search: "?tab=young", hash: "" })).toBe(true);
    expect(opensYoungPeople({ search: "?tab=living", hash: "" })).toBe(false);
  });

  it("describe every published measure on Measures, whatever the selection", async () => {
    window.history.replaceState({}, "", "/?sub=finances&policies=alpha");
    await renderApp();
    // Impact neither repeats the cards nor points to them
    expect(screen.queryByText("About selected policies")).toBeNull();
    expect(screen.queryByText(/What each policy does is on/)).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Measures" }));
    const panel = screen.getByRole("tabpanel", { name: "Measures" });
    // The fixture publishes one measure (beforeEach); the candidate
    // measures the dashboard cannot compute follow, each with its reason
    const modelled = panel.querySelector("#policy-details");
    expect(within(modelled).getAllByRole("listitem")).toHaveLength(1);
    const notComputable = within(panel).getByRole("region", { name: reportCopy().notComputableTitle });
    expect(within(notComputable).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Child DLA extended to 18",
      "Additional Cost Allowance",
      "Severe and Complex Needs Insurance",
      "Local Health and Disability Fund",
      "Duty to engage",
      "Income protection during serious illness",
      "Care Leaver Transition Allowance",
      "Opportunity Guarantee",
      "Civic service programme",
      "Hiring payments to employers",
      "Flexible Jobs Scheme and supported paid jobs",
      "Start-up support for young entrepreneurs",
      "Apprenticeship target",
      "Further education places",
    ]);
    // The report's own amounts may be stated; never an estimate of no effect
    expect(notComputable.textContent).not.toMatch(/£0/);
    expect(new URLSearchParams(window.location.search).get("tab")).toBe("policies");
  });

  it("open Impact with only one measure from its card's \"See its effect\"", async () => {
    window.history.replaceState({}, "", "/?tab=policies");
    await renderApp();
    const panel = screen.getByRole("tabpanel", { name: "Measures" });
    fireEvent.click(within(panel).getByRole("button", { name: /effect: Alpha,/ }));
    expect(screen.getByRole("tab", { name: "Impact" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const params = new URLSearchParams(window.location.search);
    expect(params.get("tab")).toBe("dashboard");
    expect(params.get("policies")).toBe("alpha");
  });

  it("move with the arrow keys, Home and End", async () => {
    window.history.replaceState({}, "", "/?tab=dashboard");
    await renderApp();
    const list = viewList();
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(tabs()[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs()[1]).toHaveFocus();
    fireEvent.keyDown(list, { key: "ArrowLeft" });
    fireEvent.keyDown(list, { key: "ArrowLeft" });
    expect(tabs()[3]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(list, { key: "Home" });
    expect(tabs()[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(list, { key: "End" });
    expect(screen.getByRole("tabpanel", { name: "Methodology" })).toBeInTheDocument();
  });

  it("open a sub-tab band only on views with sub-tabs, and keep the view tabs a keyboard tablist", async () => {
    window.history.replaceState({}, "", "/?tab=dashboard");
    await renderApp();
    const bar = document.querySelector(".view-tabs-bar");
    expect(bar).toHaveClass("has-notch");
    // One sliding indicator, hidden from assistive tech, outside the tabs
    const indicator = bar.querySelectorAll(".view-tabs-indicator");
    expect(indicator).toHaveLength(1);
    expect(indicator[0]).toHaveAttribute("aria-hidden", "true");
    expect(tabs()).toHaveLength(VIEWS.length);
    for (const name of ["Measures", "Methodology"]) {
      fireEvent.click(within(viewList()).getByRole("tab", { name }));
      const panel = screen.getByRole("tabpanel", { name });
      expect(panel.querySelector(".sub-tabs-band")).toBeNull();
      expect(bar).not.toHaveClass("has-notch");
    }
    // Roving tabindex: only the chosen view tab is in the Tab order
    expect(tabs().filter((tab) => tab.tabIndex === 0)).toHaveLength(1);
    fireEvent.keyDown(viewList(), { key: "Home" });
    expect(tabs()[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs()[0]).toHaveFocus();
    expect(bar).toHaveClass("has-notch");
  });

  it("split Impact into its sub-tabs, Young people first", async () => {
    window.history.replaceState({}, "", "/?tab=dashboard");
    await renderApp();
    const panel = screen.getByRole("tabpanel", { name: "Impact" });
    // The band sits directly under the view tabs, first in the view's
    // panel (after its zero-height sentinel), and holds the sub-tabs
    expect(panel.firstElementChild).toHaveClass("sub-tabs-sentinel");
    expect(panel.firstElementChild.nextElementSibling).toHaveClass("sub-tabs-band");
    expect(panel.firstElementChild.nextElementSibling).toContainElement(subList());
    // The chosen view's tab opens into it
    expect(document.querySelector(".view-tabs-bar")).toHaveClass("has-notch");
    expect(subTabs().map((tab) => tab.textContent)).toEqual([
      "Young people",
      "Public finances",
      // Only while the poverty figures are shown (povertyFigures.js)
      ...(POVERTY_FIGURES_SHOWN ? ["Poverty"] : []),
      "Moves into work (illustrative)",
      "Benchmarks",
    ]);
    expect(subTabs()[0]).toHaveAttribute("aria-selected", "true");
    // The default sub-tab has no ?sub=
    expect(window.location.search).not.toContain("sub=");

    const finances = () => within(subList()).getByRole("tab", { name: "Public finances" });
    fireEvent.click(finances());
    expect(finances()).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("tabpanel", { name: "Public finances" })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("sub")).toBe("finances");
    // The year and policy pills drive both sub-tabs
    expect(shown(band(document.body).querySelector(".band-year"))).toBe(true);
    expect(shown(band(document.body).querySelector(".band-policy"))).toBe(true);
    // The default selection stays out of the address
    expect(new URLSearchParams(window.location.search).has("policies")).toBe(false);

    // Another view drops ?sub=; the view stays mounted, so coming back
    // shows the sub-tab left open, and its ?sub= again
    fireEvent.click(screen.getByRole("tab", { name: "Methodology" }));
    expect(window.location.search).not.toContain("sub=");
    fireEvent.click(screen.getByRole("tab", { name: "Impact" }));
    expect(finances()).toHaveAttribute("aria-selected", "true");
    expect(new URLSearchParams(window.location.search).get("sub")).toBe("finances");
  });

  it("open By age with pensioners chosen from an old ?sub=pensioners link", async () => {
    window.history.replaceState({}, "", "/?sub=pensioners");
    await renderApp();
    expect(screen.getByRole("tab", { name: "Young people" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("tabpanel", { name: "Young people" })).toBeInTheDocument();
    const params = new URLSearchParams(window.location.search);
    // Young people is the default sub-tab, so ?sub= is left out
    expect([params.get("sub"), params.get("age")]).toEqual([null, "pensioners"]);
  });

  it("open By age with 16 to 24 chosen from the old Young people links, keeping the hash", async () => {
    for (const [url, hash] of [
      ["/?tab=young", ""],
      ["/#young-people", "#young-people"],
      ["/?sub=young", ""],
    ]) {
      window.history.replaceState({}, "", url);
      const { unmount } = await renderApp();
      expect(screen.getByRole("tab", { name: "Impact" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(screen.getByRole("tab", { name: "Young people" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      const params = new URLSearchParams(window.location.search);
      expect([params.get("tab"), params.get("sub"), params.get("age"), window.location.hash]).toEqual([
        "dashboard",
        null,
        "16-24",
        hash,
      ]);
      unmount();
    }
  });

  it("open By age from a #young-people link on another view, and drop the hash on leaving", async () => {
    window.history.replaceState({}, "", "/?tab=methodology");
    await renderApp();
    window.history.replaceState({}, "", "/?tab=methodology#young-people");
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(screen.getByRole("tab", { name: "Impact" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Young people" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // To Public finances: the hash goes with the Young people sub-tab
    fireEvent.click(screen.getByRole("tab", { name: "Public finances" }));
    expect(window.location.hash).toBe("");
    expect(new URLSearchParams(window.location.search).get("sub")).toBe("finances");
  });

  it("open By age, 16 to 24 chosen, from Methodology's link", async () => {
    window.history.replaceState({}, "", "/?tab=methodology");
    await renderApp();
    // The link sits in Population impact's folded "Results by age" topic
    fireEvent.click(screen.getByRole("button", { name: "Results by age" }));
    fireEvent.click(
      screen
        .getAllByRole("link", { name: "Young people", hidden: true })
        .find((link) => link.getAttribute("href").startsWith("?tab=")),
    );
    expect(screen.getByRole("tab", { name: "Young people" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const params = new URLSearchParams(window.location.search);
    expect([params.get("sub"), params.get("age")]).toEqual([null, "16-24"]);
  });

  it("gather the method notes on Methodology, each said once", async () => {
    await renderApp();
    fireEvent.click(screen.getByRole("tab", { name: "Methodology" }));
    const panel = screen.getByRole("tabpanel", { name: "Methodology" });
    for (const name of [
      "At a glance",
      "Data",
      "Model and measures",
      "Impact",
      "Moves into work and benchmarks",
      "Limitations",
    ]) {
      expect(within(panel).getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    expect(within(panel).queryByRole("heading", { level: 2, name: "Household calculator" })).toBeNull();
    // Results by age is a folded topic of Impact
    const population = within(panel).getByRole("heading", { level: 2, name: "Impact" }).closest(".method-section");
    expect(within(population).getByRole("button", { name: "Results by age" })).toBeInTheDocument();
    expect(within(population).queryByRole("button", { name: "Figures by area" })).toBeNull();
    expect(within(panel).queryByRole("button", { name: "How the household calculation works" })).toBeNull();
    expect(panel).not.toHaveTextContent("Pre-measures forecast");
    expect(panel.querySelector('a[href*="policyengine.org/uk/research"]')).toBeNull();
  });
});
