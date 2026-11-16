/**
 * The page on the local build route (utils/milburn/localBuild.js): its runs
 * are static files, read once. Regaining focus, becoming visible and the
 * five-minute timer leave a page showing them alone; a page whose load
 * failed tries again. The verified route's rechecks: AppCatalogue.test.jsx.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import App from "./App";

vi.mock("./components/MethodologyTab", () => ({ default: () => <div data-testid="methodology-view" />, METHOD_SECTIONS: {} }));

const FIXTURE = join(__dirname, "test", "fixtures", "milburn", "local-build");

/** The fixture served as public/ serves /data/, counting each request. */
function countingFetch({ failing = () => false } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    const path = String(url).slice(String(url).indexOf("/data/") + "/data/".length);
    calls.push(path);
    if (failing()) throw new TypeError("Failed to fetch");
    try {
      return new Response(readFileSync(join(FIXTURE, path)), { status: 200 });
    } catch {
      return new Response(null, { status: 404 });
    }
  };
  return { calls, fetchImpl };
}

const runRequests = (calls) => calls.filter((path) => path.startsWith("milburn/") || path === "milburn_measures.json").length;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_DATA_ROUTE", "local-build");
  // Methodology draws none of the runs: only the route's own requests count
  window.history.replaceState({}, "", "/?tab=methodology");
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("the local build route's page", () => {
  it("reads the runs once: not again on focus, on becoming visible or after five minutes", async () => {
    const { calls, fetchImpl } = countingFetch();
    vi.stubGlobal("fetch", fetchImpl);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container } = render(<App />);
    await waitFor(() => expect(container.querySelector('[data-publication-check="page"]') ?? container.querySelector("[data-testid='methodology-view']")).not.toBeNull());
    await waitFor(() => expect(calls).toContain("milburn/milburn_package/age_impact.csv"));
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    const loaded = runRequests(calls);
    expect(loaded).toBeGreaterThan(0);
    expect(calls.filter((path) => path.includes("household_scatter"))).toEqual([]);
    expect(calls.filter((path) => path === "manifest.json" || path.startsWith("artifacts/"))).toEqual([]);

    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    await act(async () => { await vi.advanceTimersByTimeAsync(11 * 60 * 1000); });
    expect(runRequests(calls)).toBe(loaded);
  });

  it("tries again on focus when the first load failed", async () => {
    let down = true;
    const { calls, fetchImpl } = countingFetch({ failing: () => down });
    vi.stubGlobal("fetch", fetchImpl);
    render(<App />);
    await waitFor(() => expect(calls).toContain("milburn_measures.json"));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(calls).not.toContain("milburn/milburn_package/age_impact.csv");
    down = false;
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await waitFor(() => expect(calls).toContain("milburn/milburn_package/age_impact.csv"));
  });
});
