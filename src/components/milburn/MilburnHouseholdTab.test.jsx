import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import MilburnHouseholdTab, { formatSignedPounds } from "./MilburnHouseholdTab";
import {
  PRESETS_FILE,
  RUNS,
  answersFromHousehold,
  calculateHousehold,
  householdRequest,
  parsePresets,
  programmeRows,
  summarise,
} from "../../utils/milburn/householdCalculator";

// The real stored examples (scripts/precompute_milburn_household_presets.py)
const FILE = JSON.parse(readFileSync(resolve(__dirname, "../../../public/data", PRESETS_FILE), "utf8"));
const PRESETS = parsePresets(FILE);
const example = (id) => PRESETS.examples.find((item) => item.id === id);

afterEach(() => {
  window.history.replaceState({}, "", "/");
  vi.unstubAllEnvs();
});

describe("householdCalculator", () => {
  it("reads all eight stored examples, each with every run", () => {
    expect(PRESETS.examples).toHaveLength(8);
    expect(FILE.runs.map((run) => run.key)).toEqual(RUNS.map((run) => run.key));
    expect(PRESETS.runs.find((run) => run.key === "package").policies).toHaveLength(2);
  });

  it("drops an example missing a run", () => {
    const broken = structuredClone(FILE);
    delete broken.examples[0].results.employer_ni;
    expect(parsePresets(broken).examples).toHaveLength(7);
    expect(parsePresets({})).toBeNull();
  });

  it("turns each example's answers into the form's and back unchanged", () => {
    for (const item of PRESETS.examples) {
      expect(householdRequest(answersFromHousehold(item.household))).toEqual(item.household);
    }
  });

  it("summarises the package with its two parts and the separate runs", () => {
    const summary = summarise(example("renting_health").results);
    expect(Math.round(summary.netIncome)).toBe(22398);
    const byKey = Object.fromEntries(summary.runs.map((run) => [run.key, run]));
    expect(Math.round(byKey.package.change)).toBe(-13096);
    expect(byKey.package.parts).toHaveLength(2);
    expect(byKey.package.parts.every((part) => part.change < 0)).toBe(true);
    expect(Math.round(byKey.youth_allowance.change)).toBe(1158);
  });

  it("adds Universal Credit's withdrawal so its lines add up to the award", () => {
    const result = example("retail_part_time").results.employer_ni;
    const uc = programmeRows(result).find((row) => row.id === "universal_credit");
    const lines = uc.children.reduce((total, child) => total + child.reform, 0);
    expect(lines).toBeCloseTo(uc.reform, 1);
    expect(uc.children.at(-1).id).toBe("uc_withdrawn");
  });

  it("posts one request per run to the household API", async () => {
    vi.stubEnv("NEXT_PUBLIC_HOUSEHOLD_API_URL", "http://api.test/api/household-impact");
    const bodies = [];
    const fetchImpl = vi.fn(async (url, init) => {
      bodies.push({ url, body: JSON.parse(init.body) });
      return { ok: true, json: async () => example("lone_parent").results.package };
    });
    const results = await calculateHousehold(answersFromHousehold(example("lone_parent").household), { runs: PRESETS.runs, fetchImpl });
    expect(Object.keys(results)).toEqual(RUNS.map((run) => run.key));
    expect(bodies.map((call) => call.url)).toEqual(Array(4).fill("http://api.test/api/household-impact"));
    expect(bodies.map((call) => call.body.policies)).toEqual(FILE.runs.map((run) => run.policies));
    expect(bodies[0].body).toMatchObject({ year: 2029, household: example("lone_parent").household, include: ["by_policy"] });
  });
});

