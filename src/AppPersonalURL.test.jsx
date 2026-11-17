import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App, { preloadAllViews } from "./App";
import { dashboardFixtureFetch } from "./test/dashboardFixture";
import { fixtureJson, fixtureText } from "./test/publicationFixture";
import { artifactSha256 } from "./utils/publication/digest";
import { DEFAULT_DISPLAY_YEAR } from "./utils/displayYears";

// Every view's code is in before a test renders it (App.jsx lazyView)
beforeAll(preloadAllViews, 60_000);

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

// Review of 428d209, finding 3: a later snapshot remounts the views, and
// must restore exactly the selection the reader had, an empty one included.
describe("a later snapshot keeps the reader's selection", () => {
  const policies = () => new URLSearchParams(window.location.search).get("policies");
  // The fixture's measures cover 2032 and 2033 only, and the title band
  // needs its default year. So alpha's and beta's receipts are also
  // published for it, re-bound through the production digest functions.
  const serve = async (statuses = {}, revision = 0) => {
    const manifest = fixtureJson("manifest.json");
    const overrides = {};
    for (const id of ["alpha", "beta"]) {
      const entry = manifest.measures[id];
      const previous = entry.artifact;
      const receipt = fixtureJson(`${previous}/receipt.json`);
      receipt.execution_receipt.years = [DEFAULT_DISPLAY_YEAR, ...receipt.execution_receipt.years];
      entry.years = receipt.execution_receipt.years;
      entry.artifact_sha256 = await artifactSha256(receipt);
      entry.artifact = `artifacts/${id}/${entry.artifact_sha256.slice(0, 16)}`;
      if (entry.approval) entry.approval = { ...entry.approval, artifact_sha256: entry.artifact_sha256 };
      overrides[`${entry.artifact}/receipt.json`] = JSON.stringify(receipt);
      for (const file of Object.keys(receipt.dashboard.files)) overrides[`${entry.artifact}/${file}`] = fixtureText(`${previous}/${file}`);
    }
    for (const [id, status] of Object.entries(statuses)) manifest.measures[id] = { ...manifest.measures[id], status };
    manifest.revision += revision;
    overrides["manifest.json"] = JSON.stringify(manifest);
    return dashboardFixtureFetch({ overrides });
  };
  const open = (url, fetcher, calls) => {
    vi.stubEnv("NEXT_PUBLIC_HOUSEHOLD_API_URL", "https://api.test/api/household-impact");
    vi.stubGlobal("fetch", async (requested, init = {}) => {
      calls.push({ url: String(requested), method: init.method ?? "GET" });
      return fetcher(requested, init);
    });
    window.history.replaceState({}, "", url);
    render(<App />);
  };
  const householdCalls = (calls) => calls.filter((call) => call.method === "POST" || call.url.includes("/api/household-impact"));

  // One policy at a time on the population tabs (no combined run of the
  // whole package in the fixture)
  const chosenName = () => document.querySelector(".band-policy .policy-selector-chosen")?.textContent;

  it("opens the population tabs on one policy, the first in the catalogue's order, and names it in the address", async () => {
    const calls = [];
    open("/?tab=dashboard", await serve(), calls);
    await waitFor(() => expect(chosenName()).toBeTruthy());
    expect(policies()?.split(",")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /^Policies / }));
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Select all" })).toBeNull();
    const radios = screen.getAllByRole("radio");
    expect(radios.filter((radio) => radio.checked)).toHaveLength(1);
    // Picking another selects only it
    fireEvent.click(radios[1]);
    await waitFor(() => expect(screen.getAllByRole("radio").filter((radio) => radio.checked)).toHaveLength(1));
    expect(policies()?.split(",")).toHaveLength(1);
    expect(screen.getAllByRole("radio")[1].checked).toBe(true);
  });

  it("keeps the population tabs' one policy while the Measures tab shows every policy's card", async () => {
    const calls = [];
    open("/?tab=dashboard&policies=alpha,beta", await serve(), calls);
    await waitFor(() => expect(chosenName()).toBeTruthy());
    // A link naming several opens on the first of them
    expect(policies()?.split(",")).toHaveLength(1);
    const one = policies();
    // The Measures tab shows every policy's card, whatever is chosen
    fireEvent.click(screen.getByRole("tab", { name: "Measures" }));
    await waitFor(() => expect(document.querySelectorAll(".policy-details-content [aria-label^='See its effect']").length).toBeGreaterThan(1));
    fireEvent.click(screen.getByRole("tab", { name: "Impact" }));
    await waitFor(() => expect(policies()).toBe(one));
  });

  it("opens an old Household calculator link on Impact with its one policy", async () => {
    const calls = [];
    open("/?tab=personal&policies=beta", await serve(), calls);
    await waitFor(() => expect(chosenName()).toBeTruthy());
    expect(screen.getByRole("tab", { name: "Impact" })).toHaveAttribute("aria-selected", "true");
    expect(new URLSearchParams(window.location.search).get("tab")).toBe("dashboard");
    expect(policies()).toBe("beta");
    expect(householdCalls(calls)).toEqual([]);
  });
});

describe("the header's year in the address", () => {
  // The page renders once while the publication loads, then remounts the
  // views on the loaded snapshot (App.jsx, key={snapshot}), so an element
  // found during loading can be gone a moment later: wait for the
  // published policies' cards first
  const published = () =>
    waitFor(() => expect(document.querySelectorAll(".policy-details-content [aria-label^='See its effect']").length).toBeGreaterThan(0));

  it("opens a shared link on its ?year= and keeps it there", async () => {
    // (the default year stays out of the address, so a kept 2030 was read)
    vi.stubGlobal("fetch", dashboardFixtureFetch());
    window.history.replaceState({}, "", "/?tab=policies&year=2030");
    render(<App />);
    await published();
    expect(await screen.findByRole("button", { name: /^Year 2030-31/ })).toBeInTheDocument();
    await waitFor(() => expect(new URLSearchParams(window.location.search).get("year")).toBe("2030"));
  });

  it("drops a year it does not offer (an old 2026) and opens the default", async () => {
    vi.stubGlobal("fetch", dashboardFixtureFetch());
    window.history.replaceState({}, "", "/?tab=policies&year=2026");
    render(<App />);
    await published();
    expect(await screen.findByRole("tab", { name: /Measures/ })).toBeInTheDocument();
    await waitFor(() => expect(new URLSearchParams(window.location.search).get("year")).toBeNull());
  });
});
