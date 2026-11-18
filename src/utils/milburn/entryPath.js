/**
 * The phased move into work, read from public/data/milburn_entry_path.json,
 * which scripts/milburn_entry_path.py writes. Every figure there is
 * arithmetic on two runs, static + share × (everyone moves − static): the
 * expected value over who moves, not a run of the scenario
 * (docs/milburn-phased-scenario-design.md). Its shape (the fields read
 * here):
 *
 *   { years: [2027, …], start_year, effect, neet_gap_pp: { "2026": … },
 *     rebase_year, hours,
 *     paths: [{ id, share_path, base: "full"|"phased", on_tab,
 *       years: { "2029": { share, movers, no_change?, share_of_group?,
 *         exchequer_bn: { static, scenario },
 *         poverty_pp_abs_bhc, poverty_pp_rel_ahc,
 *         poverty_people_abs_bhc, poverty_people_rel_ahc,
 *         young_losing_pct } } }],
 *     linearity_check: { failed: [], … },
 *     withheld: [{ path, year, figure, reason }] }
 *
 * `share_of_group` is on paths on the phased package (rollout) only: their
 * `share` is of those the package has reached, `share_of_group` their
 * movers over the whole group.
 *
 * A figure withheld under the disclosure floor, or failing the linearity
 * check, is null, never zero.
 */
import { useEffect, useState } from "react";

export const ENTRY_PATH_FILE = "milburn_entry_path.json";

/** The paths the tab shows, in order, with their names. */
export const ENTRY_PATHS = Object.freeze([
  { id: "central", label: "Phased (central)", short: "Phased" },
  { id: "flat", label: "9% from 2029-30, no ramp", short: "Flat 9%" },
  { id: "with_pip", label: "Phased, PIP recipients too", short: "With PIP" },
  { id: "rollout", label: "9% of those reached, as claimants are reassessed", short: "Rollout" },
]);

/** The path Methodology gives alone: Table 3's timing not counted from 2028-29. */
export const UNREBASED_PATH = "unrebased";

/** The group the share applies to, in words (milburn_report.py, entry_group). */
export const ENTRY_GROUP =
  "non-working 18 to 24-year-olds whose Universal Credit health element the package removes";

/** The work they move into. */
export const ENTRY_WORK = "16 hours a week at the minimum wage for their age";

/** The method, said wherever the figures are. */
export const ENTRY_METHOD_SENTENCE =
  "Figures are arithmetic on two runs (the package alone, and the package with everyone in the group moving into work), scaled by the share: the expected value over who moves, if movers are a random draw from the group, not a simulation of particular people.";

/** The 9%'s reading, said wherever it is used. */
export const NINE_PER_CENT_SENTENCE =
  "The 9% is the analytical annex's employment effect for Universal Credit health claimants (section 1), read here as 9 percentage points; the annex does not say whether it is points or per cent, and the figures scale with it.";

/** The pairing of the 9% with the NEET path's timing is ours. */
export const PAIRING_SENTENCE =
  "The annex gives the 9% no time path. The phased path takes its timing from the review's NEET path (data tables, table 3), counted from 2028-29, the year before the benefit changes, reaching 9% in 2036-37. That pairing is ours: the NEET path reflects the review's whole package, and the report moves existing claimants at their scheduled reassessment (paragraphs 733 and 770); the annex does not publish its savings by year.";

/** Before April 2029. */
export const NO_CHANGE_SENTENCE =
  "No change before April 2029: the report's benefit changes start then. The review's own NEET path falls before then, from measures this scenario does not model.";

/** The tab's subtitle, said on the tab and on its loading skeleton alike. */
export const SCENARIOS_SUBTITLE =
  "The report's changes from April 2029, plus our assumed move into work for young UC health claimants, built from two review figures.";

/** Said in place of a count of movers before the changes start. */
export const NONE_BEFORE_START = "None: the changes start in April 2029";

/** Whether a path's year is before the changes start (no change, not a withheld figure). */
export const beforeStart = (data, figure, year) => Boolean(figure?.noChange) || (data?.startYear != null && Number(year) < data.startYear);

