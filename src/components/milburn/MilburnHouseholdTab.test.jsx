import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import MilburnHouseholdTab, { MILBURN_STEPS, formatSignedPounds, milburnStepSummary, pipKnockOn, resetSavedMilburnForm } from "./MilburnHouseholdTab";
import { normaliseHouseholdImpact } from "../../utils/householdImpactApi";
import { downloadMenus, STANDARD_FORMATS } from "../../test/downloadMenus";
import { waterfallCsv } from "../personal/NetIncomeWaterfall";
import {
  COLD_START_RETRY,
  DEFAULT_ANSWERS,
  PRESETS_FILE,
  RUNS,
  answersFromHousehold,
  calculateHousehold,
  householdRequest,
  milburnHouseholdUrl,
  parsePresets,
  withUcWithdrawn,
  storedExampleFor,
  summarise,
} from "../../utils/milburn/householdCalculator";

// The real stored examples (scripts/precompute_milburn_household_presets.py)
const FILE = JSON.parse(readFileSync(resolve(__dirname, "../../../public/data", PRESETS_FILE), "utf8"));
const PRESETS = parsePresets(FILE);
const example = (id) => PRESETS.examples.find((item) => item.id === id);
const API = "http://api.test/api/household-impact";

beforeEach(() => {
  resetSavedMilburnForm();
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
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
      expect(storedExampleFor(answersFromHousehold(item.household), PRESETS.examples).id).toBe(item.id);
    }
  });

  it("sends the Milburn answers the API takes", () => {
    const household = householdRequest({
      ...DEFAULT_ANSWERS,
      age: 21,
      region: "LONDON",
      tenure: "RENT_FROM_HA",
      monthlyRent: 600,
      hasPartner: true,
      partnerAge: 20,
      partnerSalary: 4000,
      partnerHealth: true,
      partnerPipMobility: "ENHANCED",
      childAges: [2, 17],
      childEducation: [true, false],
      health: true,
      newClaim: true,
      pipDailyLiving: "STANDARD",
      hours: 20,
      sector: "HOSPITALITY",
    });
    expect(household).toEqual({
      age: 21,
      employment_income: 0,
      salary_year: 2029,
      region: "LONDON",
      claims_universal_credit: true,
      council_tax: 0,
      tenure: "RENT_FROM_HA",
      monthly_rent: 600,
      has_partner: true,
      partner_age: 20,
      partner_employment_income: 4000,
      partner_limited_capability_for_work_related_activity: true,
      partner_pip_mobility: "ENHANCED",
      children: [{ age: 2 }, { age: 17, in_education: false }],
      limited_capability_for_work_related_activity: true,
      new_claimant_health_element: true,
      pip_daily_living: "STANDARD",
      hours_worked_per_week: 20,
      earnings_at_minimum_wage: true,
      employment_sector: "HOSPITALITY",
    });
    expect(householdRequest({ ...DEFAULT_ANSWERS, tenure: "PARENTS" })).toMatchObject({ lives_with_parents: true });
    expect(householdRequest({ ...DEFAULT_ANSWERS, tenure: "PARENTS" })).not.toHaveProperty("monthly_rent");
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
    const programmes = withUcWithdrawn(normaliseHouseholdImpact(example("retail_part_time").results.employer_ni).programmes);
    const uc = programmes.find((row) => row.id === "universal_credit");
    for (const side of ["before", "after"]) {
      expect(uc.children.reduce((total, child) => total + child[side], 0)).toBeCloseTo(uc[side], 1);
    }
    expect(uc.children.at(-1).id).toBe("uc_withdrawn");
  });

  it("posts one request for all four runs to the API's Milburn route", async () => {
    vi.stubEnv("NEXT_PUBLIC_HOUSEHOLD_API_URL", API);
    const calls = [];
    const fetchImpl = vi.fn(async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return { ok: true, json: async () => ({ year: 2029, runs: example("lone_parent").results }) };
    });
    const results = await calculateHousehold(answersFromHousehold(example("lone_parent").household), { runs: PRESETS.runs, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(calls[0].url).toBe("http://api.test/api/milburn-household");
    expect(calls[0].body).toEqual({ household: example("lone_parent").household });
    expect(Object.keys(results)).toEqual(RUNS.map((run) => run.key));
    expect(results.package).toEqual(example("lone_parent").results.package);
  });

  it("names the Milburn route beside the household route", () => {
    vi.stubEnv("NEXT_PUBLIC_HOUSEHOLD_API_URL", "https://x.modal.run/api/household-impact");
    expect(milburnHouseholdUrl()).toBe("https://x.modal.run/api/milburn-household");
    vi.stubEnv("NEXT_PUBLIC_HOUSEHOLD_API_URL", "http://localhost:8010/api/household-impact/");
    expect(milburnHouseholdUrl()).toBe("http://localhost:8010/api/milburn-household");
    vi.stubEnv("NEXT_PUBLIC_HOUSEHOLD_API_URL", "");
    expect(milburnHouseholdUrl()).toBeNull();
  });

  it("asks again while the service starts up, for up to four minutes, and refuses an answer missing a run", async () => {
    vi.useFakeTimers();
    try {
      vi.stubEnv("NEXT_PUBLIC_HOUSEHOLD_API_URL", API);
      const starting = { ok: false, status: 503, headers: new Headers({ "retry-after": "1" }), json: async () => ({ detail: "starting up", retry_after_seconds: 1 }) };
      const answered = { ok: true, json: async () => ({ runs: example("lone_parent").results }) };
      const fetchImpl = vi.fn().mockResolvedValueOnce(starting).mockResolvedValueOnce(answered);
      const onRetry = vi.fn();
      const pending = calculateHousehold(answersFromHousehold(example("lone_parent").household), { runs: PRESETS.runs, fetchImpl, onRetry });
      await vi.runAllTimersAsync();
      const results = await pending;
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(Object.keys(results)).toEqual(RUNS.map((run) => run.key));
      expect(COLD_START_RETRY.budgetMs).toBeGreaterThanOrEqual(240_000);
      const { package: _left, ...partial } = example("lone_parent").results;
      const missing = vi.fn(async () => ({ ok: true, json: async () => ({ runs: partial }) }));
      const refused = calculateHousehold(answersFromHousehold(example("lone_parent").household), { runs: PRESETS.runs, fetchImpl: missing }).catch((error) => error);
      await vi.runAllTimersAsync();
      expect((await refused).kind).toBe("server");
    } finally {
      vi.useRealTimers();
    }
  });
});

