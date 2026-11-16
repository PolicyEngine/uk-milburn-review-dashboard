/**
 * Benchmarks: published reference figures (public/data/milburn_benchmarks.json,
 * static, written by hand), each with its source, beside a PolicyEngine
 * estimate where there is a comparable figure: either worked out from the
 * results (`run`/`reform_id` with a `metric`) or a fixed figure from a named
 * build (`value`, with its `basis` and `label`).
 */
import { youngPeopleWorseOff } from "./youngPeople";

export const BENCHMARKS_FILE = "milburn_benchmarks.json";

/**
 * The themes the Benchmarks cards are grouped under, in order, each with its
 * icon (TitleIcon) and the rows it holds; a row no theme lists goes under
 * the last, "Other figures".
 */
export const BENCHMARK_THEMES = [
  {
    key: "people",
    title: "People and caseloads",
    icon: "usersRound",
    ids: ["neet_16_24", "uc_health_no_work_requirements", "uc_lcwra_16_24", "package_young_people_affected"],
  },
  {
    key: "spending",
    title: "Spending and costs",
    icon: "landmark",
    ids: ["incapacity_spending_18_24", "young_benefits_spend", "employer_nics_under_25"],
  },
  {
    key: "poverty",
    title: "Poverty and extra costs",
    icon: "percent",
    ids: ["kept_out_of_poverty", "pip_no_extra_costs"],
  },
  { key: "other", title: "Other figures", icon: "list", ids: [] },
];

/** The rows by theme, in the themes' order; a theme with no rows is left out. */
export function benchmarkGroups(rows) {
  const known = new Set(BENCHMARK_THEMES.flatMap((theme) => theme.ids));
  return BENCHMARK_THEMES.map((theme) => ({
    ...theme,
    rows: theme.key === "other" ? rows.filter((row) => !known.has(row.id)) : rows.filter((row) => theme.ids.includes(row.id)),
  })).filter((group) => group.rows.length > 0);
}

const text = (value) => (typeof value === "string" ? value : "");

/** The file, checked: null without a list of rows. */
export function parseBenchmarks(json) {
  if (!json || typeof json !== "object" || !Array.isArray(json.rows)) return null;
  const rows = json.rows
    .filter((row) => row && typeof row.id === "string" && typeof row.figure === "string")
    .map((row) => ({
      id: row.id,
      figure: row.figure,
      value: text(row.value),
      basis: text(row.basis),
      source: text(row.source),
      url: typeof row.url === "string" && /^https:\/\//.test(row.url) ? row.url : null,
      date: text(row.date),
      pressReport: row.press_report === true,
      estimate:
        row.policyengine_estimate && typeof row.policyengine_estimate.value === "string" && row.policyengine_estimate.value.trim()
          ? {
              fixed: row.policyengine_estimate.value.trim(),
              basis: text(row.policyengine_estimate.basis),
              label: text(row.policyengine_estimate.label),
            }
          : row.policyengine_estimate && (row.policyengine_estimate.run === "package" || typeof row.policyengine_estimate.reform_id === "string")
          ? {
              package: row.policyengine_estimate.run === "package",
              reformId: typeof row.policyengine_estimate.reform_id === "string" ? row.policyengine_estimate.reform_id : null,
              metric: text(row.policyengine_estimate.metric),
              label: text(row.policyengine_estimate.label),
            }
          : null,
    }));
  return {
    title: text(json.title),
    note: text(json.note),
    year: Number.isFinite(json.policyengine_estimate_year) ? json.policyengine_estimate_year : null,
    rows,
  };
}

/**
 * A row's PolicyEngine estimate from the age table, or null where none is
 * comparable or the verified results lack it: the package's run (`run:
 * "package"`, its rows and key from usePackageTable) or one measure's.
 */
export function estimateFor(row, { ageRows, packageRows, packageKey, year }) {
  if (!row.estimate || row.estimate.fixed || year === null) return null;
  if (row.estimate.metric !== "young_people_worse_off") return null;
  if (row.estimate.package) return youngPeopleWorseOff(packageRows, packageKey, year);
  return youngPeopleWorseOff(ageRows, row.estimate.reformId, year);
}
