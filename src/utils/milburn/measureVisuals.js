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
 * - work allowance, a month: gov/dwp/universal_credit/means_test/
 *   work_allowance/{with_housing,without_housing}.yaml (£427 and £710 in
 *   2026-27), 2027-28 likewise a projection;
 * - DLA weekly rates: gov/dwp/dla/self_care/{middle,higher}.yaml and
 *   gov/dwp/dla/mobility/{lower,higher}.yaml, the same amounts as the PIP
 *   rates they are paired with (the child DLA card draws PIP's);
 * - employer National Insurance: gov/hmrc/national_insurance/class_1/
 *   rates/employer.yaml (15%), secondary_zero_rate_age_limits/
 *   under_21_group.yaml (21) and relevant_apprentice.yaml (25), and
 *   thresholds/upper_secondary_threshold.yaml (£966.73 a week, £50,270 a
 *   year).
 *
 * Projections are shown in whole pounds and said to be "about"; only the
 * legislated £217.26 is shown to the penny. The phased package's rule is
 * said in words; its shares are its saving over full abolition's, from
 * milburn_summary.json, never typed.
 * Every view returns null where its spec does not hold, and the card then
 * shows no visual.
 */
import { percent, pounds, wholePounds } from "../policyVisuals";
import { DEFAULT_SUMMARY_RUN, savingShare, summaryRun } from "./summary";

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
  // A month
  workAllowance: { withHousing: 441.94, withoutHousing: 734.85 },
  employerNics: { rate: 0.15, zeroRateBelowAge: 21, apprenticeZeroRateBelowAge: 25, upperSecondaryThreshold: 50270, secondaryThreshold: 5000 },
});

/**
 * The phased package's rule (milburn_variants.py: START and
 * REASSESSED_EACH_YEAR): people who turned 18 since April 2026 are reached
 * at once, the rest at a quarter of the remaining caseload a year.
 */
export const MILBURN_PHASING = Object.freeze({ start: 2026, reassessedEachYear: 0.25 });

/**
 * The rates' year as a caption says it: "2027-28", or "at 2027-28 rates" on
 * a card whose measure starts later than the rates drawn (`ratesNote`: the
 * report's runs, from April 2029).
 */
export const ratesYearText = (visual) => (visual?.ratesNote === true ? `at ${MILBURN_RATES.year} rates` : MILBURN_RATES.year);

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
    caption: `Health element by a single claimant's age, ${ratesYearText(visual)}`,
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
      `${name}: the Universal Credit health element by a single claimant's age, ${ratesYearText(visual)}. ` +
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
  // The report's child DLA to 18: from `from` to under `dlaTo` the award is
  // paid as DLA at the paired level, whose weekly amounts are PIP's
  if (visual.dlaTo !== undefined) {
    const to = visual.dlaTo;
    if (!isAge(to) || to <= from || to > UPPER_AGE || share !== 0) return null;
    const band = `${from} to ${to - 1}`;
    return {
      caption: `Disability benefit paid, by age, ${ratesYearText(visual)}`,
      ages: cells(16, (age) => ({ before: 1, after: 1, some: age >= from && age < to })),
      key: [["some", "Child DLA, not PIP"], ["after", "PIP, unchanged"]],
      bands: [
        { from, to: to - 1, title: band, text: "DLA, same amounts", tone: "cut" },
        { from: to, to: LAST_AGE, title: `${to} and over`, text: "PIP, unchanged", tone: "kept" },
      ],
      chips: [
        { icon: "hand", when: "Care, was daily living, a week", value: `About ${wholePounds(dailyLiving.standard)} or ${wholePounds(dailyLiving.enhanced)}` },
        { icon: "move", when: "Mobility, a week", value: `About ${wholePounds(mobility.standard)} or ${wholePounds(mobility.enhanced)}` },
      ],
      alt:
        `${name}: the disability benefit paid, by age, ${ratesYearText(visual)}. ` +
        `Ages ${band}: child Disability Living Allowance under the measure, instead of Personal Independence Payment, at the same weekly amounts: ` +
        `care at the middle or highest rate, about ${wholePounds(dailyLiving.standard)} or ${wholePounds(dailyLiving.enhanced)}, for standard or enhanced daily living; ` +
        `mobility at the lower or higher rate, about ${wholePounds(mobility.standard)} or ${wholePounds(mobility.enhanced)}, for standard or enhanced mobility. ` +
        `Aged ${to} and over: PIP, unchanged.`,
    };
  }
  const ages = cells(16, (age) => ({ before: 1, after: age >= from && age < UPPER_AGE ? share : 1 }));
  const outcome = share ? "Half" : "£0";
  return {
    caption: `Share of a PIP award paid, by age, ${ratesYearText(visual)}`,
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
      `${name}: Personal Independence Payment by age, ${ratesYearText(visual)}. ` +
      `Ages ${from} to ${UPPER_AGE - 1}: ${share ? "half the award" : "no PIP"} under the measure. ` +
      `Current law's weekly rates: daily living about ${wholePounds(dailyLiving.standard)} (standard) or ${wholePounds(dailyLiving.enhanced)} (enhanced); ` +
      `mobility about ${wholePounds(mobility.standard)} or ${wholePounds(mobility.enhanced)}. ` +
      `${from > 16 ? `Ages 16 to ${from - 1} and ${UPPER_AGE} and over` : `Ages ${UPPER_AGE} and over`}: unchanged.`,
  };
}

