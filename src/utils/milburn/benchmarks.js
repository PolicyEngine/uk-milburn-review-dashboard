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
    chip: "Caseloads",
    title: "How do our caseloads compare?",
    intro: "Published counts of 16–24s on the UC health element or PIP, beside ours.",
    icon: "usersRound",
    ids: ["uc_health_no_work_requirements", "uc_health_element_16_24", "uc_health_pip_overlap", "young_pip_recipients", "package_young_people_affected"],
  },
  {
    key: "spending",
    chip: "Spending",
    title: "How does our spending compare?",
    intro: "Published spending and costs for 2025-26, beside ours in cash terms.",
    icon: "landmark",
    ids: ["pip_spend_16_24", "uc_health_spend_16_24", "young_benefits_spend", "employer_nics_under_25"],
  },
  {
    key: "jobs",
    chip: "Work",
    title: "Where do young people work?",
    intro: "The review's share of young people's jobs in retail and hospitality.",
    icon: "briefcase",
    ids: ["retail_hospitality_jobs_16_24"],
  },
  {
    key: "review",
    chip: "The review's estimates",
    title: "The review's own estimates",
    intro: "The review's own projections, which our static runs cannot reproduce.",
    icon: "scale",
    ids: ["review_welfare_saving_2036", "milburn_welfare_saving_10y", "relative_poverty_review", "young_net_incomes_review"],
  },
  {
    key: "poverty",
    chip: "Poverty",
    title: "Poverty",
    intro: "What the benefits do for young people today.",
    icon: "percent",
    ids: ["kept_out_of_poverty", "pip_no_extra_costs"],
  },
  {
    key: "context",
    chip: "Context",
    title: "Context from the review",
    intro: "Published figures on young people, work and costs, not set beside a PolicyEngine figure.",
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
    label: "NEETs, 16–24s",
    icon: "cap",
    basis: "Labour Force Survey, April to June 2026, UK: 13.0% of 16–24s",
  },
  neet_rate_projection_2036: {
    label: "Projected NEET rate, 2036-37",
    icon: "arrowDown",
    basis: "16–24s, UK, from 13.1% in 2026-27; the ambition is around 5%",
  },
  into_sustained_work_2036: {
    label: "Into sustained work by 2036",
    icon: "briefcase",
    basis: "All its recommendations, not the benefit changes alone",
  },
  uc_health_no_work_requirements: {
    label: "UC health, no work requirements",
    icon: "heartPulse",
    basis: "Basis not published: no age range, date or source given",
  },
  uc_health_element_16_24: {
    label: "UC health element, 16–24s",
    icon: "activity",
    estimateBasis: "Ages 16 to 24, Great Britain, 2025",
  },
  uc_health_pip_overlap: {
    label: "UC health element and PIP, 16–24s",
    icon: "hbars",
    basis: "Share also receiving PIP; no source, date or area given",
    estimateBasis: "Ages 16 to 24, Great Britain, 2025",
  },
  incapacity_benefits_young: {
    label: "Young people on incapacity benefits",
    icon: "lifebuoy",
    basis: "More than double the number in 2012",
  },
  young_pip_recipients: {
    label: "PIP recipients, 16–24s",
    icon: "clipboard",
    estimateBasis: "Ages 16 to 24, England and Wales, 2025",
  },
  dla_pip_16_24: {
    label: "DLA or PIP, 16–24s",
    icon: "layers",
    basis: "From DWP Stat-Xplore; double the number in 2012",
  },
  package_young_people_affected: {
    label: "16–24s affected by the package",
    icon: "usersRound",
    basis: "No published figure",
    estimateBasis: "16–24s in households the package makes worse off",
  },
  young_benefits_spend: {
    label: "PIP and UC LCWRA spending",
    icon: "banknote",
    basis: "2025-26, ages 16 to 24: PIP £3.8bn, UC LCWRA £0.92bn",
    estimateBasis: "Spending in 2025, cash terms: PIP in England and Wales, the health element in Great Britain",
  },
  pip_spend_16_24: {
    label: "PIP spending, 16–24s",
    icon: "wallet",
    basis: "Spending in 2025-26",
    estimateBasis: "Spending in 2025, England and Wales, cash terms",
  },
  uc_health_spend_16_24: {
    label: "UC LCWRA spending, 16–24s",
    icon: "piggy",
    basis: "Spending in 2025-26",
    estimateBasis: "Spending in 2025, Great Britain, cash terms",
  },
  incapacity_spending_18_24: { label: "Incapacity spending, 18–24s", icon: "trend" },
  review_welfare_saving_2036: {
    label: "Annual welfare saving",
    icon: "scale",
    basis: "2026-27 prices, UK; replacement awards, a Youth Allowance and a work allowance included",
  },
  milburn_welfare_saving_10y: {
    label: "Welfare savings to 2036-37",
    icon: "coins",
    basis: "Eight years, 2029-30 to 2036-37, 2026-27 prices",
  },
  review_investment_2036: {
    label: "Annual cost of the recommendations",
    icon: "calculator",
    basis: "Gross, 2026-27 prices; offset by £3.6bn welfare savings and £2.4bn fiscal offsets",
  },
  youth_hiring_incentives_cost: {
    label: "Youth hiring incentives",
    icon: "userPlus",
    basis: "Youth Jobs Grant and apprenticeships; no separate employer NI cost",
  },
  employer_nics_under_25: {
    label: "Zero employer NI, under-25s",
    icon: "building",
    basis: "Gross cost in 2025-26; not a recommendation of the review",
    estimateBasis: "Gross static cost, 2025-26, UK, cash terms",
  },
  relative_poverty_review: {
    label: "Relative poverty, after housing costs",
    icon: "house",
    basis: "Once fully rolled out, with 440,000 more young people in work",
  },
  kept_out_of_poverty: { label: "Kept out of poverty by PIP or UC health", icon: "shield" },
  young_net_incomes_review: {
    label: "Rise in young people's net incomes",
    icon: "bars",
    basis: "All its reforms, with 440,000 more young people in work (paragraphs 111 and 739)",
  },
  retail_hospitality_jobs_16_24: {
    label: "Retail and hospitality jobs",
    icon: "cart",
    basis: "ONS, by industry section, to 2025 (paragraph 50)",
  },
  pip_spend_trend_16_24: {
    label: "PIP spending over time",
    icon: "calendar",
    basis: "Around £1.3bn in 2019-20; around £6.5bn within five years (paragraph 653)",
  },
  uc_health_spend_young_2024: {
    label: "UC health spending, young people",
    icon: "tag",
    basis: "Overall UC spend, almost doubled since 2019-20 (paragraph 653)",
  },
  hidden_neets_england: {
    label: "Hidden NEETs, England",
    icon: "user",
    basis: "18–24s out of work and education, not receiving benefits, 2023-24 (paragraph 275)",
  },
  disabled_neet_16_24: {
    label: "Disabled NEET rate, 16–24s",
    icon: "users",
    basis: "2025-26: around 3.5 times the non-disabled rate (paragraph 692)",
  },
  child_dla_recipients: {
    label: "Children receiving DLA",
    icon: "clock",
    basis: "About 77% move to PIP by 17, implying about 23% do not (paragraph 759)",
  },
  pip_no_extra_costs: { label: "PIP claimants with no extra costs", icon: "receipt" },
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