/**
 * A path's share of the whole group in a year: its own share, or, on the
 * phased package (rollout), its movers over the whole group.
 */
export function groupShare(data, pathId, year) {
  const figure = pathYear(data, pathId, year);
  if (!figure) return null;
  if (data?.paths?.get(pathId)?.base === "phased") return figure.shareOfGroup;
  return figure.share;
}

/** The review's 440,000, and why it is not used. */
export const REVIEW_FIGURE_CAVEAT =
  "The review's modelling puts around 440,000 more young people in sustained work by 2036 (paragraph 111). In its analytical annex that is the employment effect of the whole package of recommendations, including the benefit changes, employment support, the guarantees and education measures, and it counts effects beyond age 24 (section 8). The review gives no figure for the benefit changes on their own, so this scenario does not use it.";

/** Relative poverty is approximate under the scaling. */
export const RELATIVE_APPROXIMATE_SENTENCE =
  "Relative poverty is not shown: its line moves with the median, so it does not scale with the share, and the check (a random 25% and the other 75% of the group, run separately) found the parts missing the whole by up to 9% of the change.";

/** The replacement awards the review's 9% sits beside. */
export const REPLACEMENTS_SENTENCE =
  "The review's 9% sits in a scenario with replacement awards; the package here has none.";

const finite = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const pair = (value) => (value && typeof value === "object" ? { static: finite(value.static), scenario: finite(value.scenario) } : null);

/** The file, checked: null unless it has years and paths. */
export function parseEntryPath(json) {
  if (!json || typeof json !== "object" || !Array.isArray(json.years) || !Array.isArray(json.paths)) return null;
  const paths = new Map();
  for (const path of json.paths) {
    if (!path || typeof path.id !== "string" || !path.years) continue;
    const years = new Map();
    for (const [year, figures] of Object.entries(path.years)) {
      years.set(Number(year), {
        share: finite(figures.share),
        shareOfGroup: finite(figures.share_of_group),
        movers: finite(figures.movers),
        noChange: Boolean(figures.no_change),
        exchequer: pair(figures.exchequer_bn),
        povertyAbs: pair(figures.poverty_pp_abs_bhc),
        povertyRel: pair(figures.poverty_pp_rel_ahc),
        peopleAbs: pair(figures.poverty_people_abs_bhc),
        peopleRel: pair(figures.poverty_people_rel_ahc),
        youngLosing: pair(figures.young_losing_pct),
      });
    }
    paths.set(path.id, { id: path.id, base: path.base, sharePath: path.share_path, onTab: path.on_tab !== false, years });
  }
  const gaps = {};
  for (const [year, value] of Object.entries(json.neet_gap_pp || {})) if (finite(value) !== null) gaps[Number(year)] = value;
  return {
    years: json.years.filter((year) => Number.isInteger(year)),
    startYear: Number.isInteger(json.start_year) ? json.start_year : null,
    effect: finite(json.effect),
    neetGap: gaps,
    paths,
    checkFailed: Array.isArray(json.linearity_check?.failed) ? json.linearity_check.failed : [],
    withheld: Array.isArray(json.withheld) ? json.withheld : [],
  };
}

/** One path's figures in a year, or null. */
export function pathYear(data, pathId, year) {
  return data?.paths?.get(pathId)?.years?.get(Number(year)) ?? null;
}

/** "1.3%" for a share (0.0126); "0%" for none. */
export function shareText(share) {
  if (finite(share) === null) return "";
  if (share === 0) return "0%";
  return `${(share * 100).toFixed(1)}%`;
}

/** The file: { status: "loading"|"ready"|"unavailable", data }. */
export function useEntryPath({ basePath = process.env.NEXT_PUBLIC_BASE_PATH || "" } = {}) {
  const [state, setState] = useState({ status: "loading", data: null });
  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => fetch(`${basePath}/data/${ENTRY_PATH_FILE}`, { cache: "no-cache" }))
      .then((response) => (response?.ok ? response.json() : null))
      .then((json) => {
        const data = parseEntryPath(json);
        if (!cancelled) setState({ status: data ? "ready" : "unavailable", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "unavailable", data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [basePath]);
  return state;
}
