/**
 * The numbers behind the Milburn measures' card visuals (components/
 * policies/MilburnVisual.jsx). The local build route publishes no
 * policy_parameters.json entry for these runs, so the rates are held here,
 * read from the installed policyengine-uk 2.177.7 (the build's engine) for
 * the 2027-28 fiscal year, the measures' first:
 *
 * - health element, claims from April 2026 (£217.26 a month, legislated
 *   and frozen to 2029-30): gov/dwp/universal_credit/elements/disabled/
 *   amount.yaml and rebalancing/new_claimant_health_element.yaml;
 * - health element, earlier claims (the protected amount): £429.80 a month
 *   is legislated for 2026-27 (rebalancing/protected_health_element.yaml);
 *   2027-28 has no legislated amount, and the model takes the lowest the
 *   Universal Credit Act 2025 s. 4 allows (scenarios/uc_reform.py,
 *   protected_lcwra_floor), £442.10: a projection;
 * - PIP weekly rates: gov/dwp/pip/daily_living/{standard,enhanced}.yaml
 *   and gov/dwp/pip/mobility/{standard,enhanced}.yaml, whose last set
 *   rates are 2026-27's; 2027-28 is the model's uprating: a projection;
 * - standard allowance, a month: gov/dwp/universal_credit/
 *   standard_allowance/amount.yaml, 2027-28 likewise a projection;
 * - employer National Insurance: gov/hmrc/national_insurance/class_1/
 *   rates/employer.yaml (15%), secondary_zero_rate_age_limits/
 *   under_21_group.yaml (21) and relevant_apprentice.yaml (25), and
 *   thresholds/upper_secondary_threshold.yaml (£966.73 a week, £50,270 a
 *   year).
 *
 * Projections are shown in whole pounds and said to be "about"; only the
 * legislated £217.26 is shown to the penny. The phased package's shares
 * are derived below from the rule in budget_measures/milburn_variants.py.
 * Every view returns null where its spec does not hold, and the card then
 * shows no visual.
 */
import { percent, pounds, wholePounds } from "../policyVisuals";

export const MILBURN_RATES = Object.freeze({
  engine: "policyengine-uk 2.177.7",
  year: "2027-28",
  // A month
  healthElement: { protected: 442.1, protected2026: 429.8, newClaimant: 217.26 },
  // A week
  pip: {
    dailyLiving: { standard: 79.38, enhanced: 118.61 },
    mobility: { standard: 31.36, enhanced: 82.8 },
  },
  // A month
  standardAllowance: { singleUnder25: 353.17, single25Plus: 443.21, coupleUnder25: 551.11, couple25Plus: 695.71 },
  employerNics: { rate: 0.15, zeroRateBelowAge: 21, apprenticeZeroRateBelowAge: 25, upperSecondaryThreshold: 50270 },
});

/**
 * The phased package's rule (milburn_variants.py: START, REASSESSED_EACH_YEAR
 * and `reached`): people who turned 18 since April 2026 are reached at
 * once, the rest at a quarter of the remaining caseload a year.
 */
export const MILBURN_PHASING = Object.freeze({ start: 2026, reassessedEachYear: 0.25, ages: [18, 24], years: [2027, 2028, 2029, 2030, 2031] });

/** PIP is a weekly rate: a month is 52 weeks over 12 months. */
export const weeklyToMonthly = (weekly) => (weekly * 52) / 12;

const LAST_AGE = 29;
const UPPER_AGE = 25;
const fiscalYear = (year) => `${year}-${String(year + 1).slice(2)}`;
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const isAge = (value) => Number.isInteger(value) && value > 0;

/** The age cells' ticks: every age, the last as "29+". */
const cells = (from, amounts) =>
  range(from, LAST_AGE).map((age) => ({ age, label: age === LAST_AGE ? `${age}+` : String(age), ...amounts(age) }));

// --- Universal Credit health element ---------------------------------------

/**
 * The health element by a single claimant's age: paid from `visual.limit`
 * (25 or 22), nil below it; with `severeKept`, a claimant under the limit
 * with 24 or more PIP daily living points keeps it.
 */
