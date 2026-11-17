import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import NeetBreakdown, { NEET_DEFINITION_LINE, NEET_TITLE, WITHHELD, formatChange, formatPeople, formatSharePct } from "./NeetBreakdown";
import { NEET_FILE, parseNeet } from "../../utils/milburn/neet";
import { BENCHMARKS_FILE } from "../../utils/milburn/benchmarks";

const NEET_RUN = "milburn_report_package";

// Invented figures: the real ones are in public/data/milburn_neet.json
const group = (overrides = {}) => ({
  records: 1500,
  population: 1234567,
  share_in_losing_households_pct: 21.5,
  average_change_in_household_net_income: -1234.56,
  people_losing_uc_health_or_pip: 345678,
  share_losing_uc_health_or_pip_pct: 28,
  ...overrides,
});

const FIXTURE = {
  reform_id: NEET_RUN,
  year: 2029,
  build: "build test, policyengine-uk 0.0.0",
  definition: "Aged 16 to 24 with no earnings and not in full-time education.",
  definition_notes: ["The survey data has no NEET flag.", "Thin cells are withheld."],
  min_records: 100,
  neet_approx_total: 1234567,
  neet_approx_share_of_16_24_pct: 16.5,
  ons_benchmark_id: "neet_16_24",
  groups: {
    neet_approx: group(),
    other_16_24: group({ population: 6000400, share_in_losing_households_pct: 4.25, average_change_in_household_net_income: -300.4, people_losing_uc_health_or_pip: null, share_losing_uc_health_or_pip_pct: null }),
  },
};

const BENCHMARKS = {
  rows: [
    {
      id: "neet_16_24",
      figure: "Young people aged 16 to 24 not in education, employment or training (NEET)",
      value: "981,000",
      basis: "Labour Force Survey estimate, April to June 2026, UK: 13.0% of people aged 16 to 24",
      source: "Office for National Statistics",
      url: "https://www.ons.gov.uk/example",
      date: "27 August 2026",
    },
  ],
};

