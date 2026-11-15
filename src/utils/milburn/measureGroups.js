/**
 * How the Milburn runs are named and grouped on the page (the policy
 * selector and the Policies tab): packages, single measures, and
 * comparators that are not review proposals. Descriptions stay as
 * milburn_measures.json publishes them; only the packages' names are
 * replaced, with a plain statement of what each package assumes.
 */

/** The packages' names on the page, by run id. */
export const MILBURN_DISPLAY_NAMES = Object.freeze({
  milburn_package: "Full abolition, no replacement (upper bound)",
  milburn_package_central: "Central variant: severe cases kept, PIP at half rate",
  milburn_package_phased: "Full abolition, phased as claimants are reassessed",
  milburn_package_entry_25pct: "Full abolition with an illustrative move into work (25%)",
});

export const PACKAGES_GROUP = "packages";
export const SINGLE_GROUP = "single";
export const COMPARATORS_GROUP = "comparators";

/** The groups in the order shown. A run named in none is a single measure. */
export const MILBURN_GROUPS = Object.freeze([
  {
    id: PACKAGES_GROUP,
    label: "Packages",
    ids: ["milburn_package", "milburn_package_central", "milburn_package_phased", "milburn_package_entry_25pct"],
  },
  { id: SINGLE_GROUP, label: "Single measures", ids: [] },
  {
    id: COMPARATORS_GROUP,
    label: "Comparators, not review proposals",
    ids: ["youth_allowance_at_25_plus_rate", "employer_nics_zero_under_25"],
  },
]);

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
 * The measures in their groups, in the groups' order: within Packages and
 * Comparators in the order listed above, then any others in the order
 * given; single measures in the order given. Empty groups are left out.
 *
 * @returns {Array<{id: string, label: string, measures: Array<Object>}>}
 */
export function groupMilburnMeasures(measures) {
  return MILBURN_GROUPS.map((group) => {
    const members = (measures ?? []).filter((measure) => milburnGroupOf(measure) === group.id);
    const rank = (measure) => {
      const at = group.ids.indexOf(measure.id);
      return at < 0 ? group.ids.length : at;
    };
    const ordered = members.map((measure, index) => ({ measure, index })).sort((a, b) => rank(a.measure) - rank(b.measure) || a.index - b.index);
    return { id: group.id, label: group.label, measures: ordered.map(({ measure }) => measure) };
  }).filter((group) => group.measures.length > 0);
}