// --- Employer National Insurance ---------------------------------------------

/**
 * The employer rate by the employee's age: zero under 21 today, under 25
 * with the measure. With `visual.threshold` (the report's proposal) the
 * rate is unchanged and only the earnings it starts from move, for
 * employees from 21 to under `limit` in retail and hospitality.
 */
export function employerNicsView(visual, name) {
  const limit = visual?.limit;
  const { rate, zeroRateBelowAge, apprenticeZeroRateBelowAge, upperSecondaryThreshold, secondaryThreshold } = MILBURN_RATES.employerNics;
  if (!isAge(limit) || limit <= zeroRateBelowAge || limit > LAST_AGE) return null;
  if (visual.threshold !== undefined) {
    const threshold = visual.threshold;
    if (!Number.isFinite(threshold) || threshold <= secondaryThreshold) return null;
    // The glide path (the report's five years, in our equal steps): drawn only where its steps end at the threshold
    const glide = visual.glide;
    if (glide !== undefined && !(isAge(glide.firstYear) && isAge(glide.lastYear) && glide.lastYear > glide.firstYear && glide.step > 0 && glide.from > secondaryThreshold && glide.from + glide.step * (glide.lastYear - glide.firstYear) === threshold)) return null;
    const band = `${zeroRateBelowAge} to ${limit - 1}`;
    const moved = (age) => age >= zeroRateBelowAge && age < limit;
    return {
      caption: glide
        ? `Earnings from which employers pay National Insurance, by the employee's age, from ${fiscalYear(glide.lastYear)}`
        : "Earnings from which employers pay National Insurance, by the employee's age",
      ages: cells(16, (age) => ({ before: age < zeroRateBelowAge ? 0 : 1, after: age < zeroRateBelowAge ? 0 : 1, some: moved(age) })),
      key: [["some", "Higher threshold, retail and hospitality"], ["after", "Unchanged"]],
      bands: [
        { from: 16, to: zeroRateBelowAge - 1, title: `Under ${zeroRateBelowAge}`, text: "0% already", tone: "kept" },
        { from: zeroRateBelowAge, to: limit - 1, title: band, text: glide ? `From ${wholePounds(threshold)} by ${fiscalYear(glide.lastYear)}, was ${wholePounds(secondaryThreshold)}` : `From ${wholePounds(threshold)}, was ${wholePounds(secondaryThreshold)}`, tone: "cut" },
        { from: limit, to: LAST_AGE, title: `${limit} and over`, text: `From ${wholePounds(secondaryThreshold)}`, tone: "kept" },
      ],
      chips: [
        ...(glide ? [{ icon: "file-clock", when: `${fiscalYear(glide.firstYear)} to ${fiscalYear(glide.lastYear)}`, value: `${wholePounds(glide.from)}, rising ${wholePounds(glide.step)} a year` }] : []),
        { icon: "coins", when: "Rate above the threshold", value: `${percent(rate)}, unchanged` },
        { icon: "cap", when: `Apprentices under ${apprenticeZeroRateBelowAge}`, value: "0% already" },
      ],
      alt:
        `${name}: the earnings from which employers pay National Insurance, by the employee's age. ` +
        `Under ${zeroRateBelowAge}: 0% already. Ages ${band} in retail and hospitality: from ${wholePounds(threshold)} a year under the measure${glide ? ` by ${fiscalYear(glide.lastYear)}` : ""}, instead of ${wholePounds(secondaryThreshold)}` +
        (glide ? `, in steps: ${wholePounds(glide.from)} in ${fiscalYear(glide.firstYear)}, rising ${wholePounds(glide.step)} a year. ` : ". ") +
        `Aged ${limit} and over, and other sectors: from ${wholePounds(secondaryThreshold)}, unchanged. ` +
        `The ${percent(rate)} rate is unchanged; apprentices under ${apprenticeZeroRateBelowAge} have a zero rate already.`,
    };
  }
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

/**
 * The under-25 standard allowance beside the 25-and-over rate, single and
 * couple. With `visual.housingCosts` (the report's higher Youth Allowance)
 * the higher rate is for claims with a housing costs element only.
 */
export function standardAllowanceView(visual, name) {
  if (visual?.workAllowance === true) return workAllowanceView(visual, name);
  const housing = visual?.housingCosts === true;
  const when = ratesYearText(visual);
  const { singleUnder25, single25Plus, coupleUnder25, couple25Plus } = MILBURN_RATES.standardAllowance;
  const pairs = [
    { label: "Single, under 25", words: "a single claimant under 25", before: singleUnder25, after: single25Plus },
    { label: "Couple, both under 25", words: "a couple both under 25", before: coupleUnder25, after: couple25Plus },
  ];
  if (pairs.some(({ before, after }) => !(after > before))) return null;
  const gain = ({ before, after }) => Math.round(after) - Math.round(before);
  return {
    caption: `Standard allowance${housing ? " for a claim with a housing costs element" : ""}, a month, ${when}`,
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
      `${name}: the Universal Credit standard allowance${housing ? " for a claim with a housing costs element" : ""}, a month, ${when} (about). ` +
      pairs.map((pair) => `For ${pair.words}: ${wholePounds(pair.after)} instead of ${wholePounds(pair.before)}, ${wholePounds(gain(pair))} more`).join("; ") +
      "." +
      (housing ? " Claims without a housing costs element keep the under-25 rate." : ""),
  };
}

/**
 * The illustrative work allowance (`visual.workAllowance` on the standard
 * allowance kind): an under-25 claim with no child and no limited
 * capability for work has none today; under the measure it has the
 * current amounts, the lower with a housing costs element.
 */
// The Universal Credit taper (gov/dwp/universal_credit/means_test/reduction_rate.yaml)
const TAPER = 0.55;

function workAllowanceView(visual, name) {
  const when = ratesYearText(visual);
  const { withHousing, withoutHousing } = MILBURN_RATES.workAllowance;
  if (!(withHousing > 0 && withoutHousing > withHousing)) return null;
  const pairs = [
    { label: "With housing costs", words: "a claim with a housing costs element", after: withHousing },
    { label: "Without housing costs", words: "a claim without one", after: withoutHousing },
  ];
  return {
    caption: `Work allowance for an under-25 claim with no child or health condition, a month, ${when}`,
    max: withoutHousing,
    key: [["after", "Earnings kept before the award falls"]],
    groups: pairs.map((pair) => ({
      label: pair.label,
      // The award rises by the taper's share of the earnings no longer counted
      note: `Award up to +${wholePounds(TAPER * pair.after)} a month`,
      columns: [
        { label: "Now", text: wholePounds(0), parts: [] },
        { label: "Measure", text: wholePounds(pair.after), parts: [{ value: pair.after, tone: "after" }] },
      ],
    })),
    chips: [{ icon: "coins", when: "Taper above the allowance", value: `${percent(TAPER)}, unchanged` }],
    alt:
      `${name}: the Universal Credit work allowance for a claim in which every claimant is under 25, with no child and no limited capability for work, a month, ${when} (about). ` +
      `Current law: none, so every pound of earnings reduces the award. Under the measure: ` +
      pairs.map((pair) => `${wholePounds(pair.after)} for ${pair.words}`).join("; ") +
      `, so the award is up to ${pairs.map((pair) => wholePounds(TAPER * pair.after)).join(" or ")} a month higher` +
      `. These are the current work allowance amounts, our assumption: the report gives none. The ${percent(TAPER)} taper is unchanged.`,
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
    caption: `An under-25 with the health element and PIP, a month, ${ratesYearText(visual)}`,
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
            label: "Package",
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
      `${name}: an illustrative claimant under 25 with the health element (a claim before April 2026) and standard-rate daily living PIP, a month, ${ratesYearText(visual)}. ` +
      `Current law: about ${wholePounds(before)}, of which ${wholePounds(element)} health element and ${wholePounds(pip)} PIP (the weekly rate times 52 over 12). ` +
      `Under the package: ${wholePounds(after)}${share ? " (half the PIP)" : ""}, ${wholePounds(before - after)} a month less.` +
      (severeKept ? " A claimant with 24 or more PIP daily living points keeps the health element." : ""),
  };
}

/**
 * The phased package's Exchequer saving as a share of full abolition's, a
 * year each, from milburn_summary.json: [{ year, share }], for the years
 * both runs carry. `runId` is the phased run's id (its card's measure).
 * Empty without the file or either run. This is what the
 * run's results show; the rule above gives who is reached, not this share.
 */
// `fullId`: the run it is a share of (a card's `visual.of`: the report's
// phased run against the report's package, whose saving starts in 2029-30)
export function phasedSavingShares(summary, runId, fullId = DEFAULT_SUMMARY_RUN) {
  const phased = summaryRun(summary, runId);
  const full = summaryRun(summary, fullId);
  if (!phased || !full) return [];
  return Object.keys(phased.savingBn)
    .sort()
    .map((year) => ({ year: Number(year), share: savingShare(phased, full, year) }))
    .filter((entry) => entry.share !== null && entry.share >= 0);
}

/**
 * The phased package: its rule in words (new entrants at once, a quarter
 * of the remaining claimants a year) and, where the summary's shares are
 * given, its saving as a share of full abolition's in each year, from the
 * results. Without shares, the rule alone: no share is typed here.
 */
export function phasedView(visual, name, shares = []) {
  const whole = (share) => `${Math.round(share * 100)}%`;
  // The card's own rule where it gives one (the report's run: `since`, `each`), else the pre-report run's
  const rate = visual?.each ?? MILBURN_PHASING.reassessedEachYear;
  const start = visual?.since ?? MILBURN_PHASING.start;
  if (!(rate > 0 && rate <= 1) || !isAge(start)) return null;
  const of = typeof visual?.whole === "string" && visual.whole ? visual.whole : "full abolition";
  const each = whole(rate);
  const since = `April ${start}`;
  const rule = `People who turned 18 since ${since} are reached at once; existing claimants as they are reassessed, at ${each} of the remaining caseload a year.`;
  const chips = [
    { icon: "file-plus", when: `Turned 18 since ${since}`, value: "Reached at once" },
    { icon: "file-clock", when: "Existing claimants", value: `${each} of those remaining, each year` },
  ];
  if (!shares.length) {
    return { caption: "How the new rules are phased in", key: [], max: 1, groups: [], chips, alt: `${name}: ${rule}` };
  }
  return {
    caption: `Exchequer saving as a share of ${of}'s`,
    max: Math.max(1, ...shares.map((entry) => entry.share)),
    key: [["after", "Phased package"], ["ghost", of.charAt(0).toUpperCase() + of.slice(1)]],
    groups: shares.map((entry) => ({
      columns: [{ label: fiscalYear(entry.year), text: whole(entry.share), ghost: 1, parts: [{ value: entry.share, tone: "after" }] }],
    })),
    chips,
    alt:
      `${name}: ${rule} Its Exchequer saving as a share of ${of}'s, from the results: ` +
      shares.map((entry) => `${whole(entry.share)} in ${fiscalYear(entry.year)}`).join(", ") +
      ".",
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
