/**
 * Return to work's entry cases, read from public/data/milburn_scenarios.json,
 * which the pipeline writes.
 * Its shape:
 *
 *   { year, basis, entry_cases: [{ id, hours, hourly_wage,
 *     net_income_gain_current_law, net_income_gain_package,
 *     exchequer_gain_current_law, exchequer_gain_package }], notes: [] }
 *
 * Each entry case is one young person moving into work for `hours` a week
 * at `hourly_wage`: their household's net income gain (£ a year) and the
 * gain to the Exchequer (£ a year), under current law and under the
 * package.
 */

export const SCENARIOS_FILE = "milburn_scenarios.json";

/** The hours cases offered, by entry case id. */
export const HOURS_CASES = Object.freeze([
  { id: "h16", label: "16 hours a week" },
  { id: "h25", label: "25 hours a week" },
]);

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

/** The package's static budgetary effect (£bn) in `year`, or null. */
export function packageStaticBn(rows, reformId, year) {
  if (!Array.isArray(rows) || !reformId) return null;
  const row = rows.find((candidate) => candidate.reform_id === reformId && Number(candidate.year) === Number(year));
  if (!row) return null;
  const value = Number(row.value);
  return row.value === null || row.value === "" || !Number.isFinite(value) ? null : value;
}
