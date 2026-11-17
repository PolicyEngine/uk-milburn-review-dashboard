/**
 * The Milburn Household impact tab's data: its four report runs, the form's
 * answers as the household API takes them, the stored examples
 * (public/data/milburn_household_presets.json, written by
 * scripts/precompute_milburn_household_presets.py) and a custom household's
 * request, one POST per run to NEXT_PUBLIC_HOUSEHOLD_API_URL.
 *
 * The runs mirror src/uk_budget_data/milburn_household.py RUNS: the
 * package is its two removals together; the other three are separate runs,
 * never added to it or to each other. Which measures each run sends comes
 * from the presets file (its runs' policies), not from here.
 */
import { MODAL_TIMEOUT_MS, householdApiUrl, postHouseholdImpactRetrying } from "../householdImpactApi";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const PRESETS_FILE = "milburn_household_presets.json";
export const YEAR = 2029;
export const FISCAL_YEAR = "2029-30";

// `inSentence`: the name mid-sentence; `short`: on an example's card
export const RUNS = [
  { key: "package", name: "Health element and PIP removal (no replacement awards)", inSentence: "the health element and PIP removal", short: "health element and PIP removal", kind: "package" },
  { key: "youth_allowance", name: "Higher Youth Allowance", inSentence: "the higher Youth Allowance", short: "Youth Allowance", kind: "separate" },
  { key: "work_allowance", name: "Work allowance (illustrative)", inSentence: "the work allowance (illustrative)", short: "work allowance (illustrative)", kind: "illustrative" },
  { key: "employer_ni", name: "Employer NI threshold", inSentence: "the employer NI threshold", short: "employer NI", kind: "separate" },
];

/**
 * The example id in the address as a stored example's id: its slug
 * ("retail_part_time") or its place in the list, 1 to 8 ("6"); null when
 * it names neither.
 */
export function resolveExampleId(value, examples) {
  if (!value) return null;
  if (examples.some((example) => example.id === value)) return value;
  if (/^[1-9][0-9]*$/.test(value)) return examples[Number(value) - 1]?.id ?? null;
  return null;
}

/** What each kind of run is, in a few words beside its name. */
export const KIND_LABELS = {
  package: "Health element and PIP removals, run together",
  separate: "Separate run, not in the package",
  illustrative: "Separate run; amount is our assumption",
};

export const PIP_OPTIONS = [
  { value: "NONE", label: "None" },
  { value: "STANDARD", label: "Standard" },
  { value: "ENHANCED", label: "Enhanced" },
];

export const SECTOR_OPTIONS = [
  { value: "OTHER", label: "Other" },
  { value: "RETAIL", label: "Retail" },
  { value: "HOSPITALITY", label: "Hospitality (food and drink service)" },
];

/** The form's answers for a new custom household. */
export const DEFAULT_ANSWERS = {
  age: 22,
  home: "renting",
  monthlyRent: 500,
  region: "NORTH_WEST",
  hasPartner: false,
  partnerAge: 22,
  partnerHealth: false,
  childAges: [],
  claimsUniversalCredit: true,
  health: false,
  newClaim: false,
  pipDailyLiving: "NONE",
  pipMobility: "NONE",
  hours: 0,
  pay: "minimum",
  salary: 0,
  sector: "OTHER",
};

/**
 * The form's answers as the API's household answers (HouseholdAnswersRequest):
 * 2029-30 pay, no Council Tax (left out, as in the stored examples), and
 * each Milburn answer only when it differs from the API's default.
 */
export function householdRequest(answers) {
  const a = { ...DEFAULT_ANSWERS, ...answers };
  const household = {
    age: a.age,
    employment_income: 0,
    salary_year: YEAR,
    region: a.region,
    claims_universal_credit: a.claimsUniversalCredit,
    council_tax: 0,
  };
  if (a.home === "parents") household.lives_with_parents = true;
  else {
    household.tenure = "RENT_PRIVATELY";
    household.monthly_rent = a.monthlyRent;
  }
  if (a.hasPartner) {
    household.has_partner = true;
    household.partner_age = a.partnerAge;
    household.partner_employment_income = 0;
    if (a.partnerHealth) household.partner_limited_capability_for_work_related_activity = true;
  }
  if (a.childAges.length) household.children = a.childAges.map((age) => ({ age }));
  if (a.health) {
    household.limited_capability_for_work_related_activity = true;
    if (a.newClaim) household.new_claimant_health_element = true;
  }
  if (a.pipDailyLiving !== "NONE") household.pip_daily_living = a.pipDailyLiving;
  if (a.pipMobility !== "NONE") household.pip_mobility = a.pipMobility;
  if (a.hours > 0) {
    household.hours_worked_per_week = a.hours;
    if (a.pay === "minimum") household.earnings_at_minimum_wage = true;
    else household.employment_income = a.salary;
    if (a.sector !== "OTHER") household.employment_sector = a.sector;
  }
  return household;
}

