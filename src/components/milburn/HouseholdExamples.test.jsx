import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import HouseholdExamples, {
  HOUSEHOLDS_FILE,
  HOUSEHOLDS_LABEL,
  HOUSEHOLDS_TITLE,
  formatPounds,
  formatSignedPounds,
  parseHouseholds,
} from "./HouseholdExamples";

const PACKAGE = "milburn_report_package";
const YOUTH = "milburn_report_youth_allowance_independent";

const run = (change, lines = []) => ({
  applies: Math.abs(change) >= 0.005,
  net_income: 0,
  net_income_change: change,
  breakdown: lines.map(([label, amount]) => ({ id: label, label, change: amount })),
});

// Made-up amounts: the component's arithmetic and layout, not the published figures
const FILE = {
  year: 2029,
  label: HOUSEHOLDS_LABEL,
  basis: "Household calculations for 2029-30.",
  package_id: PACKAGE,
  runs: [
    { id: PACKAGE, name: "The report's package", part_of_package: true },
    { id: "milburn_report_uc_health", name: "Health element removal", part_of_package: true },
    { id: "milburn_report_pip", name: "PIP removal", part_of_package: true },
    { id: YOUTH, name: "Youth Allowance, higher rate", part_of_package: false },
  ],
  assumptions: ["Renters pay £6,000 a year."],
  households: [
    {
      id: "health",
      title: "22-year-old renting alone",
      description: "Has a health condition and no earnings.",
      notes: ["Paid the protected rate."],
      current_law: { net_income: 20000.4 },
      runs: {
        [PACKAGE]: run(-9000, [
          ["Health element", -5000],
          ["PIP", -4000],
        ]),
        milburn_report_uc_health: run(-5000, [["Health element", -5000]]),
        milburn_report_pip: run(-4000, [["PIP", -4000]]),
        [YOUTH]: run(1100.6, [["Youth Allowance (standard allowance)", 1100.6]]),
      },
    },
    {
      id: "parent",
      title: "19-year-old lone parent",
      description: "One child, no earnings.",
      notes: [],
      current_law: { net_income: 15000 },
      runs: { [PACKAGE]: run(0), [YOUTH]: run(0) },
    },
    // No current-law figure: dropped, never shown as zero
    { id: "broken", title: "Broken", current_law: {}, runs: { [PACKAGE]: run(-1) } },
  ],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("HouseholdExamples", () => {
  it("formats pounds with a sign and no pence", () => {
    expect(formatPounds(14246.87)).toBe("£14,247");
    expect(formatSignedPounds(1158.35)).toBe("+£1,158");
    expect(formatSignedPounds(-9883.38)).toBe("−£9,883");
    expect(formatSignedPounds(0.2)).toBe("£0");
  });

  it("refuses a file without its package or any complete household", () => {
    expect(parseHouseholds(null)).toBeNull();
    expect(parseHouseholds({ ...FILE, package_id: undefined })).toBeNull();
    expect(parseHouseholds({ ...FILE, households: [FILE.households[2]] })).toBeNull();
    expect(parseHouseholds(FILE).households.map((household) => household.id)).toEqual(["health", "parent"]);
  });

  it("shows each household's current-law income, package change and breakdown", () => {
    const { container } = render(<HouseholdExamples data={parseHouseholds(FILE)} />);
    expect(screen.getByRole("heading", { name: HOUSEHOLDS_TITLE })).toBeTruthy();
    const card = within(container.querySelector('[data-household="health"]'));
    expect(card.getByRole("heading", { name: "22-year-old renting alone" })).toBeTruthy();
    expect(card.getByText("£20,000 a year")).toBeTruthy();
    expect(container.querySelector('[data-household="health"] .hh-card-change.is-loss').textContent).toBe("−£9,000 a year");
    expect(card.getByText("Health element").nextSibling.textContent).toBe("−£5,000");
    expect(card.getByText("PIP").nextSibling.textContent).toBe("−£4,000");
    // A run outside the package is named and kept apart from the package's figure
    expect(card.getByText("Separate runs, not in the package")).toBeTruthy();
    expect(card.getByText("Youth Allowance, higher rate").nextSibling.textContent).toBe("+£1,101");
    // The package's parts are its breakdown, not runs of their own on the card
    expect(card.queryByText("PIP removal")).toBeNull();
  });

  it("says no change, and lists no run, where nothing applies", () => {
    const { container } = render(<HouseholdExamples data={parseHouseholds(FILE)} />);
    const card = container.querySelector('[data-household="parent"]');
    expect(card.querySelector(".hh-card-change").textContent).toBe("No change");
    expect(card.querySelector(".hh-card-others")).toBeNull();
    expect(card.textContent).not.toMatch(/£0/);
  });

  it("labels the figures and folds the assumptions under More info", () => {
    const { container } = render(<HouseholdExamples data={parseHouseholds(FILE)} />);
    expect(container.querySelector(".hh-label").textContent).toContain("PolicyEngine household calculation, 2029-30");
    const more = container.querySelector("details.hh-more");
    expect(more.open).toBe(false);
    expect(more.querySelector("summary").textContent).toBe("More info");
    expect(more.textContent).toContain("Renters pay £6,000 a year.");
    expect(more.textContent).toContain("Paid the protected rate.");
  });

  it("reads the published file and shows nothing when it is missing", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => FILE }));
    vi.stubGlobal("fetch", fetchMock);
    const { container, unmount } = render(<HouseholdExamples />);
    await waitFor(() => expect(container.querySelectorAll(".hh-card")).toHaveLength(2));
    expect(fetchMock.mock.calls[0][0]).toContain(`/data/${HOUSEHOLDS_FILE}`);
    unmount();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })),
    );
    const missing = render(<HouseholdExamples />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(missing.container.textContent).toBe("");
  });

  it("the published file passes the checks, with every household and the package run", () => {
    const path = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "public", "data", HOUSEHOLDS_FILE);
    const json = JSON.parse(readFileSync(path, "utf8"));
    const data = parseHouseholds(json);
    expect(data.label).toBe(HOUSEHOLDS_LABEL);
    expect(data.households).toHaveLength(json.households.length);
    for (const household of data.households) {
      const lines = household.packageRun.lines.reduce((sum, line) => sum + line.change, 0);
      expect(Math.abs(lines - household.packageRun.change)).toBeLessThan(0.05);
    }
  });
});
