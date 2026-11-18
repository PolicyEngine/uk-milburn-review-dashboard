/**
 * The Milburn runs' headline figures, read from
 * public/data/milburn_summary.json, which scripts/milburn_summary.py writes
 * from each run's flat results. Its shape:
 *
 *   { year, runs: [{ id, label, saving_bn: { "2027": … },
 *     young_people_in_losing_households,
 *     share_of_16_24_in_losing_households_pct,
 *     average_loss_young_person_in_losing_household, average_loss_basis,
 *     everyone_in_losing_households_pct,
 *     poverty_change_pp: { rel_bhc, rel_ahc, abs_bhc, abs_ahc },
 *     people_into_poverty_abs_bhc, people_into_poverty_rel_bhc,
 *     child_poverty_change_pp_rel_bhc,
 *     break_even_share_in_work_pct: { h16, h25 },
 *     entrants_to_match_income_loss: { h16, h25 },
 *     exchequer_gain_per_entrant: { h16, h25 }, people_directly_affected,
 *     direction: "gain"|"loss" }] }
 *
 * The break-even figures share one definition: entrants_to_match_income_loss
 * is the run's Exchequer saving divided by one entrant's gain from work
 * (the household case), and break_even_share_in_work_pct is those entrants
 * as a share of the young people in losing households. Above 100% there
 * are more entrants than young people in those households.
 * people_directly_affected is the people whose own earnings or taxes
 * change: the movers in the run with a move into work.
 *
 * A "gain" run (the comparators) raises incomes: its *losing* and *loss*
 * fields hold the young people in gaining households and a negative loss
 * (an average gain), its saving is negative (a cost), and it has no
 * break-even arithmetic. Without a direction, a negative average loss marks
 * a gain run.
 *
 * The average loss is the mean change among the 16-24s in losing (gaining)
 * households only, from age_impact.csv's conditional columns; null when it
 * cannot be found without netting gains against losses, with
 * average_loss_basis saying why (scripts/milburn_summary.py).
 *
 * `by_year` repeats the runs for every year they cover (2027-28 to
 * 2031-32), under the same disclosure floor, so the boxes follow the year
 * selector (useMilburnSummary's `year`); the break-even figures are for the
 * default year only.
 *
 * The file is rewritten as national runs finish, so it is fetched afresh
 * (no cache). A run it does not list is "not yet run"; a figure it does not
 * carry is null, never zero.
 */
import { useEffect, useState } from "react";

export const SUMMARY_FILE = "milburn_summary.json";

/**
 * The pre-report full abolition package (from April 2027): the base the
 * 25% entry run and the pre-report phased run are set beside, which share
 * its years. Not the headline cards' fallback (HEADLINE_RUN).
 */
export const DEFAULT_SUMMARY_RUN = "milburn_package";

/** The run the headline cards show when no single policy is chosen: the report's package. */
export const HEADLINE_RUN = "milburn_report_package";

/** The run with an illustrative move into work, microsimulated. */
export const ENTRY_RUN = "milburn_package_entry_25pct";

/** The hours cases of the break-even arithmetic. */
export const BREAK_EVEN_HOURS = Object.freeze([
  { id: "h16", hours: 16 },
  { id: "h25", hours: 25 },
]);

/** What the entry run assumes, in words: who moves, and into what work (milburn_variants.py). */
export const ENTRY_ASSUMPTION = Object.freeze({
  share: "25%",
  group: "non-working 18 to 24-year-olds with PIP or the health element",
  work: "16 hours' work a week at the minimum wage for their age",
});

/** The entry run's assumption as one phrase. */
export const ENTRY_ASSUMPTION_TEXT = `${ENTRY_ASSUMPTION.share} of ${ENTRY_ASSUMPTION.group} move into ${ENTRY_ASSUMPTION.work}`;

/** What the break-even share is. */
export const BREAK_EVEN_SHARE_DEFINITION =
  "Entrants needed, as a share of the 16 to 24-year-olds in losing households.";

/** What the entrants needed are. */
export const BREAK_EVEN_ENTRANTS_DEFINITION =
  "Entrants needed: the Exchequer saving (standing for the total income loss) divided by one entrant's gain from work.";