/** A stored example's household answers as the form's answers. */
export function answersFromHousehold(household) {
  const h = household ?? {};
  const hours = h.hours_worked_per_week ?? 0;
  return {
    ...DEFAULT_ANSWERS,
    age: h.age ?? DEFAULT_ANSWERS.age,
    home: h.lives_with_parents ? "parents" : "renting",
    monthlyRent: h.lives_with_parents ? DEFAULT_ANSWERS.monthlyRent : (h.monthly_rent ?? 0),
    region: h.region ?? DEFAULT_ANSWERS.region,
    hasPartner: Boolean(h.has_partner),
    partnerAge: h.partner_age ?? DEFAULT_ANSWERS.partnerAge,
    partnerHealth: Boolean(h.partner_limited_capability_for_work_related_activity),
    childAges: (h.children ?? []).map((child) => child.age),
    claimsUniversalCredit: h.claims_universal_credit !== false,
    health: Boolean(h.limited_capability_for_work_related_activity),
    newClaim: Boolean(h.new_claimant_health_element),
    pipDailyLiving: h.pip_daily_living ?? "NONE",
    pipMobility: h.pip_mobility ?? "NONE",
    hours,
    pay: hours > 0 && !h.earnings_at_minimum_wage ? "salary" : "minimum",
    salary: h.earnings_at_minimum_wage ? 0 : (h.employment_income ?? 0),
    sector: h.employment_sector ?? "OTHER",
  };
}

const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

/** Whether one run's answer has what the tab reads. */
export function isRunResult(result) {
  return Boolean(
    result &&
      isNumber(result.net_income?.baseline) &&
      isNumber(result.net_income?.reform) &&
      isNumber(result.net_income?.change) &&
      Array.isArray(result.programmes),
  );
}

/**
 * The presets file, checked: null unless it has at least one example with
 * an answer for every run. An example missing one is dropped, never shown
 * in part.
 */
export function parsePresets(json) {
  if (!json || typeof json !== "object" || !Array.isArray(json.examples)) return null;
  // Each run's measures, as the file lists them: every run must be there
  const policies = Object.fromEntries(
    (Array.isArray(json.runs) ? json.runs : [])
      .filter((run) => run && typeof run.key === "string" && Array.isArray(run.policies) && run.policies.length > 0)
      .map((run) => [run.key, run.policies]),
  );
  if (!RUNS.every((run) => policies[run.key])) return null;
  const examples = json.examples.filter(
    (example) =>
      example &&
      typeof example.id === "string" &&
      typeof example.title === "string" &&
      example.household &&
      RUNS.every((run) => isRunResult(example.results?.[run.key])),
  );
  if (!examples.length) return null;
  return {
    label: typeof json.label === "string" ? json.label : `PolicyEngine household calculation, ${FISCAL_YEAR}`,
    build: typeof json.build === "string" ? json.build : "",
    assumptions: Array.isArray(json.assumptions) ? json.assumptions.filter((item) => typeof item === "string") : [],
    runs: RUNS.map((run) => ({ ...run, policies: policies[run.key] })),
    runDescriptions: Object.fromEntries(
      (Array.isArray(json.runs) ? json.runs : []).filter((run) => run && typeof run.key === "string").map((run) => [run.key, run.description ?? ""]),
    ),
    examples: examples.map((example) => ({
      id: example.id,
      title: example.title,
      description: typeof example.description === "string" ? example.description : "",
      icon: example.icon,
      household: example.household,
      results: example.results,
    })),
  };
}

export async function loadPresets(fetchImpl = fetch) {
  try {
    const response = await fetchImpl(`${BASE}/data/${PRESETS_FILE}`, { cache: "no-cache" });
    return response.ok ? parsePresets(await response.json()) : null;
  } catch {
    return null;
  }
}

/**
 * The tab's summary of one household's four answers: current-law net
 * income, and each run's change, the package with its parts.
 */