/**
 * The 15% tolerance: a pair is tested against it only where the published
 * figure is an official count (a department's or the ONS's, not another
 * model's estimate or a think tank's count) with the same ages, area and
 * period as ours (TOLERANCE_RULE). Each like-for-like row says which:
 * `against` (the matched official figure, its wording, and ours) for a
 * tested row, or `untested` (which part of the rule fails, in a few
 * words). The gap is tested unrounded, so 14.7% is within.
 */
export const TOLERANCE_PCT = 15;
export const TOLERANCE_RULE = `We test a gap against the ${TOLERANCE_PCT}% tolerance only where the published figure is an official count with the same ages, area and period as ours.`;
/** Said beside the gaps: where the published figure does not state its basis, its gap is indicative. */
export const INDICATIVE_GAP_NOTE = "Where the published figure does not state its ages, area or period, the gap is indicative only.";
export const TOLERANCE = Object.freeze({
  uc_health_element_16_24: { untested: "not an official count, and it gives no source, date or area" },
  uc_health_pip_overlap: { untested: "not official counts, and they give no source, date or area" },
  young_pip_recipients: {
    against: { label: "DWP's 2025 count", published: 407505, estimate: 406919 },
  },
  young_benefits_spend: { untested: "the review's figures give no area" },
  pip_spend_16_24: { untested: "the review's figure gives no area" },
  uc_health_spend_16_24: { untested: "the review's figure gives no area" },
  employer_nics_under_25: { untested: "another model's estimate, not an official count" },
  // neet_16_24 has no pair, so no entry: ONS publishes the NEET counts by
  // quarter only (the LFS NEET dataset), with no 2025 average to link. A
  // mean of its four 2025 quarters (943,416, not seasonally adjusted) is our
  // arithmetic, not an ONS figure (issue #5). Our NEET count is also
  // income-based (no earnings, not in full-time education), not the LFS
  // measure, so the two would differ in definition even for one period.
});

