/**
 * The report package's effect on 16 to 24-year-olds who are approximately
 * NEET (not in education, employment or training), read from
 * public/data/milburn_neet.json, which scripts/milburn_neet_breakdown.py
 * writes from one pair of national runs. Its shape:
 *
 *   { reform_id, year, build, definition, definition_notes: [...],
 *     min_records, neet_approx_total, neet_approx_share_of_16_24_pct,
 *     ons_benchmark_id,
 *     groups: { neet_approx, other_16_24, all_16_24 }, each
 *       { records, population, share_in_losing_households_pct,
 *         average_change_in_household_net_income,
 *         people_losing_uc_health_or_pip,
 *         share_losing_uc_health_or_pip_pct } }
 *
 * A figure resting on too few survey records is null (withheld), never zero.
 * The file names the one run it was made for (reform_id); the card is shown
 * for that run only, so no run id is written here.
 */
import { useEffect, useState } from "react";
import { BENCHMARKS_FILE, parseBenchmarks } from "./benchmarks";

export const NEET_FILE = "milburn_neet.json";

/** The groups shown side by side, in order. */
export const NEET_GROUPS = Object.freeze([
  { key: "neet_approx", label: "NEET (approximated)" },
  { key: "other_16_24", label: "Other 16–24s" },
]);

const FIGURES = [
  "records",
  "population",
  "share_in_losing_households_pct",
  "average_change_in_household_net_income",
  "people_losing_uc_health_or_pip",
  "share_losing_uc_health_or_pip_pct",
  "records_losing_uc_health_or_pip",
];

const finite = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const text = (value) => (typeof value === "string" ? value.trim() : "");

function parseGroups(source) {
  if (!source || typeof source !== "object") return null;
  const groups = {};
  for (const { key } of NEET_GROUPS) {
    const group = source[key];
    if (!group || typeof group !== "object") return null;
    groups[key] = Object.fromEntries(FIGURES.map((figure) => [figure, finite(group[figure])]));
  }
  return groups;
}

/**
 * The breakdown for one year: the file's own year's, or a by_year entry's
 * (its groups, total and share), or the file's own year when it does not
 * cover the year asked for.
 */
export function neetForYear(neet, year) {
  const chosen = neet?.byYear?.get(Number(year));
  return chosen ? { ...neet, ...chosen } : neet;
}

/** The file, checked: every figure a finite number or null. Null without its run, its year or either group. */
export function parseNeet(json) {
  if (!json || typeof json !== "object" || !text(json.reform_id)) return null;
  const year = Number.isInteger(json.year) ? json.year : null;
  const source = json.groups && typeof json.groups === "object" ? json.groups : null;
  if (year === null || !source) return null;
  const groups = parseGroups(source);
  if (!groups) return null;
  // Every year the file covers (by_year), each with its own groups and total
  const byYear = new Map([[year, { year, groups, total: finite(json.neet_approx_total), shareOfYoung: finite(json.neet_approx_share_of_16_24_pct) }]]);
  if (json.by_year && typeof json.by_year === "object" && !Array.isArray(json.by_year)) {
    for (const [key, item] of Object.entries(json.by_year)) {
      const other = Number(key);
      const otherGroups = item && typeof item === "object" ? parseGroups(item.groups) : null;
      if (/^\d{4}$/.test(key) && other !== year && otherGroups) {
        byYear.set(other, { year: other, groups: otherGroups, total: finite(item.neet_approx_total), shareOfYoung: finite(item.neet_approx_share_of_16_24_pct) });
      }
    }
  }
  return {
    reformId: text(json.reform_id),
    byYear,
    year,
    build: text(json.build),
    definition: text(json.definition),
    notes: Array.isArray(json.definition_notes) ? json.definition_notes.map(text).filter(Boolean) : [],
    total: finite(json.neet_approx_total),
    shareOfYoung: finite(json.neet_approx_share_of_16_24_pct),
    benchmarkId: text(json.ons_benchmark_id),
    groups,
  };
}

const read = (basePath, file) =>
  Promise.resolve()
    .then(() => fetch(`${basePath}/data/${file}`, { cache: "no-cache" }))
    .then((response) => (response?.ok ? response.json() : null))
    .catch(() => null);

/**
 * The breakdown and the published NEET count it is set beside (the
 * benchmarks file's row, or null): { status: "loading"|"ready"|"unavailable",
 * neet, benchmark }. Nothing is fetched unless `enabled`.
 */
export function useNeetBreakdown({ basePath = process.env.NEXT_PUBLIC_BASE_PATH || "", enabled = true } = {}) {
  const [state, setState] = useState({ status: "loading", neet: null, benchmark: null });
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    Promise.all([read(basePath, NEET_FILE), read(basePath, BENCHMARKS_FILE)]).then(([neetJson, benchmarksJson]) => {
      if (cancelled) return;
      const neet = parseNeet(neetJson);
      const benchmark = neet ? parseBenchmarks(benchmarksJson)?.rows.find((row) => row.id === neet.benchmarkId) ?? null : null;
      setState({ status: neet ? "ready" : "unavailable", neet, benchmark });
    });
    return () => {
      cancelled = true;
    };
  }, [basePath, enabled]);
  return enabled ? state : { status: "unavailable", neet: null, benchmark: null };
}