export function summarise(results) {
  const first = results?.[RUNS[0].key];
  if (!RUNS.every((run) => isRunResult(results?.[run.key]))) return null;
  return {
    netIncome: first.net_income.baseline,
    runs: RUNS.map((run) => {
      const result = results[run.key];
      const parts =
        run.kind === "package"
          ? (result.by_policy?.measures ?? []).map((measure) => ({
              id: measure.id,
              name: measure.name,
              change: measure.change,
            }))
          : [];
      return { ...run, change: result.net_income.change, netIncome: result.net_income.reform, parts };
    }),
  };
}

/**
 * The programme rows a run moves or the household has: each row and child
 * with a non-zero amount under current law or the run, in the API's order.
 */
// Rows shown whether or not the run changes them (with each child the
// household has): Universal Credit's elements, PIP and pay. Any other row
// is shown only when the run changes it (a tax on the extra pay, say), so
// an unchanged TV licence or income tax is left out.
export const ALWAYS_SHOWN_ROWS = ["universal_credit", "pip", "employment_income"];

export function programmeRows(result) {
  const has = (row) => Math.round(row.baseline) !== 0 || Math.round(row.reform) !== 0;
  const changes = (row) => Math.round(row.change) !== 0;
  return (result?.programmes ?? [])
    .filter((row) => has(row) && (ALWAYS_SHOWN_ROWS.includes(row.id) || changes(row)))
    .map((row) => {
      const always = ALWAYS_SHOWN_ROWS.includes(row.id) && row.id !== "employment_income";
      const children = (row.children ?? []).filter((child) => has(child) && (always || changes(child)));
      if (row.id === "universal_credit" && children.length) children.push(ucWithdrawn(row));
      return { ...row, children: children.filter(has) };
    });
}

/** "+£1,158 Youth Allowance · +£3,076 work allowance (illustrative)": the separate runs that change a household. */
export function separateRunsLine(summary, formatSigned) {
  return (summary?.runs ?? [])
    .filter((run) => run.kind !== "package" && Math.round(run.change) !== 0)
    .map((run) => `${formatSigned(run.change)} ${run.short}`)
    .join(" · ");
}

/**
 * Universal Credit's elements less the award: what is withdrawn against
 * income (the 55% taper on earnings, and other income), shown as a
 * negative line under the elements, so the lines add up to the award.
 */
function ucWithdrawn(row) {
  const sum = (side) => (row.children ?? []).reduce((total, child) => total + child[side], 0);
  const baseline = row.baseline - sum("baseline");
  const reform = row.reform - sum("reform");
  return { id: "uc_withdrawn", label: "Less: withdrawn against income", baseline, reform, change: reform - baseline, signed: true };
}

/** Whether custom households can be calculated on this build. */
export const customAvailable = () => Boolean(householdApiUrl());

/**
 * One custom household's four answers: one POST per run (`runs`, with each
 * one's policies, from parsePresets), at once, to the household API as the
 * Autumn Budget calculator posts (NEXT_PUBLIC_HOUSEHOLD_API_URL is the
 * endpoint itself, …/api/household-impact), retried while a scaled-to-zero
 * service starts up (postHouseholdImpactRetrying). Rejects with an Error
 * whose message the tab can show.
 */
export async function calculateHousehold(answers, { runs, fetchImpl, signal, onRetry } = {}) {
  if (!householdApiUrl()) throw new Error("Custom households need the household API, which this build does not have.");
  if (!runs?.length) throw new Error("The runs to calculate are not available.");
  const household = householdRequest(answers);
  const entries = await Promise.all(
    runs.map(async (run) => {
      try {
        const body = { year: YEAR, policies: run.policies, household, include: ["by_policy"] };
        return [run.key, await postHouseholdImpactRetrying(body, { fetchImpl, signal, timeoutMs: MODAL_TIMEOUT_MS, onRetry })];
      } catch (error) {
        if (signal?.aborted) throw error;
        const fields = (error.fields ?? []).map((field) => `${field.label}: ${field.message}`).join("; ");
        throw new Error(fields ? `${error.message} ${fields}` : error.message);
      }
    }),
  );
  return Object.fromEntries(entries);
}

/** The example id in the address (?example=), or null. */
export function exampleFromLocation(location) {
  try {
    return new URLSearchParams(location?.search ?? "").get("example");
  } catch {
    return null;
  }
}

/** Write the example id into the address with replaceState (null clears it). */
export function writeExampleToLocation(id) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("example", id);
  else url.searchParams.delete("example");
  window.history.replaceState(window.history.state, "", url);
}