/** Said of a share above 100%. */
export const MORE_ENTRANTS_THAN_GROUP = "More entrants than there are 16 to 24-year-olds in losing households";

const finite = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);

const pick = (object, keys) => {
  const source = object && typeof object === "object" && !Array.isArray(object) ? object : {};
  return Object.fromEntries(keys.map((key) => [key, finite(source[key])]));
};

const HOURS_KEYS = BREAK_EVEN_HOURS.map((entry) => entry.id);

/** One run, checked: every figure a finite number or null. Null without an id. */
export function parseSummaryRun(run) {
  if (!run || typeof run !== "object" || typeof run.id !== "string" || !run.id.trim()) return null;
  const saving = {};
  if (run.saving_bn && typeof run.saving_bn === "object") {
    for (const [year, value] of Object.entries(run.saving_bn)) {
      if (/^\d{4}$/.test(year) && finite(value) !== null) saving[year] = value;
    }
  }
  const averageLoss = finite(run.average_loss_young_person_in_losing_household);
  const direction = run.direction === "gain" || run.direction === "loss" ? run.direction : averageLoss !== null && averageLoss < 0 ? "gain" : "loss";
  return {
    id: run.id.trim(),
    direction,
    label: typeof run.label === "string" ? run.label : "",
    savingBn: saving,
    youngPeopleLosing: finite(run.young_people_in_losing_households),
    youngShareLosingPct: finite(run.share_of_16_24_in_losing_households_pct),
    averageLossYoung: averageLoss,
    everyoneLosingPct: finite(run.everyone_in_losing_households_pct),
    povertyPp: pick(run.poverty_change_pp, ["rel_bhc", "rel_ahc", "abs_bhc", "abs_ahc"]),
    // Before housing costs: the page's default poverty measure
    peopleIntoPovertyAbs: finite(run.people_into_poverty_abs_bhc),
    peopleIntoPovertyRel: finite(run.people_into_poverty_rel_bhc),
    childPovertyPpRel: finite(run.child_poverty_change_pp_rel_bhc),
    breakEvenSharePct: pick(run.break_even_share_in_work_pct, HOURS_KEYS),
    entrantsToMatch: pick(run.entrants_to_match_income_loss, HOURS_KEYS),
    exchequerGainPerEntrant: pick(run.exchequer_gain_per_entrant, HOURS_KEYS),
    peopleDirectlyAffected: finite(run.people_directly_affected),
  };
}

function parseRuns(list) {
  const runs = new Map();
  for (const raw of list) {
    const run = parseSummaryRun(raw);
    if (run && !runs.has(run.id)) runs.set(run.id, run);
  }
  return runs;
}

/**
 * The file, checked: null unless it has a year and a list of runs. Its
 * `by_year` (every year the runs cover, under the same disclosure floor)
 * is kept as `byYear`, a Map from year to runs; the default year's runs
 * are `runs`.
 */
export function parseSummary(json) {
  if (!json || typeof json !== "object" || !Number.isInteger(json.year) || !Array.isArray(json.runs)) return null;
  const runs = parseRuns(json.runs);
  const byYear = new Map([[json.year, runs]]);
  if (json.by_year && typeof json.by_year === "object" && !Array.isArray(json.by_year)) {
    for (const [key, list] of Object.entries(json.by_year)) {
      const year = Number(key);
      if (/^\d{4}$/.test(key) && Array.isArray(list) && year !== json.year) byYear.set(year, parseRuns(list));
    }
  }
  return { year: json.year, runs, byYear };
}

/**
 * The summary for one year: the same shape, with that year's runs, or
 * null when the file has no figures for it. Without a year, the file's
 * default year.
 */
export function summaryForYear(summary, year) {
  if (!summary) return null;
  if (year === undefined || year === null || Number(year) === summary.year) return summary;
  const runs = summary.byYear?.get(Number(year));
  return runs ? { ...summary, year: Number(year), runs } : null;
}

/** One run's figures, or null when the file does not list it (not yet run). */
export function summaryRun(summary, id) {
  return summary?.runs?.get(id) ?? null;
}

/** The run's static saving (£bn) in the summary's year, or null. */
export function savingInYear(run, year) {
  return finite(run?.savingBn?.[String(year)]);
}

const people = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