export function healthElementView(visual, name) {
  const limit = visual?.limit;
  if (!isAge(limit) || limit <= 18 || limit > LAST_AGE) return null;
  const { protected: amount, newClaimant } = MILBURN_RATES.healthElement;
  const severeKept = visual.severeKept === true;
  const ages = cells(18, (age) => ({ before: 1, after: age < limit && !severeKept ? 0 : 1, some: age < limit && severeKept }));
  return {
    caption: `Health element by a single claimant's age, ${MILBURN_RATES.year}`,
    ages,
    key: severeKept ? [["some", "Kept only with 24+ points"], ["after", "Under the measure"]] : [["ghost", "Current law"], ["after", "Under the measure"]],
    bands: [
      { from: 18, to: limit - 1, title: `Under ${limit}`, text: severeKept ? "£0 unless 24+ points" : "£0", tone: "cut" },
      { from: limit, to: LAST_AGE, title: `${limit} and over`, text: "Unchanged", tone: "kept" },
    ],
    chips: [
      { icon: "file-clock", when: "Claims before April 2026", value: `About ${wholePounds(amount)} a month` },
      { icon: "file-plus", when: "Claims from April 2026", value: `${pounds(newClaimant)} a month` },
      ...(severeKept ? [{ icon: "shield", when: "24+ PIP daily living points", value: "Keeps it" }] : []),
    ],
    alt:
      `${name}: the Universal Credit health element by a single claimant's age, ${MILBURN_RATES.year}. ` +
      `Under ${limit}: £0 under the measure, instead of about ${wholePounds(amount)} a month for claims before April 2026 ` +
      `or ${pounds(newClaimant)} for claims from April 2026. ` +
      (severeKept ? `A claimant under ${limit} with 24 or more PIP daily living points keeps it. ` : "") +
      `Aged ${limit} and over: unchanged.`,
  };
}

// --- Personal Independence Payment ------------------------------------------

/**
 * PIP by age: from `visual.from` (18 or 16) to 24 the award is multiplied
 * by `visual.share` (0: removed; 0.5: halved); other ages keep it.
 */
export function pipView(visual, name) {
  const from = visual?.from;
  const share = visual?.share;
  if (!isAge(from) || from < 16 || from >= UPPER_AGE || !(share === 0 || share === 0.5)) return null;
  const { dailyLiving, mobility } = MILBURN_RATES.pip;
  const ages = cells(16, (age) => ({ before: 1, after: age >= from && age < UPPER_AGE ? share : 1 }));
  const outcome = share ? "Half" : "£0";
  return {
    caption: `Share of a PIP award paid, by age, ${MILBURN_RATES.year}`,
    ages,
    key: [["ghost", "Current law"], ["after", "Under the measure"]],
    bands: [
      ...(from > 16 ? [{ from: 16, to: from - 1, title: `16 to ${from - 1}`, text: "Kept", tone: "kept" }] : []),
      { from, to: UPPER_AGE - 1, title: `${from} to ${UPPER_AGE - 1}`, text: outcome, tone: "cut" },
      { from: UPPER_AGE, to: LAST_AGE, title: `${UPPER_AGE} and over`, text: "Unchanged", tone: "kept" },
    ],
    chips: [
      { icon: "hand", when: "Daily living, a week", value: `About ${wholePounds(dailyLiving.standard)} or ${wholePounds(dailyLiving.enhanced)}` },
      { icon: "move", when: "Mobility, a week", value: `About ${wholePounds(mobility.standard)} or ${wholePounds(mobility.enhanced)}` },
    ],
    alt:
      `${name}: Personal Independence Payment by age, ${MILBURN_RATES.year}. ` +
      `Ages ${from} to ${UPPER_AGE - 1}: ${share ? "half the award" : "no PIP"} under the measure. ` +
      `Current law's weekly rates: daily living about ${wholePounds(dailyLiving.standard)} (standard) or ${wholePounds(dailyLiving.enhanced)} (enhanced); ` +
      `mobility about ${wholePounds(mobility.standard)} or ${wholePounds(mobility.enhanced)}. ` +
      `${from > 16 ? `Ages 16 to ${from - 1} and ${UPPER_AGE} and over` : `Ages ${UPPER_AGE} and over`}: unchanged.`,
  };
}

// --- Employer National Insurance ---------------------------------------------