function serve(files) {
  const fetchMock = vi.fn((url) => {
    const name = Object.keys(files).find((file) => String(url).endsWith(`/data/${file}`));
    return Promise.resolve(name ? { ok: true, json: () => Promise.resolve(files[name]) } : { ok: false, json: () => Promise.resolve(null) });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NeetBreakdown", () => {
  it("shows the two groups side by side for the report package, for the file's year", async () => {
    serve({ [NEET_FILE]: FIXTURE, [BENCHMARKS_FILE]: BENCHMARKS });
    const { container } = render(<NeetBreakdown selectedPolicies={[NEET_RUN]} />);
    await screen.findByRole("heading", { name: NEET_TITLE });
    expect(container.querySelector(".chart-description").textContent).toContain(NEET_DEFINITION_LINE);
    expect(container.querySelector(".chart-description").textContent).toContain("2029-30");
    const cells = (key) => [...container.querySelectorAll(`[data-neet-row="${key}"] td`)].map((cell) => cell.textContent);
    expect(cells("population")).toEqual(["1,235,000", "6,000,000"]);
    expect(cells("share_in_losing_households_pct")).toEqual(["21.50%", "4.25%"]);
    expect(cells("average_change_in_household_net_income")).toEqual(["−£1,235", "−£300"]);
    expect([...container.querySelectorAll("thead th")].map((cell) => cell.textContent)).toEqual(["2029-30", "NEET (approximated)", "Other 16–24s"]);
  });

  it("says a withheld figure is withheld, never zero", async () => {
    serve({ [NEET_FILE]: FIXTURE, [BENCHMARKS_FILE]: BENCHMARKS });
    const { container } = render(<NeetBreakdown selectedPolicies={[NEET_RUN]} />);
    await screen.findByRole("heading", { name: NEET_TITLE });
    const cells = [...container.querySelectorAll('[data-neet-row="people_losing_uc_health_or_pip"] td')].map((cell) => cell.textContent);
    expect(cells).toEqual(["346,000", WITHHELD]);
    const shares = [...container.querySelectorAll('[data-neet-row="share_losing_uc_health_or_pip_pct"] td')].map((cell) => cell.textContent);
    expect(shares).toEqual(["28.00%", WITHHELD]);
  });

  it("sets our count beside the published one, read from the benchmarks file, with its source linked", async () => {
    serve({ [NEET_FILE]: FIXTURE, [BENCHMARKS_FILE]: BENCHMARKS });
    const { container } = render(<NeetBreakdown selectedPolicies={[NEET_RUN]} />);
    await screen.findByRole("heading", { name: NEET_TITLE });
    const line = container.querySelector("[data-neet-count]");
    expect(line.textContent).toContain("1,235,000 people aged 16 to 24 as NEET in 2029-30 (16.5% of 16–24s)");
    expect(line.textContent).toContain("The ONS estimates 981,000");
    expect(line.textContent).toContain("on a different definition");
    const link = line.querySelector("a");
    expect(link.getAttribute("href")).toBe("https://www.ons.gov.uk/example");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("states no published figure when the benchmarks file cannot be read", async () => {
    serve({ [NEET_FILE]: FIXTURE });
    const { container } = render(<NeetBreakdown selectedPolicies={[NEET_RUN]} />);
    await screen.findByRole("heading", { name: NEET_TITLE });
    const line = container.querySelector("[data-neet-count]").textContent;
    expect(line).toContain("1,235,000");
    expect(line).not.toContain("981,000");
    expect(line).not.toContain("estimates");
  });

  it("folds the longer notes under More info", async () => {
    serve({ [NEET_FILE]: FIXTURE, [BENCHMARKS_FILE]: BENCHMARKS });
    const { container } = render(<NeetBreakdown selectedPolicies={[NEET_RUN]} />);
    await screen.findByRole("heading", { name: NEET_TITLE });
    const details = container.querySelector("details");
    expect(details.open).toBe(false);
    expect(details.querySelector("summary").textContent).toBe("More info");
    expect([...details.querySelectorAll("li")].map((item) => item.textContent)).toEqual([
      "The survey data has no NEET flag.",
      "Thin cells are withheld.",
    ]);
  });

  it("fetches nothing unless exactly one run is selected", () => {
    const fetchMock = serve({ [NEET_FILE]: FIXTURE, [BENCHMARKS_FILE]: BENCHMARKS });
    for (const selection of [[], [NEET_RUN, "milburn_report_pip"]]) {
      const { container, unmount } = render(<NeetBreakdown selectedPolicies={selection} />);
      expect(container.innerHTML).toBe("");
      unmount();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows nothing for a run the file was not made for", async () => {
    const fetchMock = serve({ [NEET_FILE]: FIXTURE, [BENCHMARKS_FILE]: BENCHMARKS });
    const { container } = render(<NeetBreakdown selectedPolicies={["milburn_report_pip"]} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container.innerHTML).toBe("");
  });

  it("shows nothing when the file is missing or unreadable", async () => {
    for (const files of [{}, { [NEET_FILE]: { ...FIXTURE, reform_id: "" } }, { [NEET_FILE]: { ...FIXTURE, groups: {} } }]) {
      const fetchMock = serve(files);
      const { container, unmount } = render(<NeetBreakdown selectedPolicies={[NEET_RUN]} />);
      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(container.innerHTML).toBe("");
      unmount();
    }
  });

  it("reads a figure that is not a finite number as withheld", () => {
    const parsed = parseNeet({ ...FIXTURE, groups: { ...FIXTURE.groups, neet_approx: group({ population: "many", share_in_losing_households_pct: undefined }) } });
    expect(parsed.groups.neet_approx.population).toBeNull();
    expect(parsed.groups.neet_approx.share_in_losing_households_pct).toBeNull();
    expect(parseNeet(null)).toBeNull();
    expect(parseNeet({ ...FIXTURE, year: "2029" })).toBeNull();
  });

  it("formats people to the nearest thousand, shares to two places and changes with a sign", () => {
    expect(formatPeople(981499)).toBe("981,000");
    expect(formatSharePct(7.7538)).toBe("7.75%");
    expect(formatChange(-1005.06)).toBe("−£1,005");
    expect(formatChange(12.4)).toBe("+£12");
    expect(formatChange(-0.2)).toBe("£0");
  });
});
