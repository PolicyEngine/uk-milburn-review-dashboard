/**
 * The Milburn runs' headline figures, read from
 * public/data/milburn_summary.json, which scripts/milburn_summary.py writes
 * from each run's flat results. Its shape:
 *
 *   { year, runs: [{ id, label, saving_bn: { "2027": … },
 *     young_people_in_losing_households,
 *     share_of_16_24_in_losing_households_pct,
 *     average_loss_young_person_in_losing_household,
 *     everyone_in_losing_households_pct,
 *     poverty_change_pp: { rel_bhc, rel_ahc, abs_bhc, abs_ahc },
 *     people_into_poverty_abs_ahc, people_into_poverty_rel_ahc,
 *     child_poverty_change_pp_rel_ahc,
 *     break_even_share_in_work_pct: { h16, h25 },
 *     entrants_to_match_income_loss: { h16, h25 },
 *     exchequer_gain_per_entrant: { h16, h25 }, direction: "gain"|"loss" }] }
 *
 * A "gain" run (the comparators) raises incomes: its *losing* and *loss*
 * fields hold the young people in gaining households and a negative loss
 * (an average gain), its saving is negative (a cost), and it has no
 * break-even arithmetic. Without a direction, a negative average loss marks
 * a gain run.
 *
 * The file is rewritten as national runs finish, so it is fetched afresh
 * (no cache). A run it does not list is "not yet run"; a figure it does not
 * carry is null, never zero.
 */
import { useEffect, useState } from "react";

export const SUMMARY_FILE = "milburn_summary.json";

/** The run shown when none is chosen. */
export const DEFAULT_SUMMARY_RUN = "milburn_package";

/** The run with an illustrative move into work, microsimulated. */
export const ENTRY_RUN = "milburn_package_entry_25pct";

/** The hours cases of the break-even arithmetic. */
export const BREAK_EVEN_HOURS = Object.freeze([
  { id: "h16", hours: 16 },
  { id: "h25", hours: 25 },
]);

/** Shown in place of a share above 100%. */
export const NO_ENTRY_RATE_RESTORES = "No entry rate at these hours restores the average";

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
    peopleIntoPovertyAbsAhc: finite(run.people_into_poverty_abs_ahc),
    peopleIntoPovertyRelAhc: finite(run.people_into_poverty_rel_ahc),
    childPovertyPpRelAhc: finite(run.child_poverty_change_pp_rel_ahc),
    breakEvenSharePct: pick(run.break_even_share_in_work_pct, HOURS_KEYS),
    entrantsToMatch: pick(run.entrants_to_match_income_loss, HOURS_KEYS),
    exchequerGainPerEntrant: pick(run.exchequer_gain_per_entrant, HOURS_KEYS),
  };
}

/** The file, checked: null unless it has a year and a list of runs. */
export function parseSummary(json) {
  if (!json || typeof json !== "object" || !Number.isInteger(json.year) || !Array.isArray(json.runs)) return null;
  const runs = new Map();
  for (const raw of json.runs) {
    const run = parseSummaryRun(raw);
    if (run && !runs.has(run.id)) runs.set(run.id, run);
  }
  return { year: json.year, runs };
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

/** A count of people, rounded to the nearest thousand ("578,000"); "under 1,000" below that. */
export function formatPeople(value) {
  if (finite(value) === null) return "";
  const n = Math.abs(value);
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
 * The break-even share in words: the percentage, or, above 100%, that no
 * entry rate at these hours restores the average. Empty when missing.
 */
export function breakEvenText(sharePct) {
  if (finite(sharePct) === null) return "";
  if (sharePct > 100) return `${NO_ENTRY_RATE_RESTORES} (${sharePct.toFixed(1)}% would be needed)`;
  return `${sharePct.toFixed(1)}%`;
}

/**
 * The summary file: { status: "loading"|"ready"|"unavailable", summary }.
 * Fetched afresh whenever `refresh` changes (the catalogue's fingerprint,
 * which changes as runs are added), so a run that finishes appears.
 */
export function useMilburnSummary(refresh, { basePath = process.env.NEXT_PUBLIC_BASE_PATH || "", enabled = true } = {}) {
  const [state, setState] = useState({ status: "loading", summary: null });
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    fetch(`${basePath}/data/${SUMMARY_FILE}`, { cache: "no-cache" })
      .then((response) => (response.ok ? response.json() : null))
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
  return enabled ? state : { status: "unavailable", summary: null };
}

/** The poverty measure the summary counts directly: absolute, after housing costs, all people. */
export const DIRECT_COUNT_METRIC = "poverty_abs_ahc_change_pp";

/**
 * The summary's direct count of people moved into poverty, as
 * count(runId, year, metricKey): the run's people_into_poverty_abs_ahc
 * (negative: out of poverty) for absolute poverty after housing costs in
 * the summary's year, else null. So a poverty card that would otherwise
 * multiply the rate's change by the population reads the same count as
 * Key figures. Null without a summary.
 */
export function summaryPovertyCount(summary) {
  if (!summary?.runs) return null;
  return (runId, year, metricKey) => {
    if (metricKey !== DIRECT_COUNT_METRIC || Number(year) !== summary.year) return null;
    return finite(summary.runs.get(runId)?.peopleIntoPovertyAbsAhc);
  };
}

/** Said beside the two poverty measures: why they can point different ways. */
export const RELATIVE_LINE_NOTE =
  "The relative line is 60% of the median, which itself moves with these measures; the absolute line is fixed in real terms.";
