/**
 * The Milburn Household impact tab's data: which published runs it covers,
 * the form's answers as the household API takes them, the stored examples
 * (public/data/milburn_household_presets.json, written by
 * scripts/precompute_milburn_household_presets.py) and a custom household's
 * request, one POST to the API's Milburn route for the run chosen in the
 * header (milburnHouseholdUrl, beside NEXT_PUBLIC_HOUSEHOLD_API_URL).
 *
 * The tab follows the one run the header chooses, as the other tabs do:
 * runs are never added up. Which runs it covers, and why it does not cover
 * the others, comes from the presets file (src/uk_budget_data/
 * milburn_household.py NOT_COVERED), not from here.
 */
import { MODAL_TIMEOUT_MS, householdApiUrl, postHouseholdImpactRetrying } from "../householdImpactApi";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const PRESETS_FILE = "milburn_household_presets.json";
export const YEAR = 2029;
export const FISCAL_YEAR = "2029-30";

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

const text = (value) => (typeof value === "string" ? value : "");

/**
 * The presets file, checked: null unless it lists the runs and has at least
 * one example. Each run is covered (with its measures) or not (with the
 * reason the page gives); an example keeps only the covered runs it has an
 * answer for, so a run missing from an example shows as not stored, never
 * in part.
 */
export function parsePresets(json) {
  if (!json || typeof json !== "object" || !Array.isArray(json.examples) || !Array.isArray(json.runs)) return null;
  const runs = json.runs
    .filter((run) => run && typeof run.id === "string")
    .map((run) => {
      const covered = run.covered === true && Array.isArray(run.policies) && run.policies.length > 0;
      return {
        id: run.id,
        name: text(run.name),
        description: text(run.description),
        covered,
        policies: covered ? run.policies : [],
        reason: covered ? "" : text(run.reason) || "The household calculator does not cover this run.",
        note: covered ? text(run.note) : "",
      };
    });
  if (!runs.length) return null;
  const coveredIds = runs.filter((run) => run.covered).map((run) => run.id);
  const examples = json.examples
    .filter((example) => example && typeof example.id === "string" && typeof example.title === "string" && example.household)
    .map((example) => ({
      id: example.id,
      title: example.title,
      description: text(example.description),
      icon: example.icon,
      household: example.household,
      results: Object.fromEntries(coveredIds.filter((id) => isRunResult(example.results?.[id])).map((id) => [id, example.results[id]])),
    }));
  if (!examples.length) return null;
  return {
    label: text(json.label) || `PolicyEngine household calculation, ${FISCAL_YEAR}`,
    build: text(json.build),
    // One short line each, with a TitleIcon name; an older file's plain
    // strings take the info icon
    assumptions: Array.isArray(json.assumptions)
      ? json.assumptions
          .map((item) => (typeof item === "string" ? { icon: "info", text: item } : { icon: text(item?.icon) || "info", text: text(item?.text) }))
          .filter((item) => item.text)
      : [],
    runs,
    examples,
  };
}

/**
 * Whether the calculator covers the run chosen in the header: the run as
 * the presets file lists it, with `covered` false and the reason when it
 * does not (a run the file does not list, or no single run chosen,
 * included).
 */
export function runCoverage(presets, runId) {
  if (!runId) return { id: null, name: "", description: "", covered: false, policies: [], note: "", reason: "Choose one policy in the header to see its effect on a household." };
  const run = presets?.runs?.find((item) => item.id === runId);
  if (run) return run;
  return { id: runId, name: "", description: "", covered: false, policies: [], note: "", reason: "The household calculator has no results for this run." };
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
 * One household's answer under one run: current-law net income, the run's
 * change and net income, and a combined run's parts (each member on its
 * own); null when the run has no answer.
 */
export function summarise(result) {
  if (!isRunResult(result)) return null;
  const measures = result.by_policy?.measures ?? [];
  return {
    netIncome: result.net_income.baseline,
    change: result.net_income.change,
    netIncomeAfter: result.net_income.reform,
    parts: measures.length > 1 ? measures.map((measure) => ({ id: measure.id, name: measure.name, change: measure.change })) : [],
  };
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
 * How long a custom household waits while the service starts: the Budget
 * calculator's retries (RETRY_POLICY) over up to four minutes. With a
 * container kept warm an answer takes seconds; after a deploy, or when
 * many households arrive at once, new containers start, which has taken a
 * minute or two.
 */
export const COLD_START_RETRY = Object.freeze({ budgetMs: 240_000, maxRetries: 6 });

/**
 * What the waiting panel says (ProcessingPanel's `times`): a custom
 * household's chosen run on the Modal app (uk_budget_data/modal_household.py).
 * The four runs the tab sent before took 9.5–18 s for one household with
 * the containers warm (18 November 2026); one run takes less. Past
 * `stillWorking` seconds new containers may be starting.
 */
export const CALCULATION_TIMES = Object.freeze({
  typical: 15,
  slow: 90,
  text: "Usually 15–30 seconds",
  stillWorking: 25,
  stillWorkingText: "Still working: when many people use it at once this can take a minute or two",
});
export const STARTING_UP_TEXT = "After a quiet spell or when many people use it at once this can take a minute or two. Your result will appear here.";

/** Whether custom households can be calculated on this build. */
export const customAvailable = () => Boolean(householdApiUrl());

/**
 * The address of the API's Milburn route (/api/milburn-household), beside
 * the household route NEXT_PUBLIC_HOUSEHOLD_API_URL names
 * (…/api/household-impact); null without one.
 */
export function milburnHouseholdUrl() {
  const url = householdApiUrl();
  if (!url) return null;
  const [path, query] = url.split("?");
  const base = path.replace(/\/household-impact\/?$/, "");
  return `${base === path ? path.replace(/\/$/, "") : base}/milburn-household${query ? `?${query}` : ""}`;
}

const hasRun = (runId) => (payload) => isRunResult(payload?.runs?.[runId]);

/**
 * One custom household's answer under the run chosen in the header: one
 * POST to the API's Milburn route (milburnHouseholdUrl) naming that run,
 * answered exactly as the household route answers it; retried while the
 * service starts up (postHouseholdImpactRetrying). Rejects with the API
 * client's error (HouseholdApiError: its kind, message and the answers it
 * names), which SingleYearError shows.
 */
export async function calculateHousehold(answers, { runId, fetchImpl, signal, onRetry } = {}) {
  if (!householdApiUrl()) throw Object.assign(new Error("Custom households need the household API, which this build does not have."), { kind: "unavailable" });
  if (!runId) throw new Error("Choose one policy in the header to calculate.");
  const payload = await postHouseholdImpactRetrying(
    { household: householdRequest(answers), runs: [runId] },
    { url: milburnHouseholdUrl(), isAnswer: hasRun(runId), fetchImpl, signal, timeoutMs: MODAL_TIMEOUT_MS, onRetry, retry: COLD_START_RETRY },
  );
  return payload.runs[runId];
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
