/**
 * Behavioural scenarios: illustrative second-round effects of the package,
 * read from public/data/milburn_scenarios.json, which the pipeline writes.
 * Its shape:
 *
 *   { year, basis, entry_cases: [{ id, hours, hourly_wage,
 *     net_income_gain_current_law, net_income_gain_package,
 *     exchequer_gain_current_law, exchequer_gain_package }], notes: [] }
 *
 * Each entry case is one young person moving into work for `hours` a week
 * at `hourly_wage`: their household's net income gain (£ a year) and the
 * gain to the Exchequer (£ a year), under current law and under the
 * package. The scenario multiplies the package's gain to the Exchequer by
 * the number of young people who move into work, an assumed share of the
 * young people the package leaves worse off. Not a PolicyEngine estimate:
 * the main figures are static.
 */

export const SCENARIOS_FILE = "milburn_scenarios.json";

/** The share presets offered (per cent), and the slider's range. */
export const SHARE_PRESETS = Object.freeze([0, 20, 45]);
export const SHARE_MIN = 0;
export const SHARE_MAX = 50;
export const DEFAULT_SHARE = 20;

/** The hours cases offered, by entry case id. */
export const HOURS_CASES = Object.freeze([
  { id: "h16", label: "16 hours a week" },
  { id: "h25", label: "25 hours a week" },
]);
export const DEFAULT_CASE = "h16";

const NUMBER_FIELDS = [
  "hours",
  "hourly_wage",
  "net_income_gain_current_law",
  "net_income_gain_package",
  "exchequer_gain_current_law",
  "exchequer_gain_package",
];

const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

/**
 * The file, checked: null unless it has a year and at least one entry
 * case with every figure a finite number. A case missing a figure is
 * dropped, never read as zero.
 */
export function parseScenarios(json) {
  if (!json || typeof json !== "object" || !isNumber(json.year)) return null;
  const cases = Array.isArray(json.entry_cases)
    ? json.entry_cases.filter(
        (entry) => entry && typeof entry.id === "string" && NUMBER_FIELDS.every((field) => isNumber(entry[field])),
      )
    : [];
  if (!cases.length) return null;
  return {
    year: json.year,
    basis: typeof json.basis === "string" ? json.basis : "",
    entryCases: cases,
    notes: Array.isArray(json.notes) ? json.notes.filter((note) => typeof note === "string") : [],
  };
}

/**
 * One scenario's figures, or null when any input is missing.
 *
 * @param {Object} args
 * @param {Object} args.entryCase - One parsed entry case
 * @param {number} args.sharePct - Share of the affected young people who move into work (0-100)
 * @param {number|null} args.affected - Young people the package leaves worse off
 * @param {number|null} args.staticBn - The package's static effect on the public finances, £bn (positive: a gain to the Exchequer)
 * @returns {{ movers: number, offsetM: number, staticM: number, afterM: number } | null}
 */
export function scenarioFigures({ entryCase, sharePct, affected, staticBn }) {
  if (!entryCase || !isNumber(sharePct) || !isNumber(affected) || !isNumber(staticBn)) return null;
  const movers = (affected * sharePct) / 100;
  const offsetM = (movers * entryCase.exchequer_gain_package) / 1e6;
  const staticM = staticBn * 1000;
  return { movers, offsetM, staticM, afterM: staticM + offsetM };
}

/** The package's static budgetary effect (£bn) in `year`, or null. */
export function packageStaticBn(rows, reformId, year) {
  if (!Array.isArray(rows) || !reformId) return null;
  const row = rows.find((candidate) => candidate.reform_id === reformId && Number(candidate.year) === Number(year));
  if (!row) return null;
  const value = Number(row.value);
  return row.value === null || row.value === "" || !Number.isFinite(value) ? null : value;
}