/** The employer rate by the employee's age: zero under 21 today, under 25 with the measure. */
export function employerNicsView(visual, name) {
  const limit = visual?.limit;
  const { rate, zeroRateBelowAge, apprenticeZeroRateBelowAge, upperSecondaryThreshold } = MILBURN_RATES.employerNics;
  if (!isAge(limit) || limit <= zeroRateBelowAge || limit > LAST_AGE) return null;
  const ages = cells(16, (age) => ({ before: age < zeroRateBelowAge ? 0 : 1, after: age < limit ? 0 : 1 }));
  return {
    caption: `Employer National Insurance rate by the employee's age, ${MILBURN_RATES.year}`,
    ages,
    key: [["ghost", "Current law"], ["after", "Under the measure"]],
    bands: [
      { from: 16, to: zeroRateBelowAge - 1, title: `Under ${zeroRateBelowAge}`, text: "0% already", tone: "kept" },
      { from: zeroRateBelowAge, to: limit - 1, title: `${zeroRateBelowAge} to ${limit - 1}`, text: `0%, was ${percent(rate)}`, tone: "cut" },
      { from: limit, to: LAST_AGE, title: `${limit} and over`, text: percent(rate), tone: "kept" },
    ],
    chips: [
      { icon: "coins", when: "Zero rate on earnings up to", value: `${wholePounds(upperSecondaryThreshold)} a year` },
      { icon: "cap", when: `Apprentices under ${apprenticeZeroRateBelowAge}`, value: "0% already" },
    ],
    alt:
      `${name}: the employer National Insurance rate by the employee's age, ${MILBURN_RATES.year}. ` +
      `Under ${zeroRateBelowAge}: 0% already. Ages ${zeroRateBelowAge} to ${limit - 1}: 0% under the measure, instead of ${percent(rate)}. ` +
      `Aged ${limit} and over: ${percent(rate)}, unchanged. ` +
      `The zero rate applies to earnings up to ${wholePounds(upperSecondaryThreshold)} a year; apprentices under ${apprenticeZeroRateBelowAge} have it already.`,
  };
}

// --- Standard allowance ---------------------------------------------------------

/** The under-25 standard allowance beside the 25-and-over rate, single and couple. */
export function standardAllowanceView(_visual, name) {
  const { singleUnder25, single25Plus, coupleUnder25, couple25Plus } = MILBURN_RATES.standardAllowance;
  const pairs = [
    { label: "Single, under 25", words: "a single claimant under 25", before: singleUnder25, after: single25Plus },
    { label: "Couple, both under 25", words: "a couple both under 25", before: coupleUnder25, after: couple25Plus },
  ];
  if (pairs.some(({ before, after }) => !(after > before))) return null;
  const gain = ({ before, after }) => Math.round(after) - Math.round(before);
  return {
    caption: `Standard allowance, a month, ${MILBURN_RATES.year}`,
    max: couple25Plus,
    key: [["before", "Under-25 rate"], ["after", "25-and-over rate"]],
    groups: pairs.map((pair) => ({
      label: pair.label,
      note: `+${wholePounds(gain(pair))} a month`,
      columns: [
        { label: "Now", text: wholePounds(pair.before), parts: [{ value: pair.before, tone: "before" }] },
        { label: "Measure", text: wholePounds(pair.after), parts: [{ value: pair.after, tone: "after" }] },
      ],
    })),
    alt:
      `${name}: the Universal Credit standard allowance, a month, ${MILBURN_RATES.year} (about). ` +
      pairs.map((pair) => `For ${pair.words}: ${wholePounds(pair.after)} instead of ${wholePounds(pair.before)}, ${wholePounds(gain(pair))} more`).join("; ") +
      ".",
  };
}

// --- Packages ----------------------------------------------------------------------

/**
 * A package for one illustrative claimant under 25: the protected health
 * element and standard-rate daily living PIP (our choice of example), a
 * month. `pipShare` is the share of PIP kept (0, or 0.5 in the central
 * variant, which also keeps the element with 24 or more points).
 */
