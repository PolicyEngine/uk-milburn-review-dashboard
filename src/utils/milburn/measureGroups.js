/**
 * How the Milburn runs are named and grouped on the page (the policy
 * selector and the Measures tab): packages, single measures, variants,
 * and comparators, each a wider form of a proposal in the final report. Descriptions stay as
 * milburn_measures.json publishes them; only the packages' names are
 * replaced, with a plain statement of what each package assumes.
 */

import { reportCopy } from "./reportStatus";

// The comparators' heading: the report-status switch's words
const COMPARATORS_LABEL = reportCopy().comparatorsLabel;

/** The packages' names on the page, by run id. */
export const MILBURN_DISPLAY_NAMES = Object.freeze({
  milburn_report_package: "The report's benefit changes (no replacement modelled)",
  milburn_report_uc_health: "UC health element removed for under-25s",
  milburn_report_pip: "PIP removed for 18 to 24-year-olds",
  // The pre-report runs with the same names as the report's, told apart
  uc_health_element_removed_under_25: "UC health element removed under 25 (from April 2027)",
  pip_removed_under_25: "PIP removed for 18 to 24-year-olds (from April 2027)",
  milburn_report_employer_nics_threshold: "Employer NI threshold £10,000 for 21 to 24s in retail and hospitality",
  milburn_report_youth_allowance_independent: "Higher Youth Allowance for under-25s living independently",
  milburn_report_package_phased: "The report's benefit changes, phased in over five years",
  milburn_report_employer_nics_threshold_glide_path: "Employer NI threshold for 21 to 24s, phased in over five years",
  milburn_package: "Full abolition, no replacements",
  milburn_package_central: "Central variant: severe cases kept, PIP at half rate",
  milburn_package_phased: "Full abolition, phased as claimants are reassessed",
  milburn_package_entry_25pct: "Full abolition with an illustrative move into work (25%)",
  // The comparator's name in the page's own form for the tax ("employer NI")
  employer_nics_zero_under_25: "Employer NI zero rate extended to under-25s",
});

export const REPORT_GROUP = "report";
export const PACKAGES_GROUP = "packages";
export const SINGLE_GROUP = "single";
export const VARIANTS_GROUP = "variants";
export const COMPARATORS_GROUP = "comparators";
export const HIDDEN_GROUP = "hidden";

/**
 * The groups in the order shown. A run named in none is a single measure.
 * The hidden group's runs stay loadable (a link naming one still opens it)
 * but are left out of the selector and the Measures tab: the 25% entry run
 * feeds Return to work only.
 */
export const MILBURN_GROUPS = Object.freeze([
  // The final report's measures, run from April 2029, when its welfare
  // savings start (annex section 1); first, so the page opens on them
  {
    id: REPORT_GROUP,
    label: "The report's measures",
    ids: [
      "milburn_report_package",
      "milburn_report_package_phased",
      "milburn_report_uc_health",
      "milburn_report_pip",
      "milburn_report_youth_allowance_independent",
      "milburn_report_employer_nics_threshold",
      "milburn_report_employer_nics_threshold_glide_path",
    ],
  },
  // Two runs from before the report, kept as comparators (Vahid, 17 Nov):
  // PIP at half rate stands in for the Additional Cost Allowance, whose rates
  // the report does not set; zero employer NICs under 25 is the option the
  // report rejects (para 268)
  {
    id: COMPARATORS_GROUP,
    label: COMPARATORS_LABEL,
    ids: ["pip_halved_under_25", "employer_nics_zero_under_25"],
  },
  // The other pre-report runs stay loadable (a link naming one still opens
  // it) but are not offered: the packages feed Key figures' range strip and
  // Return to work (the 25% entry run against the full abolition package)
  { id: PACKAGES_GROUP, label: "Pre-report packages", hidden: true, ids: ["milburn_package", "milburn_package_central", "milburn_package_phased"] },
  { id: SINGLE_GROUP, label: "Single measures", hidden: true, ids: ["uc_health_element_removed_under_25", "pip_removed_under_25"] },
  {
    id: VARIANTS_GROUP,
    label: "Variants",
    hidden: true,
    ids: ["uc_health_element_removed_under_22", "uc_health_element_removed_under_25_severe_kept", "pip_removed_16_to_24", "youth_allowance_at_25_plus_rate"],
  },
  { id: HIDDEN_GROUP, label: null, hidden: true, ids: ["milburn_package_entry_25pct", "uc_health_element_removed_under_25_new_claims"] },
]);

/**
 * A package's parts that have a run of their own, by package: the measures
 * it combines (reforms.py). The phased package has none: its parts are not
 * run on their own.
 */
export const PACKAGE_PARTS = Object.freeze({
  milburn_report_package: ["milburn_report_uc_health", "milburn_report_pip"],
  milburn_package: ["uc_health_element_removed_under_25", "pip_removed_under_25"],
  milburn_package_central: ["uc_health_element_removed_under_25_severe_kept", "pip_halved_under_25"],
});

/** The packages' run ids, in the order shown (Key figures' range strip). */
export const PACKAGE_IDS = MILBURN_GROUPS.find((group) => group.id === PACKAGES_GROUP).ids;

/** A run's display name: the package's own, else the name given. */
export function milburnDisplayName(id, name) {
  return Object.hasOwn(MILBURN_DISPLAY_NAMES, id) ? MILBURN_DISPLAY_NAMES[id] : name;
}

/** The group a run belongs to: a package (listed, or with members), a comparator, else a single measure. */
export function milburnGroupOf(measure) {
  const id = measure?.id;
  const named = MILBURN_GROUPS.find((group) => group.ids.includes(id));
  if (named) return named.id;
  if (Array.isArray(measure?.members) && measure.members.length > 1) return PACKAGES_GROUP;
  return SINGLE_GROUP;
}

/**
 * The run shown when none is chosen: the first offered in the groups'
 * order (the full abolition package), never a hidden run, though the
 * catalogue's own order puts the largest saving first.
 */
export function milburnDefaultMeasure(measures) {
  return groupMilburnMeasures(measures)[0]?.measures[0] ?? measures?.[0] ?? null;
}

/**
 * The measures in their groups, in the groups' order: within each group in
 * the order listed above, then any others in the order given. Empty groups
 * and the hidden group are left out.
 *
 * @returns {Array<{id: string, label: string, measures: Array<Object>}>}
 */
export function groupMilburnMeasures(measures) {
  return MILBURN_GROUPS.filter((group) => !group.hidden).map((group) => {
    const members = (measures ?? []).filter((measure) => milburnGroupOf(measure) === group.id);
    const rank = (measure) => {
      const at = group.ids.indexOf(measure.id);
      return at < 0 ? group.ids.length : at;
    };
    const ordered = members.map((measure, index) => ({ measure, index })).sort((a, b) => rank(a.measure) - rank(b.measure) || a.index - b.index);
    return { id: group.id, label: group.label, measures: ordered.map(({ measure }) => measure) };
  }).filter((group) => group.measures.length > 0);
}
