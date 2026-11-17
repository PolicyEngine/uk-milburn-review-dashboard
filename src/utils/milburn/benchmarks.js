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
    ids: ["incapacity_spending_18_24", "young_benefits_spend", "milburn_welfare_saving_10y", "employer_nics_under_25"],
  },
  {
    key: "poverty",
    title: "Poverty and extra costs",
    icon: "percent",
    ids: ["kept_out_of_poverty", "pip_no_extra_costs"],
  },
  { key: "other", title: "Other figures", icon: "list", ids: [] },
];

/**
 * One-line card titles, each figure's own icon (TitleIcon) and, where the
 * file's wording is long, a one-line basis for the published figure
 * (`basis`) or the PolicyEngine estimate (`estimateBasis`), by row id; the
 * file's full wording stays as the line's tooltip.
 */
export const BENCHMARK_SHORT = {
  neet_16_24: { label: "16–24s not in education, employment or training", icon: "cap" },
  uc_health_no_work_requirements: {
    label: "On UC health with no work requirements",
    icon: "heartPulse",
    estimateBasis: "Benefit units with LCWRA, every adult under 25, UK",
  },
  uc_lcwra_16_24: {
    label: "16–24s in a UC LCWRA subgroup, as reported",
    icon: "activity",
    basis: "DWP statistics via Benefits and Work; a subgroup, not the full LCWRA caseload",
  },
  package_young_people_affected: {
    label: "Young people affected by the package",
    icon: "usersRound",
    basis: "No published figure",
    estimateBasis: "16–24s in households the package makes worse off",
  },
  incapacity_spending_18_24: { label: "Incapacity benefit spending, ages 18 to 24", icon: "trend" },
  young_benefits_spend: { label: "PIP and UC health spending on young people", icon: "banknote" },
  milburn_welfare_saving_10y: {
    label: "Welfare savings Milburn expects over ten years",
    icon: "coins",
    basis: "Said before the report; if changes come quickly, initial costs met by the government",
  },
  employer_nics_under_25: {
    label: "Cost of zero employer NICs for under-25s",
    icon: "building",
    estimateBasis: "Static cost, UK",
  },
  kept_out_of_poverty: { label: "Kept out of poverty by UC health and/or PIP", icon: "shield" },
  pip_no_extra_costs: { label: "Young PIP claimants reporting no extra costs", icon: "receipt" },
};

/** The icon of a figure with none of its own. */
export const BENCHMARK_ICON = "fileText";

/**
 * A figure's number and unit from its wording, where it is one plain number:
 * "260,000" is a count, "£5.1bn a year" is £ billion (`text` is the number
 * as worded, without "a year"). Null for anything
 * else ("About 1.0 million", a range), which is never drawn as a bar.
 */
export function figureNumber(value) {
  const words = String(value || "").trim();
  const count = /^(\d{1,3}(?:,\d{3})*)$/.exec(words);
  if (count) return { number: Number(count[1].replace(/,/g, "")), unit: "count", text: count[1] };
  const billions = /^(£(\d+(?:\.\d+)?)bn)(?: a year)?$/.exec(words);
  if (billions) return { number: Number(billions[2]), unit: "bn", text: billions[1] };
  return null;
}

/**
 * A row's published figure and its fixed PolicyEngine estimate as two
 * numbers in one unit, with the gap between them: the estimate less the
 * published figure, as a % of the published figure. Null unless both are
 * plain numbers in the same unit.
 */
export function comparisonFor(row) {
  if (!row?.estimate?.fixed) return null;
  const published = figureNumber(splitValue(row.value).value);
  const estimate = figureNumber(row.estimate.fixed);
  if (!published || !estimate || published.unit !== estimate.unit || !(published.number > 0)) return null;
  return {
    unit: published.unit,
    published: published.number,
    publishedText: published.text,
    estimate: estimate.number,
    estimateText: estimate.text,
    gapPct: ((estimate.number - published.number) / published.number) * 100,
  };
}

/** "£1.3bn (2022) to £2.0bn (2025)" as its two dated points; null for any other wording. */
export function figureRange(value) {
  const match = /^(£(\d+(?:\.\d+)?)bn) \((\d{4})\) to (£(\d+(?:\.\d+)?)bn) \((\d{4})\)$/.exec(String(value || "").trim());
  if (!match) return null;
  return [
    { label: match[3], text: match[1], number: Number(match[2]) },
    { label: match[6], text: match[4], number: Number(match[5]) },
  ];
}

/** "About 1 in 5" as { count: 1, of: 5 }; null for any other wording or more than ten. */
export function figureShare(value) {
  const match = /^(?:About )?(\d+) in (\d+)$/.exec(String(value || "").trim());
  if (!match) return null;
  const [count, of] = [Number(match[1]), Number(match[2])];
  return of >= 2 && of <= 10 && count <= of ? { count, of } : null;
}

/** "£5.1bn a year; about £132,000 per extra job" as its headline value and a one-line note. */
export function splitValue(value) {
  const [head, ...rest] = String(value || "").split("; ");
  const note = rest.join("; ");
  return { value: head, note: note ? note.charAt(0).toUpperCase() + note.slice(1) : "" };
}

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
