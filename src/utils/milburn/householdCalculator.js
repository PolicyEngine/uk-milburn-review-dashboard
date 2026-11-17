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

// `inSentence`: the name mid-sentence; `short`: on an example's card and
// in the waterfall; `tab`: the programme table's tab
export const RUNS = [
  {
    key: "package",
    name: "Health element and PIP removal (no replacement awards)",
    inSentence: "the health element and PIP removal",
    short: "health element and PIP removal",
    tab: "Health element and PIP removal",
    kind: "package",
  },
  { key: "youth_allowance", name: "Higher Youth Allowance", inSentence: "the higher Youth Allowance", short: "Youth Allowance", tab: "Higher Youth Allowance", kind: "separate" },
  {
    key: "work_allowance",
    name: "Work allowance (illustrative; amount is our assumption)",
    inSentence: "the work allowance (illustrative)",
    short: "work allowance (illustrative)",
    tab: "Work allowance (illustrative)",
    kind: "illustrative",
  },
  { key: "employer_ni", name: "Employer NI threshold", inSentence: "the employer NI threshold", short: "employer NI", tab: "Employer NI threshold", kind: "separate" },
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

export const PIP_OPTIONS = [
  { value: "NONE", label: "None" },
  { value: "STANDARD", label: "Standard" },
  { value: "ENHANCED", label: "Enhanced" },
];

export const SECTOR_OPTIONS = [
  { value: "RETAIL", label: "Retail" },
  { value: "HOSPITALITY", label: "Hospitality (food and drink service)" },
  { value: "OTHER", label: "Other" },
];

// The home: renting (from whichever landlord), owned, or living with
// parents, which the API models as the young person's own household with
// no rent (lives_with_parents)
export const PARENTS = "PARENTS";
export const RENTING_TENURES = ["RENT_PRIVATELY", "RENT_FROM_COUNCIL", "RENT_FROM_HA"];
export const isRentingTenure = (tenure) => RENTING_TENURES.includes(tenure);
// From 16 a child's answers say whether they are in school or college
export const EDUCATION_AGE = 16;
export const OLDEST_CHILD = 19;

/** The form's answers for a new custom household. */
export const DEFAULT_ANSWERS = {
  age: 22,
  region: "NORTH_WEST",
  tenure: "RENT_PRIVATELY",
  monthlyRent: 500,
  hasPartner: false,
  partnerAge: 22,
  partnerSalary: 0,
  partnerHealth: false,
  partnerPipDailyLiving: "NONE",
  partnerPipMobility: "NONE",
  childAges: [],
  childEducation: [],
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
 * each Milburn answer only when it differs from the API's default, so a
 * stored example's answers go back unchanged.
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
  if (a.tenure === PARENTS) household.lives_with_parents = true;
  else {
    household.tenure = a.tenure;
    if (isRentingTenure(a.tenure)) household.monthly_rent = a.monthlyRent;
  }
  if (a.hasPartner) {
    household.has_partner = true;
    household.partner_age = a.partnerAge;
    household.partner_employment_income = a.partnerSalary;
    if (a.partnerHealth) household.partner_limited_capability_for_work_related_activity = true;
    if (a.partnerPipDailyLiving !== "NONE") household.partner_pip_daily_living = a.partnerPipDailyLiving;
    if (a.partnerPipMobility !== "NONE") household.partner_pip_mobility = a.partnerPipMobility;
  }
  if (a.childAges.length) {
    household.children = a.childAges.map((age, index) =>
      age >= EDUCATION_AGE ? { age, in_education: a.childEducation[index] !== false } : { age },
    );
  }
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
  const children = h.children ?? [];
  const tenure = h.lives_with_parents ? PARENTS : (h.tenure ?? "OWNED_WITH_MORTGAGE");
  return {
    ...DEFAULT_ANSWERS,
    age: h.age ?? DEFAULT_ANSWERS.age,
    region: h.region ?? DEFAULT_ANSWERS.region,
    tenure,
    monthlyRent: isRentingTenure(tenure) ? (h.monthly_rent ?? 0) : DEFAULT_ANSWERS.monthlyRent,
    hasPartner: Boolean(h.has_partner),
    partnerAge: h.partner_age ?? DEFAULT_ANSWERS.partnerAge,
    partnerSalary: h.partner_employment_income ?? 0,
    partnerHealth: Boolean(h.partner_limited_capability_for_work_related_activity),
    partnerPipDailyLiving: h.partner_pip_daily_living ?? "NONE",
    partnerPipMobility: h.partner_pip_mobility ?? "NONE",
    childAges: children.map((child) => child.age),
    childEducation: children.map((child) => child.in_education !== false),
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

/** "+£1,158 Youth Allowance · +£3,076 work allowance (illustrative)": the separate runs that change a household. */
export function separateRunsLine(summary, formatSigned) {
  return (summary?.runs ?? [])
    .filter((run) => run.kind !== "package" && Math.round(run.change) !== 0)
    .map((run) => `${formatSigned(run.change)} ${run.short}`)
    .join(" · ");
}

/**
 * The programmes (normaliseHouseholdImpact's rows) with Universal Credit's
 * elements less the award as one more line under the elements: what is
 * withdrawn against income (the 55% taper on earnings, and other income),
 * so the lines add up to the award under current law and under the run.
 */
export function withUcWithdrawn(programmes) {
  return (programmes ?? []).map((row) => {
    if (row.id !== "universal_credit" || !row.children?.length) return row;
    const sum = (side) => row.children.reduce((total, child) => total + child[side], 0);
    const before = row.before - sum("before");
    const after = row.after - sum("after");
    if (Math.round(before) === 0 && Math.round(after) === 0) return row;
    const withdrawn = { id: "uc_withdrawn", label: "Less: withdrawn against income", note: null, before, after, change: after - before, children: [] };
    return { ...row, children: [...row.children, withdrawn] };
  });
}

/**
 * How long a custom household waits for a scaled-to-zero service: the
 * Budget calculator's retries (RETRY_POLICY) over up to four minutes, as a
 * Modal cold start of the Milburn app has taken close to three.
 */
export const COLD_START_RETRY = Object.freeze({ budgetMs: 240_000, maxRetries: 6 });

/** Whether custom households can be calculated on this build. */
export const customAvailable = () => Boolean(householdApiUrl());

/**
 * One custom household's four answers: one POST per run (`runs`, with each
 * one's policies, from parsePresets), the first alone and then the other
 * three together, to the household API as the
 * Autumn Budget calculator posts (NEXT_PUBLIC_HOUSEHOLD_API_URL is the
 * endpoint itself, …/api/household-impact), retried while a scaled-to-zero
 * service starts up (postHouseholdImpactRetrying). Rejects with the API
 * client's error (HouseholdApiError: its kind, message and the answers it
 * names), which SingleYearError shows.
 */
export async function calculateHousehold(answers, { runs, fetchImpl, signal, onRetry } = {}) {
  if (!householdApiUrl()) throw Object.assign(new Error("Custom households need the household API, which this build does not have."), { kind: "unavailable" });
  if (!runs?.length) throw new Error("The runs to calculate are not available.");
  const household = householdRequest(answers);
  const post = (run) =>
    postHouseholdImpactRetrying(
      { year: YEAR, policies: run.policies, household, include: ["by_policy"] },
      { fetchImpl, signal, timeoutMs: MODAL_TIMEOUT_MS, onRetry, retry: COLD_START_RETRY },
    );
  // The first run alone, through a cold start; the others once the
  // service answers, together
  const [first, ...rest] = runs;
  const firstResult = await post(first);
  const others = await Promise.all(rest.map(async (run) => [run.key, await post(run)]));
  return Object.fromEntries([[first.key, firstResult], ...others]);
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

/** Two answers to the API are the same household (key order aside). */
export function sameHousehold(a, b) {
  const canonical = (value) =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === "object"
        ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
        : value;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/** The stored example these answers are, unedited, if any. */
export function storedExampleFor(answers, examples) {
  const household = householdRequest(answers);
  return (examples ?? []).find((example) => sameHousehold(example.household, household)) ?? null;
}