export function packageView(visual, name) {
  const share = visual?.pipShare;
  if (!(share === 0 || share === 0.5)) return null;
  const severeKept = visual.severeKept === true;
  const element = MILBURN_RATES.healthElement.protected;
  const pip = weeklyToMonthly(MILBURN_RATES.pip.dailyLiving.standard);
  const kept = pip * share;
  const before = Math.round(element) + Math.round(pip);
  const after = Math.round(kept);
  return {
    caption: `An under-25 with the health element and standard daily living PIP, a month, ${MILBURN_RATES.year}`,
    max: element + pip,
    key: [["after", "Health element"], ["soft", "PIP"], ["ghost", "Removed"]],
    groups: [
      {
        note: `${wholePounds(before - after)} a month less`,
        tone: "loss",
        columns: [
          {
            label: "Current law",
            text: wholePounds(before),
            parts: [{ value: pip, tone: "soft" }, { value: element, tone: "after" }],
          },
          {
            label: "Under the package",
            text: wholePounds(after),
            ghost: element + pip,
            parts: kept > 0 ? [{ value: kept, tone: "soft" }] : [],
          },
        ],
      },
    ],
    chips: [
      { icon: "file-clock", when: "Health element", value: `About ${wholePounds(element)} to £0` },
      { icon: "hand", when: "PIP, standard daily living", value: `About ${wholePounds(pip)} to ${wholePounds(kept)}` },
      ...(severeKept ? [{ icon: "shield", when: "24+ PIP daily living points", value: "Keeps the element" }] : []),
    ],
    alt:
      `${name}: an illustrative claimant under 25 with the health element (a claim before April 2026) and standard-rate daily living PIP, a month, ${MILBURN_RATES.year}. ` +
      `Current law: about ${wholePounds(before)}, of which ${wholePounds(element)} health element and ${wholePounds(pip)} PIP (the weekly rate times 52 over 12). ` +
      `Under the package: ${wholePounds(after)}${share ? " (half the PIP)" : ""}, ${wholePounds(before - after)} a month less.` +
      (severeKept ? " A claimant with 24 or more PIP daily living points keeps the health element." : ""),
  };
}

/** The share of 18 to 24-year-olds the phased package reaches in a year, with equal numbers at each age. */
export function phasedShare(year, phasing = MILBURN_PHASING) {
  const years = year - phasing.start;
  const cohorts = phasing.ages[1] - phasing.ages[0] + 1;
  const entrants = Math.min(Math.max(years, 0), cohorts) / cohorts;
  const reassessed = (1 - entrants) * (1 - (1 - phasing.reassessedEachYear) ** Math.max(years, 0));
  return { entrants, reassessed, total: entrants + reassessed };
}

/** The phased package: the share reached each year, new entrants and reassessed claimants. */
export function phasedView(_visual, name) {
  const shares = MILBURN_PHASING.years.map((year) => ({ year: fiscalYear(year), ...phasedShare(year) }));
  if (shares.some(({ total }) => !(total > 0 && total <= 1))) return null;
  const whole = (share) => `${Math.round(share * 100)}%`;
  return {
    caption: "Share of 18 to 24-year-olds the new rules reach (about)",
    max: 1,
    key: [["soft", "Turned 18 since April 2026"], ["after", "Reassessed"]],
    groups: shares.map((share) => ({
      columns: [
        {
          label: share.year,
          text: whole(share.total),
          ghost: 1,
          parts: [{ value: share.reassessed, tone: "after" }, { value: share.entrants, tone: "soft" }],
        },
      ],
    })),
    alt:
      `${name}: the share of 18 to 24-year-olds the new rules reach, with equal numbers at each age: ` +
      shares.map((share) => `about ${whole(share.total)} in ${share.year}`).join(", ") +
      `. People who turned 18 since April 2026 are reached at once; existing claimants at ${whole(MILBURN_PHASING.reassessedEachYear)} of the remaining caseload a year.`,
  };
}

/** Each kind's view (the visual's numbers, or null). */
export const MILBURN_VIEWS = Object.freeze({
  "milburn-health-element": healthElementView,
  "milburn-pip": pipView,
  "milburn-employer-nics": employerNicsView,
  "milburn-standard-allowance": standardAllowanceView,
  "milburn-package": packageView,
  "milburn-phased": phasedView,
});

/** Whether a card visual kind is drawn from this file's static spec, with no policy_parameters.json entry. */
export const isMilburnVisualKind = (kind) => typeof kind === "string" && Object.hasOwn(MILBURN_VIEWS, kind);

/** A Milburn card's visual numbers, or null for another kind or a spec that does not hold. */
export function milburnVisualView(visual, name) {
  const view = isMilburnVisualKind(visual?.kind) ? MILBURN_VIEWS[visual.kind] : null;
  return view ? view(visual, name) : null;
}