/** A count of people, rounded to the nearest thousand ("578,000"); "under 1,000" below that; "0" for none at all (a run that changes no income). */
export function formatPeople(value) {
  if (finite(value) === null) return "";
  const n = Math.abs(value);
  if (n === 0) return "0";
  if (n < 1000) return "under 1,000";
  return people.format(Math.round(n / 1000) * 1000);
}

/** £ a year, whole pounds ("£12,622"). */
export function formatPounds(value) {
  return finite(value) === null ? "" : `£${people.format(Math.round(value))}`;
}

/** £bn with two decimal places ("£4.49bn"). */
export function formatBn(value) {
  if (finite(value) === null) return "";
  const sign = value < 0 ? "−" : "";
  return `${sign}£${Math.abs(value).toFixed(2)}bn`;
}

/** Percentage points with two decimal places and their sign ("+0.23pp"). */
export function formatSignedPp(value) {
  if (finite(value) === null) return "";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(2)}pp`;
}

/** A percentage with two decimal places ("7.75%"). */
export function formatPct(value) {
  return finite(value) === null ? "" : `${value.toFixed(2)}%`;
}

/**
 * The break-even share in words: the percentage, and, above 100%, that the
 * entrants needed outnumber the young people in losing households. Empty
 * when missing.
 */
export function breakEvenText(sharePct) {
  if (finite(sharePct) === null) return "";
  if (sharePct > 100) return `${sharePct.toFixed(1)}% (${MORE_ENTRANTS_THAN_GROUP.toLowerCase()})`;
  return `${sharePct.toFixed(1)}%`;
}

/**
 * The people the run with a move into work moves, from its own results
 * (people_directly_affected), or null when the file carries none: a static
 * run's zero is not a count of movers.
 */
export function entryMovers(run) {
  const count = finite(run?.peopleDirectlyAffected);
  return count !== null && count > 0 ? count : null;
}

/** A run's saving in a year as a share of another's (0.448), or null when either is missing or the other is not positive. */
export function savingShare(run, ofRun, year) {
  const part = savingInYear(run, year);
  const whole = savingInYear(ofRun, year);
  return part !== null && whole !== null && whole > 0 ? part / whole : null;
}

/**
 * The summary file: { status: "loading"|"ready"|"unavailable", summary }.
 * Fetched afresh whenever `refresh` changes (the catalogue's fingerprint,
 * which changes as runs are added), so a run that finishes appears.
 */
export function useMilburnSummary(refresh, { basePath = process.env.NEXT_PUBLIC_BASE_PATH || "", enabled = true, year } = {}) {
  const [state, setState] = useState({ status: "loading", summary: null });
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    // Inside a promise, so a fetch that throws or returns nothing reads as unavailable
    Promise.resolve()
      .then(() => fetch(`${basePath}/data/${SUMMARY_FILE}`, { cache: "no-cache" }))
      .then((response) => (response?.ok ? response.json() : null))
      .then((json) => {
        const summary = parseSummary(json);
        if (!cancelled) setState({ status: summary ? "ready" : "unavailable", summary });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "unavailable", summary: null });
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, basePath, enabled]);
  if (!enabled) return { status: "unavailable", summary: null };
  // A year asked for: that year's figures, or unavailable when the file has none
  if (year !== undefined && state.status === "ready") {
    const chosen = summaryForYear(state.summary, year);
    return chosen ? { status: "ready", summary: chosen } : { status: "unavailable", summary: null };
  }
  return state;
}

/** The poverty measure the summary counts directly: absolute, before housing costs, all people. */
export const DIRECT_COUNT_METRIC = "poverty_change_pp";
// The same measure under its own name: the default choice reads the headline column
const DIRECT_COUNT_KEYS = new Set([DIRECT_COUNT_METRIC, "poverty_abs_bhc_change_pp"]);

/**
 * The summary's direct count of people moved into poverty, as
 * count(runId, year, metricKey): the run's people_into_poverty_abs_bhc
 * (negative: out of poverty) for absolute poverty before housing costs in
 * that year (by_year), else null. So a poverty card that would otherwise
 * multiply the rate's change by the population reads the same count as
 * Key figures. Null without a summary.
 */
export function summaryPovertyCount(summary) {
  if (!summary?.runs) return null;
  return (runId, year, metricKey) => {
    if (!DIRECT_COUNT_KEYS.has(metricKey)) return null;
    return finite(summaryForYear(summary, year)?.runs.get(runId)?.peopleIntoPovertyAbs);
  };
}

/** Said beside the two poverty measures: why they can point different ways. */
export const RELATIVE_LINE_NOTE =
  "The relative line moves with the median; the absolute line is fixed in real terms.";

/**
 * The review's own modelled figures, as published, read from
 * public/data/milburn_review_figures.json: each with the section of the
 * report, annex or data tables it comes from. Typed into that file by hand
 * from the publication, never into a component. Its shape (the fields read
 * here):
 *
 *   { report: { title, short_title, published, url, report_url, annex_url },
 *     employment: { people, by_year, who, measures, method, hours,
 *       source: { label, url },
 *       annex: { more_16_to_24_in_work, more_16_to_24_in_employment_and_education,
 *         rounded_to, source: { label, url } } },
 *     neet_rate: { years: [], baseline_pct: [], with_recommendations_pct: [],
 *       ambition_pct, source: { label, url } } }
 */
export const REVIEW_FIGURES_FILE = "milburn_review_figures.json";

const text = (value) => (typeof value === "string" ? value.trim() : "");

/** An https address, or "": a link is never built from anything else. */
const httpsUrl = (value) => (/^https:\/\/\S+$/.test(text(value)) ? text(value) : "");

/** { label, url }, or null without both. */
const sourceOf = (value) => {
  const label = text(value?.label);
  const url = httpsUrl(value?.url);
  return label && url ? { label, url } : null;
};

/**
 * The review's figures, checked: null unless the file names the report with
 * a link and gives the people into work and their year. A figure it does
 * not carry is null, never zero.
 */
export function parseReviewFigures(json) {
  if (!json || typeof json !== "object") return null;
  const url = httpsUrl(json.report?.url);
  const title = text(json.report?.title);
  const employment = json.employment;
  const people = finite(employment?.people);
  if (!url || !title || people === null || people <= 0 || !Number.isInteger(employment?.by_year)) return null;
  const rate = json.neet_rate;
  const series = (values) => (Array.isArray(values) && values.length > 0 && values.every((value) => finite(value) !== null) ? values : null);
  const baseline = series(rate?.baseline_pct);
  const withReforms = series(rate?.with_recommendations_pct);
  const years = Array.isArray(rate?.years) && rate.years.every((year) => typeof year === "string") ? rate.years : null;
  const sameLength = years && baseline && withReforms && years.length === baseline.length && years.length === withReforms.length;
  return {
    report: {
      title,
      shortTitle: text(json.report.short_title) || title,
      published: text(json.report.published),
      url,
      reportUrl: httpsUrl(json.report.report_url),
      annexUrl: httpsUrl(json.report.annex_url),
    },
    employment: {
      people,
      byYear: employment.by_year,
      who: text(employment.who),
      measures: text(employment.measures),
      method: text(employment.method),
      hours: text(employment.hours),
      source: sourceOf(employment.source),
      annex: employment.annex
        ? {
            moreInWork: finite(employment.annex.more_16_to_24_in_work),
            moreInWorkOrEducation: finite(employment.annex.more_16_to_24_in_employment_and_education),
            roundedTo: finite(employment.annex.rounded_to),
            source: sourceOf(employment.annex.source),
          }
        : null,
    },
    neetRate: sameLength
      ? { years, baselinePct: baseline, withReformsPct: withReforms, ambitionPct: finite(rate.ambition_pct), source: sourceOf(rate.source) }
      : null,
  };
}

/** The review's figures file: { status: "loading"|"ready"|"unavailable", review }. */
export function useReviewFigures({ basePath = process.env.NEXT_PUBLIC_BASE_PATH || "" } = {}) {
  const [state, setState] = useState({ status: "loading", review: null });
  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => fetch(`${basePath}/data/${REVIEW_FIGURES_FILE}`, { cache: "no-cache" }))
      .then((response) => (response?.ok ? response.json() : null))
      .then((json) => {
        const review = parseReviewFigures(json);
        if (!cancelled) setState({ status: review ? "ready" : "unavailable", review });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "unavailable", review: null });
      });
    return () => {
      cancelled = true;
    };
  }, [basePath]);
  return state;
}