const openForm = () => fireEvent.click(screen.getByRole("button", { name: /^Your household/ }));
const pick = (group, option) => fireEvent.click(within(screen.getByRole("radiogroup", { name: group })).getByLabelText(option));

describe("MilburnHouseholdTab", () => {
  it("shows the eight example cards and Your household, with no result until one is chosen", () => {
    const { container } = render(<MilburnHouseholdTab presets={PRESETS} />);
    const grid = within(screen.getByRole("group", { name: "Example households" }));
    expect(grid.getAllByRole("button")).toHaveLength(8);
    expect(screen.getByRole("button", { name: /^Your household/ })).toBeTruthy();
    expect(container.querySelectorAll("[data-others]")).toHaveLength(8);
    expect(screen.queryByRole("region", { name: "Results" })).toBeNull();
  });

  it("shows a chosen example's stored result at once, with each run separately", () => {
    const fetchImpl = vi.fn();
    const { container } = render(<MilburnHouseholdTab presets={PRESETS} fetchImpl={fetchImpl} />);
    fireEvent.click(within(screen.getByRole("group", { name: "Example households" })).getByRole("button", { name: "22, renting alone" }));
    const results = example("renting_health").results;
    const tiles = within(screen.getByRole("region", { name: "Your result" }));
    expect(tiles.getByText(formatSignedPounds(results.package.net_income.change))).toBeTruthy();
    expect(tiles.getAllByText("£22,398").length).toBeGreaterThan(0);
    // The waterfall's two removals
    const steps = [...container.querySelectorAll(".waterfall-row.is-step")].map((row) => row.dataset.row);
    expect(steps.sort()).toEqual(["milburn_report_pip", "milburn_report_uc_health"]);
    // Each run's bar, named as the report's runs, with its own change
    for (const run of RUNS) {
      const bar = container.querySelector(`[data-policy="${run.key}"]`);
      expect(bar.getAttribute("aria-label")).toContain(run.name);
      expect(bar.getAttribute("aria-label")).toContain(formatSignedPounds(results[run.key].net_income.change).replace(/^\+?£0$/, "£0"));
    }
    expect(screen.getByRole("note").textContent).toMatch(/not\s+added to the health element and PIP removal or to each other/);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(new URLSearchParams(window.location.search).get("example")).toBe("renting_health");
  });

  it("offers every result chart and table as CSV, PNG and SVG", () => {
    const { container } = render(<MilburnHouseholdTab presets={PRESETS} />);
    fireEvent.click(within(screen.getByRole("group", { name: "Example households" })).getByRole("button", { name: "22, renting alone" }));
    const menus = downloadMenus(container);
    // The waterfall, the runs' bars and the breakdown table
    expect(menus.map((menu) => menu.name)).toEqual([
      "Download chart: How each removal changes your income",
      expect.stringMatching(/^Download chart: Change in net income by run, 2029-30/),
      expect.stringMatching(/^Download table: /),
    ]);
    for (const menu of menus) expect(menu.formats, menu.name).toEqual(STANDARD_FORMATS);
  });

  it("writes the waterfall's bars to CSV: net income after each, and each step's change", () => {
    const csv = waterfallCsv(
      { before: 10000, after: 8500, change: -1500 },
      [
        { id: "a", name: "Health element removal", rounded: -1000 },
        { id: "b", name: "PIP removal", rounded: -500 },
      ],
      { title: "How each removal changes your income", yearLabel: "2029-30", afterName: "With the removals", notes: ["Your change: −£1,500 a year"] },
    );
    const lines = csv.replace(/^\uFEFF/, "").trim().split("\r\n");
    expect(lines[0]).toBe('"# How each removal changes your income, 2029-30"');
    expect(lines.slice(2)).toEqual([
      "Step,Net income after this step (£),Change (£)",
      "Current law,10000,",
      "Health element removal,9000,-1000",
      "PIP removal,8500,-500",
      "With the removals,8500,",
      '"# Your change: −£1,500 a year"',
    ]);
  });

  it("opens an example from the address, by id or by number", () => {
    window.history.replaceState({}, "", "/?tab=household&example=retail_part_time");
    const { unmount } = render(<MilburnHouseholdTab presets={PRESETS} />);
    const change = example("retail_part_time").results.employer_ni.net_income.change;
    expect(document.querySelector('[data-policy="employer_ni"]').getAttribute("aria-label")).toContain(formatSignedPounds(change));
    unmount();
    resetSavedMilburnForm();
    window.history.replaceState({}, "", "/?tab=household&example=2");
    render(<MilburnHouseholdTab presets={PRESETS} />);
    // Chosen, the cards fold into the strip, the chosen chip selected
    expect(screen.getByRole("option", { name: /^22, renting alone/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("switches the breakdown table between the runs", () => {
    render(<MilburnHouseholdTab presets={PRESETS} />);
    fireEvent.click(within(screen.getByRole("group", { name: "Example households" })).getByRole("button", { name: "24, in hospitality with PIP" }));
    expect(screen.getByRole("tab", { name: "Health element and PIP removal" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("tab", { name: "Employer NI threshold" }));
    const table = screen.getByRole("table", { name: /Your income, taxes and benefits, 2029-30/ });
    expect(within(table).getByText("Net income")).toBeTruthy();
    expect(within(table).getByText("Under the run")).toBeTruthy();
    // Universal Credit's elements in view at first, with the withdrawal
    expect(within(table).getByText("Less: withdrawn against income")).toBeTruthy();
    expect(within(table).getByText("Health element (LCWRA)")).toBeTruthy();
  });

  it("asks the form's questions in numbered steps, the Milburn ones included", () => {
    render(<MilburnHouseholdTab presets={PRESETS} />);
    openForm();
    const form = within(screen.getByRole("form", { name: "Your household" }));
    for (const step of MILBURN_STEPS) expect(form.getByRole("group", { name: new RegExp(step.title) })).toBeTruthy();
    expect(form.getByLabelText("Age")).toBeTruthy();
    expect(form.getByRole("radiogroup", { name: "Housing" })).toBeTruthy();
    expect(form.getByRole("radiogroup", { name: "Health condition limiting work-related activity" })).toBeTruthy();
    expect(form.getByRole("radiogroup", { name: "PIP daily living" })).toBeTruthy();
    expect(form.getByRole("radiogroup", { name: "PIP mobility" })).toBeTruthy();
    // Shown only when they apply
    expect(form.queryByRole("radiogroup", { name: "Health element claimed" })).toBeNull();
    pick("Health condition limiting work-related activity", "Yes");
    expect(form.getByRole("radiogroup", { name: "Health element claimed" })).toBeTruthy();
    expect(form.queryByLabelText("Sector")).toBeNull();
    fireEvent.change(form.getByLabelText("Hours of paid work"), { target: { value: "20" } });
    fireEvent.blur(form.getByLabelText("Hours of paid work"));
    expect(form.getByLabelText("Sector")).toBeTruthy();
    pick("Partner", "Yes");
    expect(form.getByRole("radiogroup", { name: "Partner's PIP daily living" })).toBeTruthy();
    // No Budget-only questions
    expect(form.queryByText(/Student loan/)).toBeNull();
    expect(form.queryByText(/Council tax band/i)).toBeNull();
  });

  it("shows one chosen tile in each choice, every tile with its label", () => {
    render(<MilburnHouseholdTab presets={PRESETS} />);
    openForm();
    pick("Health condition limiting work-related activity", "Yes");
    pick("Health element claimed", "From April 2026");
    pick("PIP daily living", "Standard");
    pick("Partner", "Yes");
    for (const name of ["Health element claimed", "PIP daily living", "PIP mobility", "Partner's PIP daily living", "Partner's PIP mobility"]) {
      const group = screen.getByRole("radiogroup", { name });
      const tiles = [...group.querySelectorAll(".choice-tile")];
      expect(tiles.filter((tile) => tile.classList.contains("is-checked"))).toHaveLength(1);
      expect(tiles.every((tile) => tile.textContent.trim().length > 0)).toBe(true);
    }
    const checked = (name) => screen.getByRole("radiogroup", { name }).querySelector(".is-checked").textContent;
    expect(checked("Health element claimed")).toBe("From April 2026");
    expect(checked("PIP daily living")).toBe("Standard");
    expect(within(screen.getByRole("radiogroup", { name: "PIP daily living" })).getByLabelText("Standard").checked).toBe(true);
  });

  it("switches a choice's colours at once, never fading the tile under a white label", () => {
    const css = readFileSync(resolve(__dirname, "MilburnHouseholdTab.css"), "utf8");
    expect(css).toMatch(/\.milburn-household \.choice-segmented \.choice-tile \{\s*transition: border-color var\(--pe-transition-fast\);\s*\}/);
  });

  it("says when the PIP removal's step includes the housing element", () => {
    const view = normaliseHouseholdImpact(example("renting_health").results.package);
    expect(pipKnockOn(view)).toBe(
      "PIP removed (−£7,566) includes −£1,061 from Universal Credit's housing element: without PIP daily living, a young single renter is paid the shared accommodation rate.",
    );
    // Living with parents: no housing element, nothing to say
    expect(pipKnockOn(normaliseHouseholdImpact(example("with_parents_health").results.package))).toBeNull();
    render(<MilburnHouseholdTab presets={PRESETS} />);
    fireEvent.click(within(screen.getByRole("group", { name: "Example households" })).getByRole("button", { name: "22, renting alone" }));
    expect(document.querySelector('[data-note="pip-knock-on"]').textContent).toContain("shared accommodation rate");
  });

  it("summarises a closed step's changed answers", () => {
    expect(milburnStepSummary(["claimsUniversalCredit"], DEFAULT_ANSWERS).text).toBe("");
    expect(milburnStepSummary(["claimsUniversalCredit"], { ...DEFAULT_ANSWERS, claimsUniversalCredit: false }).text).toBe("Does not claim Universal Credit");
  });

  it("says custom households are not available yet when the build has no API", () => {
    vi.stubEnv("NEXT_PUBLIC_HOUSEHOLD_API_URL", "");
    render(<MilburnHouseholdTab presets={PRESETS} />);
    openForm();
    fireEvent.click(screen.getAllByRole("button", { name: /Calculate/ })[0]);
    expect(screen.getByText("Custom households are not available yet")).toBeTruthy();
    expect(screen.queryByText(/NEXT_PUBLIC_HOUSEHOLD_API_URL/)).toBeNull();
  });

  it("gives an example's own answers its stored result on Calculate, without the API", () => {
    vi.stubEnv("NEXT_PUBLIC_HOUSEHOLD_API_URL", API);
    const fetchImpl = vi.fn();
    render(<MilburnHouseholdTab presets={PRESETS} fetchImpl={fetchImpl} />);
    fireEvent.click(within(screen.getByRole("group", { name: "Example households" })).getByRole("button", { name: "19, lone parent" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit these answers" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Calculate/ })[0]);
    expect(fetchImpl).not.toHaveBeenCalled();
    const before = "£" + Math.round(example("lone_parent").results.package.net_income.baseline).toLocaleString("en-GB");
    expect(within(screen.getByRole("region", { name: "Your result" })).getAllByText(before).length).toBeGreaterThan(0);
    expect(screen.getByRole("option", { name: /^19, lone parent/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("posts a custom household with its Milburn answers on Calculate, and shows each run", async () => {
    vi.stubEnv("NEXT_PUBLIC_HOUSEHOLD_API_URL", API);
    const answer = example("hospitality_health").results;
    const bodies = [];
    const fetchImpl = vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ year: 2029, runs: answer }) };
    });
    const { container } = render(<MilburnHouseholdTab presets={PRESETS} fetchImpl={fetchImpl} />);
    openForm();
    const form = within(screen.getByRole("form", { name: "Your household" }));
    fireEvent.change(form.getByLabelText("Age"), { target: { value: "21" } });
    fireEvent.blur(form.getByLabelText("Age"));
    pick("Health condition limiting work-related activity", "Yes");
    pick("Health element claimed", "From April 2026");
    pick("PIP daily living", "Standard");
    fireEvent.change(form.getByLabelText("Hours of paid work"), { target: { value: "20" } });
    fireEvent.blur(form.getByLabelText("Hours of paid work"));
    fireEvent.change(form.getByLabelText("Sector"), { target: { value: "1" } });
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: /Calculate/ })[0]);
    });
    await waitFor(() => expect(screen.getByRole("region", { name: "Your result" })).toBeTruthy());
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(bodies[0].household).toMatchObject({
      age: 21,
      limited_capability_for_work_related_activity: true,
      new_claimant_health_element: true,
      pip_daily_living: "STANDARD",
      hours_worked_per_week: 20,
      earnings_at_minimum_wage: true,
      employment_sector: "HOSPITALITY",
      council_tax: 0,
    });
    for (const run of RUNS) {
      expect(container.querySelector(`[data-policy="${run.key}"]`).getAttribute("aria-label")).toContain(formatSignedPounds(answer[run.key].net_income.change));
    }
    // An edited answer takes the result away until Calculate
    pick("Partner", "Yes");
    expect(screen.getByText("Your answers have changed. Press Calculate to see the new result.")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Your result" })).toBeNull();
  });

  it("shows the API's refusal", async () => {
    vi.stubEnv("NEXT_PUBLIC_HOUSEHOLD_API_URL", API);
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 400, headers: new Headers(), json: async () => ({ detail: "Not a measure the calculation knows" }) }));
    render(<MilburnHouseholdTab presets={PRESETS} fetchImpl={fetchImpl} />);
    openForm();
    pick("Partner", "Yes");
    fireEvent.click(screen.getAllByRole("button", { name: /Calculate/ })[0]);
    expect((await screen.findByRole("alert")).textContent).toContain("Not a measure the calculation knows");
  });

  it("shows the separate runs' changes on each card", () => {
    const { container } = render(<MilburnHouseholdTab presets={PRESETS} />);
    const card = (id) => [...container.querySelectorAll("[data-others]")][PRESETS.examples.findIndex((item) => item.id === id)].textContent;
    expect(card("lone_parent")).toBe("Separate runs: +£1,158 Youth Allowance");
    expect(card("renting_health_25")).toBe("No change from the separate runs");
    expect(card("retail_part_time")).toContain("employer NI");
  });
});