describe("MilburnHouseholdTab", () => {
  it("shows the eight examples and the first one's result", () => {
    const { container } = render(<MilburnHouseholdTab presets={PRESETS} />);
    const cards = within(screen.getByRole("group", { name: "Example households" }));
    expect(container.querySelectorAll("[data-example]")).toHaveLength(8);
    expect(cards.getByRole("button", { name: "Your household" })).toBeTruthy();
    expect(cards.getByRole("button", { name: "20, living with parents" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("£11,324 a year")).toBeTruthy();
    const runs = container.querySelectorAll("[data-run]");
    expect([...runs].map((run) => run.dataset.run)).toEqual(RUNS.map((run) => run.key));
    expect(runs[0].textContent).toContain(formatSignedPounds(-6960.84));
  });

  it("opens an example from the address and shows its runs separately", () => {
    window.history.replaceState({}, "", "/?tab=household&example=retail_part_time");
    const { container } = render(<MilburnHouseholdTab presets={PRESETS} />);
    const run = (key) => container.querySelector(`[data-run="${key}"]`).textContent;
    expect(run("package")).toContain("No change");
    expect(run("youth_allowance")).toContain("+£1,158");
    expect(run("work_allowance")).toContain("Separate run; amount is our assumption");
    expect(run("employer_ni")).toContain("+£293");
  });

  it("writes the chosen example to the address and switches the breakdown's run", () => {
    render(<MilburnHouseholdTab presets={PRESETS} />);
    fireEvent.click(screen.getByRole("button", { name: "24, in hospitality with PIP" }));
    expect(new URLSearchParams(window.location.search).get("example")).toBe("hospitality_health");
    fireEvent.click(screen.getByRole("tab", { name: "Employer NI threshold" }));
    const table = screen.getByRole("table");
    expect(within(table).getByText("Net income")).toBeTruthy();
    expect(within(table).getByText("Less: withdrawn against income")).toBeTruthy();
  });

  it("says custom households need the API when the build has none", () => {
    vi.stubEnv("NEXT_PUBLIC_HOUSEHOLD_API_URL", "");
    render(<MilburnHouseholdTab presets={PRESETS} />);
    fireEvent.click(screen.getByRole("button", { name: "Change these answers" }));
    expect(screen.getByRole("note").textContent).toContain("Custom households need the household API");
    expect(screen.getByLabelText("Age")).toBeTruthy();
  });

  it("calculates a custom household through the API", async () => {
    vi.stubEnv("NEXT_PUBLIC_HOUSEHOLD_API_URL", "http://api.test/api/household-impact");
    const answer = example("lone_parent").results;
    const fetchImpl = vi.fn(async (_url, init) => {
      const policies = JSON.parse(init.body).policies;
      const run = PRESETS.runs.find((item) => item.policies.join() === policies.join());
      return { ok: true, json: async () => answer[run.key] };
    });
    render(<MilburnHouseholdTab presets={PRESETS} fetchImpl={fetchImpl} />);
    fireEvent.click(screen.getByRole("button", { name: "Your household" }));
    fireEvent.click(screen.getByRole("button", { name: "Calculate" }));
    await waitFor(() => expect(screen.getByText("Your household under each of the report's runs.")).toBeTruthy());
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    // An edited answer takes the old result away until it is calculated again
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Partner" })).getByLabelText("Yes"));
    expect(screen.queryByText("Your household under each of the report's runs.")).toBeNull();
  });

  it("shows the API's refusal", async () => {
    vi.stubEnv("NEXT_PUBLIC_HOUSEHOLD_API_URL", "http://api.test/api/household-impact");
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 400, headers: new Headers(), json: async () => ({ detail: "Not a measure the calculation knows" }) }));
    render(<MilburnHouseholdTab presets={PRESETS} fetchImpl={fetchImpl} />);
    fireEvent.click(screen.getByRole("button", { name: "Your household" }));
    fireEvent.click(screen.getByRole("button", { name: "Calculate" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Not a measure the calculation knows");
  });
});

describe("the coordinator's fixes", () => {
  it("shows the separate runs' gains on a card whose package line is no change", () => {
    const { container } = render(<MilburnHouseholdTab presets={PRESETS} />);
    const card = (id) => container.querySelector(`[data-example="${id}"] [data-others]`).textContent;
    expect(card("retail_part_time")).toBe("Separate runs: +£1,158 Youth Allowance · +£3,076 work allowance (illustrative) · +£293 employer NI");
    expect(card("lone_parent")).toBe("Separate runs: +£1,158 Youth Allowance");
    expect(card("renting_health_25")).toBe("No change from the separate runs");
  });

  it("leaves out unchanged rows other than Universal Credit, PIP and pay", () => {
    const ids = (result) => programmeRows(result).map((row) => row.id);
    expect(ids(example("renting_health").results.package)).toEqual(["universal_credit", "pip"]);
    const worker = ids(example("retail_part_time").results.employer_ni);
    expect(worker).toContain("employment_income");
    expect(worker).not.toContain("tv_licence");
  });

  it("names the run in lower case mid-sentence in the table's caption", () => {
    render(<MilburnHouseholdTab presets={PRESETS} />);
    expect(screen.getByRole("table", { name: /under the report's package, 2029-30/ })).toBeTruthy();
  });

  it("opens an example by its number as well as its id", () => {
    window.history.replaceState({}, "", "/?tab=household&example=2");
    render(<MilburnHouseholdTab presets={PRESETS} />);
    expect(screen.getByRole("button", { name: "22, renting alone" }).getAttribute("aria-pressed")).toBe("true");
  });
});
