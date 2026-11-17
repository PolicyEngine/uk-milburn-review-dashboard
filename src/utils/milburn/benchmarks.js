/**
 * Benchmarks: published reference figures (public/data/milburn_benchmarks.json,
 * static, written by hand), each with its source, beside a PolicyEngine
 * estimate where there is a figure on the same basis: either worked out from
 * the results (`run`/`reform_id` with a `metric`) or a fixed figure from a
 * named build (`value`, with its `basis`, `label` and an optional `note` on
 * why the two differ). A row may also carry our saving from a measure
 * (`policyengine_saving`), shown apart and labelled as a saving, never set
 * against published spending.
 */
import { youngPeopleWorseOff } from "./youngPeople";

export const BENCHMARKS_FILE = "milburn_benchmarks.json";

/**
 * The sections of the Benchmarks sub-tab, in order: the question each
 * answers, a one-line introduction, its icon (TitleIcon) and the rows it
 * holds; a row no section lists goes under the last, the review's context.
 */
export const BENCHMARK_SECTIONS = [
  {
    key: "caseloads",
    title: "How do our caseloads compare?",
    intro: "Published counts of young people on the UC health element or PIP, beside ours for the same ages, for 2025.",
    icon: "usersRound",
    ids: ["uc_health_no_work_requirements", "uc_health_element_16_24", "young_pip_recipients", "package_young_people_affected"],
  },
  {
    key: "spending",
    title: "How does our spending compare?",
    intro: "Published spending and costs for 2025-26, beside ours for the same year in cash terms; our savings from the measures are shown apart on each card.",
    icon: "landmark",
    ids: ["pip_spend_16_24", "uc_health_spend_16_24", "young_benefits_spend", "employer_nics_under_25"],
  },
  {
    key: "jobs",
    title: "Where do young people work?",
    intro: "The review's share of young people's jobs in retail and hospitality, the sectors its employer NI threshold starts with, beside ours for the same industries.",
    icon: "briefcase",
    ids: ["retail_hospitality_jobs_16_24"],
  },
  {
    key: "review",
    title: "The review's own estimates",
    intro: "These include replacement awards, a Youth Allowance, a work allowance and more young people in work, in 2026-27 prices; our static runs include none of them, so no PolicyEngine figure is set beside them.",
    icon: "scale",
    ids: ["review_welfare_saving_2036", "milburn_welfare_saving_10y", "relative_poverty_review", "young_net_incomes_review"],
  },
  {
    key: "poverty",
    title: "Poverty",
    intro: "What the benefits do for young people today, as published.",
    icon: "percent",
    ids: ["kept_out_of_poverty", "pip_no_extra_costs"],
  },
  {
    key: "context",
    title: "Context from the review",
    intro: "Published figures on young people, work and costs that we do not estimate.",
    icon: "book",
    ids: [
      "neet_16_24",
      "neet_rate_projection_2036",
      "hidden_neets_england",
      "disabled_neet_16_24",
      "incapacity_benefits_young",
      "dla_pip_16_24",
      "child_dla_recipients",
      "pip_spend_trend_16_24",
      "uc_health_spend_young_2024",
      "into_sustained_work_2036",
      "review_investment_2036",
      "youth_hiring_incentives_cost",
      "incapacity_spending_18_24",
    ],
  },
];

/**
 * One-line card titles, each figure's own icon (TitleIcon) and, where the
 * file's wording is long, a one-line basis for the published figure
 * (`basis`) or the PolicyEngine estimate (`estimateBasis`), by row id; the
 * file's full wording stays as the line's tooltip.
 */