/**
 * A row's 15% verdict: { tested: true, within, gapPct, against } where a
 * matched figure exists, { tested: false, reason } where none does, or null
 * for a row with no PolicyEngine pair.
 */
export function toleranceFor(row) {
  const rule = TOLERANCE[row?.id];
  if (!rule) return null;
  if (rule.untested) return { tested: false, reason: rule.untested };
  const { published, estimate, label } = rule.against;
  const gapPct = ((estimate - published) / published) * 100;
  return { tested: true, within: Math.abs(gapPct) <= TOLERANCE_PCT, gapPct, against: label };
}

/** A verdict in a few words, for a badge: "Within 15% of DWP's 2025 count…", "No 15% test". */
export function toleranceWords(verdict) {
  if (!verdict) return "";
  if (!verdict.tested) return `No ${TOLERANCE_PCT}% test`;
  return `${verdict.within ? "Within" : "Outside"} ${TOLERANCE_PCT}% of ${verdict.against}`;
}

/**
 * Why a published figure has no PolicyEngine figure beside it, by row id,
 * where we do estimate something like it elsewhere: said in its card's
 * More info.
 */
export const UNPAIRED_REASONS = Object.freeze({
  neet_16_24:
    "Our NEET count on the Young people tab is income-based (no earnings, not in full-time education), not the Labour Force Survey measure, and ONS publishes NEET estimates by quarter only, so there is no figure on the same basis to set beside this one.",
});

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
  const share = /^((\d{1,3}(?:\.\d+)?)%)$/.exec(words);
  if (share) return { number: Number(share[2]), unit: "pct", text: share[1] };
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
    // Shares differ in percentage points, never as a % of a %
    gapPp: published.unit === "pct" ? estimate.number - published.number : null,
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
              note: text(row.policyengine_estimate.note),
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

/** The gap in words, to the nearest whole per cent: "14% lower", "33% higher", "within 1%". */
export const gapWords = (gapPct) =>
  Math.round(Math.abs(gapPct)) === 0 ? "within 1%" : `${Math.round(Math.abs(gapPct))}% ${gapPct < 0 ? "lower" : "higher"}`;

/** A pair's gap in words: percentage points for shares ("28.1pp higher"), else gapWords. */
export const comparisonGapWords = (comparison) =>
  comparison.gapPp != null
    ? `${Math.abs(comparison.gapPp).toFixed(1)}pp ${comparison.gapPp < 0 ? "lower" : "higher"}`
    : gapWords(comparison.gapPct);

/**
 * Small graphics for figures whose wording holds a series or a split, by
 * row id: each point's `text` is worded exactly as in the row's value or
 * basis (a test holds it so), its `number` the same figure to draw.
 * `kind` "bars" draws one bar a point, from zero; "stack" one bar split
 * into its parts; "meter" one share of a whole. `tone` "latest" marks the
 * figure the tile leads with, "projected" a projection.
 */
export const BENCHMARK_GRAPHICS = Object.freeze({
  neet_rate_projection_2036: {
    kind: "bars",
    points: [
      { label: "2026-27", text: "13.1%", number: 13.1 },
      { label: "2036-37, without", text: "13.4%", number: 13.4, tone: "projected" },
      { label: "2036-37, with", text: "6.8%", number: 6.8, tone: "latest" },
    ],
  },
  pip_spend_trend_16_24: {
    kind: "bars",
    points: [
      { label: "2019-20", text: "£1.3bn", number: 1.3 },
      { label: "2024-25", text: "£3.2bn", number: 3.2, tone: "latest" },
      { label: "In five years", text: "£6.5bn", number: 6.5, tone: "projected" },
    ],
  },
  disabled_neet_16_24: {
    kind: "bars",
    points: [
      { label: "Disabled", text: "30.2%", number: 30.2, tone: "latest" },
      { label: "Not disabled", text: "8.6%", number: 8.6 },
    ],
  },
  review_investment_2036: {
    kind: "stack",
    points: [
      { label: "Education", text: "£2.1bn", number: 2.1 },
      { label: "Opportunity and Support Guarantees", text: "£1.9bn", number: 1.9 },
      { label: "Youth hiring incentives", text: "£1.1bn", number: 1.1 },
      { label: "Health", text: "£0.7bn", number: 0.7 },
    ],
  },
  child_dla_recipients: {
    kind: "meter",
    points: [{ label: "Move to PIP by 17", text: "77%", number: 77 }],
  },
});

