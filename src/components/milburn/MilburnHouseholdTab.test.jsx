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
  answersFromHousehold,
  calculateHousehold,
  householdRequest,
  milburnHouseholdUrl,
  parsePresets,
  runCoverage,
  withUcWithdrawn,
  storedExampleFor,
  summarise,
} from "../../utils/milburn/householdCalculator";

// The real stored examples (scripts/precompute_milburn_household_presets.py)
const FILE = JSON.parse(readFileSync(resolve(__dirname, "../../../public/data", PRESETS_FILE), "utf8"));
const PRESETS = parsePresets(FILE);
const example = (id) => PRESETS.examples.find((item) => item.id === id);
const API = "http://api.test/api/household-impact";
// The runs these tests choose in the header
const PACKAGE = "milburn_report_package";
const YOUTH = "milburn_report_youth_allowance_independent";
const EMPLOYER_NI = "milburn_report_employer_nics_threshold";
const PHASED = "milburn_report_package_phased";
const COVERED = FILE.runs.filter((run) => run.covered).map((run) => run.id);

beforeEach(() => {
  resetSavedMilburnForm();
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("householdCalculator", () => {
  it("reads all eight stored examples, each with every covered run", () => {
    expect(PRESETS.examples).toHaveLength(8);
    expect(COVERED.length).toBeGreaterThan(10);
    for (const item of PRESETS.examples) expect(Object.keys(item.results).sort()).toEqual([...COVERED].sort());
    expect(runCoverage(PRESETS, PACKAGE)).toMatchObject({ covered: true, policies: [PACKAGE] });
    // A run the calculator does not cover comes with its reason, and no figure
    expect(runCoverage(PRESETS, PHASED)).toMatchObject({ covered: false, reason: expect.stringMatching(/random draw/) });
    expect(PRESETS.examples.every((item) => !(PHASED in item.results))).toBe(true);
  });

  it("reads each assumption as one short line with an icon, and an older file's strings with the info icon", () => {
    expect(PRESETS.assumptions.length).toBeGreaterThan(0);
    for (const item of PRESETS.assumptions) {
      expect(item.icon).toMatch(/^[a-zA-Z]+$/);
      expect(item.text.split(/\s+/).length).toBeLessThanOrEqual(25);
    }
    const old = parsePresets({ ...FILE, assumptions: ["Council Tax is left out.", { icon: "house" }] });
    expect(old.assumptions).toEqual([{ icon: "info", text: "Council Tax is left out." }]);
  });

  it("keeps the runs an example has, and says when no single run is chosen", () => {
    const broken = structuredClone(FILE);
    delete broken.examples[0].results[EMPLOYER_NI];
    const parsed = parsePresets(broken);
    expect(parsed.examples).toHaveLength(8);
    expect(parsed.examples[0].results).not.toHaveProperty(EMPLOYER_NI);
    expect(parsed.examples[0].results).toHaveProperty(PACKAGE);
    expect(parsePresets({})).toBeNull();
    expect(runCoverage(PRESETS, null)).toMatchObject({ covered: false, reason: expect.stringMatching(/Choose one policy/) });
    expect(runCoverage(PRESETS, "not_a_run")).toMatchObject({ covered: false });
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

  it("summarises one run: the package with its two parts, a single run with none", () => {
    const pkg = summarise(example("renting_health").results[PACKAGE]);
    expect(Math.round(pkg.netIncome)).toBe(22398);
    expect(Math.round(pkg.change)).toBe(-13096);
    expect(pkg.parts).toHaveLength(2);
    expect(pkg.parts.every((part) => part.change < 0)).toBe(true);
    const youth = summarise(example("renting_health").results[YOUTH]);
    expect(Math.round(youth.change)).toBe(1158);
    expect(youth.parts).toEqual([]);
    expect(summarise(undefined)).toBeNull();
  });

  it("adds Universal Credit's withdrawal so its lines add up to the award", () => {
    const programmes = withUcWithdrawn(normaliseHouseholdImpact(example("retail_part_time").results[EMPLOYER_NI]).programmes);
    const uc = programmes.find((row) => row.id === "universal_credit");
    for (const side of ["before", "after"]) {
      expect(uc.children.reduce((total, child) => total + child[side], 0)).toBeCloseTo(uc[side], 1);
    }
    expect(uc.children.at(-1).id).toBe("uc_withdrawn");
  });

  it("posts one request for the chosen run to the API's Milburn route", async () => {
    vi.stubEnv("NEXT_PUBLIC_HOUSEHOLD_API_URL", API);
    const calls = [];
    const fetchImpl = vi.fn(async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return { ok: true, json: async () => ({ year: 2029, runs: { [YOUTH]: example("lone_parent").results[YOUTH] } }) };
    });
    const result = await calculateHousehold(answersFromHousehold(example("lone_parent").household), { runId: YOUTH, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(calls[0].url).toBe("http://api.test/api/milburn-household");
    expect(calls[0].body).toEqual({ household: example("lone_parent").household, runs: [YOUTH] });
    expect(result).toEqual(example("lone_parent").results[YOUTH]);
  });

  it("names the Milburn route beside the household route", () => {
    vi.stubEnv("NEXT_PUBLIC_HOUSEHOLD_API_URL", "https://x.modal.run/api/household-impact");
    expect(milburnHouseholdUrl()).toBe("https://x.modal.run/api/milburn-household");
    vi.stubEnv("NEXT_PUBLIC_HOUSEHOLD_API_URL", "http://localhost:8010/api/household-impact/");
    expect(milburnHouseholdUrl()).toBe("http://localhost:8010/api/milburn-household");
    vi.stubEnv("NEXT_PUBLIC_HOUSEHOLD_API_URL", "");
    expect(milburnHouseholdUrl()).toBeNull();
  });

  it("asks again while the service starts up, for up to four minutes, and refuses an answer missing the run", async () => {
    vi.useFakeTimers();
    try {
      vi.stubEnv("NEXT_PUBLIC_HOUSEHOLD_API_URL", API);
      const starting = { ok: false, status: 503, headers: new Headers({ "retry-after": "1" }), json: async () => ({ detail: "starting up", retry_after_seconds: 1 }) };
      const answered = { ok: true, json: async () => ({ runs: { [PACKAGE]: example("lone_parent").results[PACKAGE] } }) };
      const fetchImpl = vi.fn().mockResolvedValueOnce(starting).mockResolvedValueOnce(answered);
      const onRetry = vi.fn();
      const pending = calculateHousehold(answersFromHousehold(example("lone_parent").household), { runId: PACKAGE, fetchImpl, onRetry });
      await vi.runAllTimersAsync();
      const result = await pending;
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(result).toEqual(example("lone_parent").results[PACKAGE]);
      expect(COLD_START_RETRY.budgetMs).toBeGreaterThanOrEqual(240_000);
      // Another run's answer is not the chosen run's
      const missing = vi.fn(async () => ({ ok: true, json: async () => ({ runs: { [YOUTH]: example("lone_parent").results[YOUTH] } }) }));
      const refused = calculateHousehold(answersFromHousehold(example("lone_parent").household), { runId: PACKAGE, fetchImpl: missing }).catch((error) => error);
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
    const { container } = render(<MilburnHouseholdTab runId={PACKAGE} presets={PRESETS} />);
    const grid = within(screen.getByRole("group", { name: "Example households" }));
    expect(grid.getAllByRole("button")).toHaveLength(8);
    expect(screen.getByRole("button", { name: /^Your household/ })).toBeTruthy();
    // No other run's figure on the cards: the chosen run's alone
    expect(container.querySelectorAll("[data-others]")).toHaveLength(0);
    expect(screen.queryByRole("region", { name: "Results" })).toBeNull();
  });

  it("shows a chosen example's stored result at once, under the chosen run only", () => {
    const fetchImpl = vi.fn();
    const { container } = render(<MilburnHouseholdTab runId={PACKAGE} presets={PRESETS} fetchImpl={fetchImpl} />);
    fireEvent.click(within(screen.getByRole("group", { name: "Example households" })).getByRole("button", { name: "22, renting alone" }));
    const results = example("renting_health").results;
    const tiles = within(screen.getByRole("region", { name: "Your result" }));
    expect(tiles.getByText(formatSignedPounds(results[PACKAGE].net_income.change))).toBeTruthy();
    expect(tiles.getAllByText("£22,398").length).toBeGreaterThan(0);
    // The waterfall's two removals, each on its own
    const steps = [...container.querySelectorAll(".waterfall-row.is-step")].map((row) => row.dataset.row);
    expect(steps.sort()).toEqual(["milburn_report_pip", "milburn_report_uc_health"]);
    // No bars for other runs: runs are never shown side by side or added up
    expect(container.querySelector("[data-policy]")).toBeNull();
    expect(screen.queryByText(/Change in net income by run/)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(new URLSearchParams(window.location.search).get("example")).toBe("renting_health");
  });

  it("follows the run chosen in the header", () => {
    const { container, rerender } = render(<MilburnHouseholdTab runId={PACKAGE} presets={PRESETS} />);
    fireEvent.click(within(screen.getByRole("group", { name: "Example households" })).getByRole("button", { name: "22, renting alone" }));
    rerender(<MilburnHouseholdTab runId={YOUTH} presets={PRESETS} />);
    const tiles = within(screen.getByRole("region", { name: "Your result" }));
    expect(tiles.getAllByText(formatSignedPounds(example("renting_health").results[YOUTH].net_income.change)).length).toBeGreaterThan(0);
    expect(tiles.getByText(/from Higher Youth Allowance for under-25s living independently/)).toBeTruthy();
    expect(container.querySelectorAll(".waterfall-row.is-step")).toHaveLength(1);
    expect(screen.queryAllByText(formatSignedPounds(example("renting_health").results[PACKAGE].net_income.change))).toHaveLength(0);
  });

  it("shows a run it does not cover as not covered, with the reason and no figure", () => {
    const { container } = render(<MilburnHouseholdTab runId={PHASED} presets={PRESETS} />);
    const grid = within(screen.getByRole("group", { name: "Example households" }));
    expect(grid.getAllByText("Not covered")).toHaveLength(8);
    fireEvent.click(grid.getByRole("button", { name: "22, renting alone" }));
    expect(screen.getByText("Not covered by the household calculator")).toBeTruthy();
    expect(container.querySelector(`[data-not-covered="${PHASED}"]`).textContent).toMatch(/random draw/);
    expect(screen.queryByRole("region", { name: "Your result" })).toBeNull();
    expect(container.querySelector(".waterfall-row")).toBeNull();
  });

  it("offers every result chart and table as CSV, PNG and SVG", () => {
    const { container } = render(<MilburnHouseholdTab runId={PACKAGE} presets={PRESETS} />);
    fireEvent.click(within(screen.getByRole("group", { name: "Example households" })).getByRole("button", { name: "22, renting alone" }));
    const menus = downloadMenus(container);
    // The waterfall and the breakdown table
    expect(menus.map((menu) => menu.name)).toEqual(["Download chart: How each part changes your income", expect.stringMatching(/^Download table: /)]);
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
    const { unmount } = render(<MilburnHouseholdTab runId={EMPLOYER_NI} presets={PRESETS} />);
    const change = example("retail_part_time").results[EMPLOYER_NI].net_income.change;
    expect(within(screen.getByRole("region", { name: "Your result" })).getAllByText(formatSignedPounds(change)).length).toBeGreaterThan(0);
    unmount();
    resetSavedMilburnForm();
    window.history.replaceState({}, "", "/?tab=household&example=2");
    render(<MilburnHouseholdTab runId={PACKAGE} presets={PRESETS} />);
    // Chosen, the cards fold into the strip, the chosen chip selected
    expect(screen.getByRole("option", { name: /^22, renting alone/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("breaks the chosen run down by programme", () => {
    render(<MilburnHouseholdTab runId={EMPLOYER_NI} presets={PRESETS} />);
    fireEvent.click(within(screen.getByRole("group", { name: "Example households" })).getByRole("button", { name: "24, in hospitality with PIP" }));
    expect(screen.queryByRole("tab")).toBeNull();
    const table = screen.getByRole("table", { name: /Your income, taxes and benefits, 2029-30/ });
    expect(within(table).getByText("Net income")).toBeTruthy();
    expect(within(table).getByText("Under the policy")).toBeTruthy();
    // Universal Credit's elements in view at first, with the withdrawal
    expect(within(table).getByText("Less: withdrawn against income")).toBeTruthy();
    expect(within(table).getByText("Health element (LCWRA)")).toBeTruthy();
  });

  it("asks the form's questions in numbered steps, the Milburn ones included", () => {
    render(<MilburnHouseholdTab runId={PACKAGE} presets={PRESETS} />);
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
    render(<MilburnHouseholdTab runId={PACKAGE} presets={PRESETS} />);
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
    const view = normaliseHouseholdImpact(example("renting_health").results[PACKAGE]);
    expect(pipKnockOn(view)).toBe(
      "PIP removed (−£7,566) includes −£1,061 from Universal Credit's housing element: without PIP daily living, a young single renter is paid the shared accommodation rate.",
    );
    // Living with parents: no housing element, nothing to say
    expect(pipKnockOn(normaliseHouseholdImpact(example("with_parents_health").results[PACKAGE]))).toBeNull();
    render(<MilburnHouseholdTab runId={PACKAGE} presets={PRESETS} />);
    fireEvent.click(within(screen.getByRole("group", { name: "Example households" })).getByRole("button", { name: "22, renting alone" }));
    expect(document.querySelector('[data-note="pip-knock-on"]').textContent).toContain("shared accommodation rate");
  });

  it("summarises a closed step's changed answers", () => {
    expect(milburnStepSummary(["claimsUniversalCredit"], DEFAULT_ANSWERS).text).toBe("");
    expect(milburnStepSummary(["claimsUniversalCredit"], { ...DEFAULT_ANSWERS, claimsUniversalCredit: false }).text).toBe("Does not claim Universal Credit");
  });

  it("says custom households are not available yet when the build has no API", () => {
    vi.stubEnv("NEXT_PUBLIC_HOUSEHOLD_API_URL", "");
    render(<MilburnHouseholdTab runId={PACKAGE} presets={PRESETS} />);
    openForm();
    fireEvent.click(screen.getAllByRole("button", { name: /Calculate/ })[0]);
    expect(screen.getByText("Custom households are not available yet")).toBeTruthy();
    expect(screen.queryByText(/NEXT_PUBLIC_HOUSEHOLD_API_URL/)).toBeNull();
  });

  it("gives an example's own answers its stored result on Calculate, without the API", () => {
    vi.stubEnv("NEXT_PUBLIC_HOUSEHOLD_API_URL", API);
    const fetchImpl = vi.fn();
    render(<MilburnHouseholdTab runId={PACKAGE} presets={PRESETS} fetchImpl={fetchImpl} />);
    fireEvent.click(within(screen.getByRole("group", { name: "Example households" })).getByRole("button", { name: "19, lone parent" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit these answers" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Calculate/ })[0]);
    expect(fetchImpl).not.toHaveBeenCalled();
    const before = "£" + Math.round(example("lone_parent").results[PACKAGE].net_income.baseline).toLocaleString("en-GB");
    expect(within(screen.getByRole("region", { name: "Your result" })).getAllByText(before).length).toBeGreaterThan(0);
    expect(screen.getByRole("option", { name: /^19, lone parent/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("posts a custom household with its Milburn answers on Calculate, and asks again for a run chosen after", async () => {
    vi.stubEnv("NEXT_PUBLIC_HOUSEHOLD_API_URL", API);
    const answer = example("hospitality_health").results;
    const bodies = [];
    const fetchImpl = vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      bodies.push(body);
      return { ok: true, json: async () => ({ year: 2029, runs: Object.fromEntries(body.runs.map((id) => [id, answer[id]])) }) };
    });
    const { rerender } = render(<MilburnHouseholdTab runId={PACKAGE} presets={PRESETS} fetchImpl={fetchImpl} />);
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
    expect(bodies[0].runs).toEqual([PACKAGE]);
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
    const tile = () => within(screen.getByRole("region", { name: "Your result" }));
    expect(tile().getAllByText(formatSignedPounds(answer[PACKAGE].net_income.change)).length).toBeGreaterThan(0);
    // Another run chosen in the header: asked for, the same answers
    await act(async () => {
      rerender(<MilburnHouseholdTab runId={EMPLOYER_NI} presets={PRESETS} fetchImpl={fetchImpl} />);
    });
    await waitFor(() => expect(tile().getAllByText(formatSignedPounds(answer[EMPLOYER_NI].net_income.change)).length).toBeGreaterThan(0));
    expect(bodies[1]).toEqual({ household: bodies[0].household, runs: [EMPLOYER_NI] });
    // Back to the first: kept, not asked for again
    await act(async () => {
      rerender(<MilburnHouseholdTab runId={PACKAGE} presets={PRESETS} fetchImpl={fetchImpl} />);
    });
    expect(tile().getAllByText(formatSignedPounds(answer[PACKAGE].net_income.change)).length).toBeGreaterThan(0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    // An edited answer takes the result away until Calculate
    pick("Partner", "Yes");
    expect(screen.getByText("Your answers have changed. Press Calculate to see the new result.")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Your result" })).toBeNull();
  });

  it("shows the API's refusal", async () => {
    vi.stubEnv("NEXT_PUBLIC_HOUSEHOLD_API_URL", API);
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 400, headers: new Headers(), json: async () => ({ detail: "Not a measure the calculation knows" }) }));
    render(<MilburnHouseholdTab runId={PACKAGE} presets={PRESETS} fetchImpl={fetchImpl} />);
    openForm();
    pick("Partner", "Yes");
    fireEvent.click(screen.getAllByRole("button", { name: /Calculate/ })[0]);
    expect((await screen.findByRole("alert")).textContent).toContain("Not a measure the calculation knows");
  });
});