export const BENCHMARK_SHORT = {
  neet_16_24: {
    label: "16–24s not in education, employment or training",
    icon: "cap",
    basis: "Labour Force Survey, April to June 2026, UK: 13.0% of 16–24s",
  },
  neet_rate_projection_2036: {
    label: "NEET rate the review projects for 2036-37",
    icon: "arrowDown",
    basis: "16–24s, UK, from 13.1% in 2026-27; the ambition is around 5%",
  },
  into_sustained_work_2036: {
    label: "Into sustained work by 2036, the review expects",
    icon: "briefcase",
    basis: "All its recommendations, not the benefit changes alone",
  },
  uc_health_no_work_requirements: {
    label: "On UC health with no work requirements",
    icon: "heartPulse",
    basis: "Basis not published: no age range, date or source given",
  },
  uc_health_element_16_24: {
    label: "16–24s receiving the UC health element",
    icon: "activity",
    estimateBasis: "Ages 16 to 24, Great Britain, 2025",
  },
  incapacity_benefits_young: {
    label: "Young people on incapacity benefits, the review says",
    icon: "lifebuoy",
    basis: "More than double the number in 2012",
  },
  young_pip_recipients: {
    label: "Young people receiving PIP",
    icon: "clipboard",
    estimateBasis: "Ages 16 to 24, England and Wales, 2025",
  },
  dla_pip_16_24: {
    label: "16–24s receiving DLA or PIP, the review says",
    icon: "layers",
    basis: "From DWP Stat-Xplore; double the number in 2012",
  },
  package_young_people_affected: {
    label: "Young people affected by the package",
    icon: "usersRound",
    basis: "No published figure",
    estimateBasis: "16–24s in households the package makes worse off",
  },
  young_benefits_spend: {
    label: "PIP and UC health spending on young people",
    icon: "banknote",
    basis: "2025-26, ages 16 to 24: PIP £3.8bn, UC LCWRA £0.92bn",
    estimateBasis: "Spending in 2025, cash terms: PIP in England and Wales, the health element in Great Britain",
  },
  pip_spend_16_24: {
    label: "PIP spending, ages 16 to 24",
    icon: "wallet",
    basis: "Spending in 2025-26",
    estimateBasis: "Spending in 2025, England and Wales, cash terms",
  },
  uc_health_spend_16_24: {
    label: "UC LCWRA element spending, ages 16 to 24",
    icon: "piggy",
    basis: "Spending in 2025-26",
    estimateBasis: "Spending in 2025, Great Britain, cash terms",
  },
  incapacity_spending_18_24: { label: "Incapacity benefit spending, ages 18 to 24", icon: "trend" },
  review_welfare_saving_2036: {
    label: "Annual welfare saving the review estimates",
    icon: "scale",
    basis: "2026-27 prices, UK; replacement awards, a Youth Allowance and a work allowance included",
  },
  milburn_welfare_saving_10y: {
    label: "Cumulative welfare savings by 2036-37",
    icon: "coins",
    basis: "Eight years, 2029-30 to 2036-37, 2026-27 prices",
  },
  review_investment_2036: {
    label: "Annual cost of the review's recommendations",
    icon: "calculator",
    basis: "Gross, 2026-27 prices; offset by £3.6bn welfare savings and £2.4bn fiscal offsets",
  },
  youth_hiring_incentives_cost: {
    label: "Cost of the review's youth hiring incentives",
    icon: "userPlus",
    basis: "Youth Jobs Grant and apprenticeships; no separate employer NI cost",
  },
  employer_nics_under_25: {
    label: "Cost of zero employer NI for under-25s",
    icon: "building",
    basis: "Gross cost in 2025-26; not a recommendation of the review",
    estimateBasis: "Gross static cost, 2025-26, UK, cash terms",
  },
  relative_poverty_review: {
    label: "Relative poverty after housing costs, the review estimates",
    icon: "house",
    basis: "Once fully rolled out, with 440,000 more young people in work",
  },
  kept_out_of_poverty: { label: "Kept out of poverty by UC health and/or PIP", icon: "shield" },
  young_net_incomes_review: {
    label: "Rise in young people's net incomes, the review estimates",
    icon: "bars",
    basis: "All its reforms, with 440,000 more young people in work (paragraphs 111 and 739)",
  },
  retail_hospitality_jobs_16_24: {
    label: "16–24s' jobs in retail and hospitality",
    icon: "cart",
    basis: "ONS, sections G and I, to 2025 (paragraph 50); ours is 26% in the run's divisions 47, 55 and 56",
    estimateBasis: "Main job in sections G or I, ages 16 to 24, UK, 2025",
  },
  pip_spend_trend_16_24: {
    label: "PIP spending on 16–24s over time, the review says",
    icon: "calendar",
    basis: "Around £1.3bn in 2019-20; around £6.5bn within five years (paragraph 653)",
  },
  uc_health_spend_young_2024: {
    label: "UC spending on young people with a health issue, the review says",
    icon: "tag",
    basis: "Overall UC spend, almost doubled since 2019-20 (paragraph 653)",
  },
  hidden_neets_england: {
    label: "Hidden NEETs in England, the review says",
    icon: "user",
    basis: "18–24s out of work and education, not receiving benefits, 2023-24 (paragraph 275)",
  },
  disabled_neet_16_24: {
    label: "Disabled 16–24s not in education, employment or training",
    icon: "users",
    basis: "2025-26: around 3.5 times the non-disabled rate (paragraph 692)",
  },
  child_dla_recipients: {
    label: "Children receiving DLA, the review says",
    icon: "clock",
    basis: "About 77% move to PIP by 17, implying about 23% do not (paragraph 759)",
  },
  pip_no_extra_costs: { label: "Young PIP claimants reporting no extra costs", icon: "receipt" },
};