/** A row's graphic: its own (BENCHMARK_GRAPHICS), else bars for a dated range, a share as people, or null. */
export function graphicFor(row) {
  if (BENCHMARK_GRAPHICS[row.id]) return BENCHMARK_GRAPHICS[row.id];
  const { value } = splitValue(row.value);
  const range = figureRange(value);
  if (range) return { kind: "bars", points: range.map((point, index) => ({ ...point, tone: index === range.length - 1 ? "latest" : undefined })) };
  const share = figureShare(value);
  if (share) return { kind: "share", share };
  return null;
}

/** The topics of the filter: every section, after "All". */
/** "ours": only the figures with a PolicyEngine figure beside them, across sections (issue #6, item 9). */
export const OURS_TOPIC = "ours";
export const BENCHMARK_TOPICS = [
  { key: "all", chip: "All" },
  { key: OURS_TOPIC, chip: "With a PolicyEngine figure" },
  ...BENCHMARK_SECTIONS.map(({ key, chip }) => ({ key, chip })),
];

/** The groups a topic shows: one section, every section, or every section's rows with a PolicyEngine figure. */
export function groupsForTopic(groups, topic) {
  if (topic === OURS_TOPIC) {
    return groups.map((group) => ({ ...group, rows: group.rows.filter((row) => row.estimate) })).filter((group) => group.rows.length > 0);
  }
  return groups.filter((group) => topic === "all" || group.key === topic);
}

/** The address's topic (?bm=), or "all" for none or one we do not know. */
export function topicFromSearch(search) {
  const asked = new URLSearchParams(search).get("bm");
  return BENCHMARK_TOPICS.some((topic) => topic.key === asked) ? asked : "all";
}

const sentence = (text) => {
  const words = String(text || "").trim();
  return !words ? "" : /[.!?]$/.test(words) ? words : `${words}.`;
};

/**
 * What a card's "More info" holds, as InfoSections parts: why the two
 * differ (a pair's own note, after its different basis), the published
 * figure as worded with its basis, ours with its build, year, area and
 * price basis (and our saving, apart); the source is the foot's chip, not repeated.
 * `estimate` is a worked-out estimate's text, where the row has no fixed one.
 */
export function moreInfo(row, { estimate = null, runLabel = "" } = {}) {
  const basis = differentBasis(row.id);
  const verdict = toleranceFor(row);
  const test = !verdict
    ? ""
    : verdict.tested
      ? `${toleranceWords(verdict)}: ours ${Math.round(Math.abs(verdict.gapPct) * 10) / 10}% ${verdict.gapPct < 0 ? "lower" : "higher"}.`
      : `Not tested against the ${TOLERANCE_PCT}% tolerance: ${verdict.reason}.`;
  const why = [basis && `Not like for like: ${basis}.`, sentence(row.estimate?.note), test].filter(Boolean).join(" ");
  const unpaired = !row.estimate && Object.hasOwn(UNPAIRED_REASONS, row.id) ? UNPAIRED_REASONS[row.id] : "";
  const how = [];
  if (row.estimate?.fixed) how.push(`${row.estimate.label || "PolicyEngine"}: ${row.estimate.fixed}. ${sentence(row.estimate.basis)}`.trim());
  else if (row.estimate && estimate) how.push(`${row.estimate.label || "PolicyEngine"}: ${estimate}${runLabel ? ` (${runLabel})` : ""}.`);
  if (row.saving) how.push(`${row.saving.label}: ${row.saving.value}. ${sentence(row.saving.basis)}`.trim());
  return {
    lead: why ? { title: "Why they differ", body: why } : unpaired ? { title: "Why no PolicyEngine figure", body: unpaired } : undefined,
    shows: row.value ? `Published: ${row.value}. ${sentence(row.basis)}`.trim() : sentence(row.basis) || null,
    how,
    // The card's foot carries the source chip; More info does not repeat it
    sources: [],
  };
}