/**
 * Pairs whose two figures still count different things, by row id, with the
 * difference in a few words: drawn side by side, with no gap between them
 * (a gap would read as a check on the published figure). The other pairs
 * are like for like (the same ages, area, year and measure) and keep their
 * gap, to the nearest whole per cent.
 */
export const DIFFERENT_BASIS = Object.freeze({
  young_pip_recipients: "ours is England and Wales in 2025; the published figure is current, for November 2026",
});

/** How a pair's two figures differ, in a few words, or null for a like-for-like pair. */
export function differentBasis(id) {
  return Object.hasOwn(DIFFERENT_BASIS, id) ? DIFFERENT_BASIS[id] : null;
}

/** The icon of a figure with none of its own. */
export const BENCHMARK_ICON = "fileText";

/**
 * A figure's number and unit from its wording, where it is one plain number:
 * "260,000" is a count, "£5.1bn a year" is £ billion (`text` is the number
 * as worded, without "a year"). Null for anything
 * else ("About 1.0 million", "£3.6bn in 2036-37", a range), which is never drawn as a bar.
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

/** "£3.6bn in 2036-37" as its figure and the qualifier after it ("in 2036-37", "by 2036-37", "a year"); any other wording whole. */
export function valueParts(value) {
  const words = String(value || "").trim();
  const match = /^(.+?) ((?:in|by) \d{4}-\d{2}|a year)$/.exec(words);
  return match ? { main: match[1], qualifier: match[2] } : { main: words, qualifier: "" };
}

/** The rows by section, each in its section's own order; a row no section lists goes under the last; a section with no rows is left out. */
export function benchmarkGroups(rows) {
  const known = new Set(BENCHMARK_SECTIONS.flatMap((section) => section.ids));
  const last = BENCHMARK_SECTIONS.length - 1;
  return BENCHMARK_SECTIONS.map((section, index) => ({
    ...section,
    rows: [
      ...section.ids.map((id) => rows.find((row) => row.id === id)).filter(Boolean),
      ...(index === last ? rows.filter((row) => !known.has(row.id)) : []),
    ],
  })).filter((group) => group.rows.length > 0);
}

const text = (value) => (typeof value === "string" ? value : "");

/** A row's saving or net cost from a measure, shown apart from the pair: null without a value and a label. */
function separateFigure(value) {
  if (!value || typeof value.value !== "string" || !value.value.trim() || typeof value.label !== "string" || !value.label.trim()) return null;
  return { value: value.value.trim(), label: value.label.trim(), basis: text(value.basis) };
}

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
              note: text(row.policyengine_estimate.note),
            }
          : row.policyengine_estimate && (row.policyengine_estimate.run === "package" || typeof row.policyengine_estimate.reform_id === "string")
          ? {
              package: row.policyengine_estimate.run === "package",
              reformId: typeof row.policyengine_estimate.reform_id === "string" ? row.policyengine_estimate.reform_id : null,
              metric: text(row.policyengine_estimate.metric),
              label: text(row.policyengine_estimate.label),
            }
          : null,
      saving: separateFigure(row.policyengine_saving),
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
