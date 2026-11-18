import { useEffect, useMemo, useRef, useState } from "react";
import { Percent, UsersRound, Wallet } from "lucide-react";
import TitleIcon from "../TitleIcon";
import SectionHeading from "../SectionHeading";
import Disclosure from "../Disclosure";
import HeadlineTile from "../livingStandards/HeadlineTile";
import UnavailableNotice from "../publication/UnavailableNotice";
import HouseholdCards from "../personal/HouseholdCards";
import { ChoiceTiles, NumberField, SelectField } from "../personal/FormControls";
import NetIncomeWaterfall from "../personal/NetIncomeWaterfall";
import PolicyBars from "../personal/PolicyBars";
import ProgrammeTable from "../personal/ProgrammeTable";
import { ProcessingPanel, SingleYearError, headlineTotals, useDelayed, useElapsedSeconds } from "../personal/SingleYearResults";
import { REGION_OPTIONS, StepGroup, YES_NO, hintPlace, useNarrow } from "../HouseholdCalculator";
import useCollapse from "../../hooks/useCollapse";
import { normaliseHouseholdImpact } from "../../utils/householdImpactApi";
import { MINUS, money, policyRows } from "../../utils/singleYear";
import { CHART_COLOURS } from "../../utils/chartTheme";
import { prefersReducedMotion } from "../../utils/chartMotion";
import { scrollBelowBars } from "../../utils/pageScroll";
import {
  CALCULATION_TIMES,
  DEFAULT_ANSWERS,
  EDUCATION_AGE,
  FISCAL_YEAR,
  OLDEST_CHILD,
  PARENTS,
  PIP_OPTIONS,
  RUNS,
  SECTOR_OPTIONS,
  YEAR,
  STARTING_UP_TEXT,
  answersFromHousehold,
  calculateHousehold,
  customAvailable,
  exampleFromLocation,
  householdRequest,
  isRentingTenure,
  loadPresets,
  resolveExampleId,
  sameHousehold,
  separateRunsLine,
  storedExampleFor,
  summarise,
  withUcWithdrawn,
  writeExampleToLocation,
} from "../../utils/milburn/householdCalculator";
import "../HouseholdCalculator.css";
import "../personal/SingleYear.css";
import "./MilburnHouseholdTab.css";

/** "+£1,158", "−£9,883"; a change that rounds to nothing is "£0". */
export function formatSignedPounds(value) {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : rounded < 0 ? MINUS : ""}${money(Math.abs(rounded))}`;
}
const changeWords = (value) => (Math.round(value) === 0 ? "No change" : formatSignedPounds(value));
const changeClass = (value) => (Math.round(value) > 0 ? "is-gain" : Math.round(value) < 0 ? "is-loss" : "is-zero");

// The form, opened by "Your household", and the tenure choice's "Rent"
const FORM_PANEL_ID = "household-form-panel";
const RENTING = "RENTING";
const MAX_CHILDREN = 6;
const NEW_CHILD_AGE = 5;
const REGIONS = REGION_OPTIONS.map(([value, label]) => ({ value, label }));
const regionName = (value) => REGIONS.find((option) => option.value === value)?.label ?? value;

/**
 * The form's numbered steps, as the Autumn Budget calculator's
 * (HouseholdCalculator's FORM_GROUPS): You and Household open at first, as
 * there, and the two steps the report's runs turn on (work and health) too;
 * Universal Credit starts closed, its line saying the answer once changed.
 */
export const MILBURN_STEPS = [
  { key: "you", title: "You", hint: "Your age and where you live.", open: true, fields: ["age", "region"] },
  {
    key: "household",
    title: "Household",
    hint: "Who lives with you, and your home.",
    open: true,
    fields: ["hasPartner", "childrenCount", "tenure", "partnerAge", "rentFrom", "monthlyRent", "children"],
  },
  {
    key: "work",
    title: "Work and pay",
    hint: `Your paid work in ${FISCAL_YEAR}, and your partner's pay.`,
    open: true,
    fields: ["hours", "pay", "salary", "sector", "partnerSalary"],
  },
  {
    key: "health",
    title: "Health and disability",
    hint: "A health condition that limits work, and Personal Independence Payment (PIP).",
    open: true,
    fields: ["health", "newClaim", "pipDailyLiving", "pipMobility", "partnerHealth", "partnerPipDailyLiving", "partnerPipMobility"],
  },
  {
    key: "benefits",
    title: "Universal Credit",
    hint: "Yes counts the Universal Credit your answers entitle you to.",
    fields: ["claimsUniversalCredit"],
  },
];

const LCWRA_HINT =
  "Assessed as having limited capability for work and work-related activity (LCWRA): the Universal Credit health element.";

// Choices: ChoiceTiles (segmented) unless `select`
const CHOICES = {
  hasPartner: { label: "Partner", options: YES_NO, summary: (v) => (v ? "With a partner" : null) },
  tenure: {
    label: "Housing",
    options: [
      { value: RENTING, label: "Rent" },
      { value: PARENTS, label: "With parents" },
      { value: "OWNED_WITH_MORTGAGE", label: "Mortgage" },
      { value: "OWNED_OUTRIGHT", label: "Own outright" },
    ],
    hint: (answers) =>
      answers.tenure === PARENTS
        ? "Modelled as your own household with no rent: your parents' income and housing costs are left out."
        : undefined,
  },
  rentFrom: {
    label: "Rent from",
    select: true,
    options: [
      { value: "RENT_PRIVATELY", label: "Private landlord" },
      { value: "RENT_FROM_COUNCIL", label: "Council" },
      { value: "RENT_FROM_HA", label: "Housing association" },
    ],
  },
  pay: {
    label: "Pay",
    options: [
      { value: "minimum", label: "Minimum wage" },
      { value: "salary", label: "Enter pay" },
    ],
    hint: (answers) =>
      answers.pay === "minimum" ? `The minimum wage for your age in ${FISCAL_YEAR}, for these hours, all year.` : undefined,
  },
  sector: {
    label: "Sector",
    select: true,
    options: SECTOR_OPTIONS,
    hint: () => "The employer National Insurance run applies to 21 to 24-year-olds in retail and hospitality.",
    hintAs: "tooltip",
  },
  health: { label: "Health condition limiting work-related activity", options: YES_NO, hint: () => LCWRA_HINT, hintAs: "tooltip" },
  newClaim: {
    label: "Health element claimed",
    options: [
      { value: false, label: "Before April 2026" },
      { value: true, label: "From April 2026" },
    ],
    hint: () => "Claims made from April 2026 are paid a lower health element; earlier claims keep the protected rate.",
    hintAs: "tooltip",
  },
  pipDailyLiving: { label: "PIP daily living", options: PIP_OPTIONS },
  pipMobility: { label: "PIP mobility", options: PIP_OPTIONS },
  partnerHealth: { label: "Partner's health condition limiting work-related activity", options: YES_NO, hint: () => LCWRA_HINT, hintAs: "tooltip" },
  partnerPipDailyLiving: { label: "Partner's PIP daily living", options: PIP_OPTIONS },
  partnerPipMobility: { label: "Partner's PIP mobility", options: PIP_OPTIONS },
  claimsUniversalCredit: {
    label: "Universal Credit",
    options: [
      { value: true, label: "Yes" },
      { value: false, label: "No" },
    ],
    hint: () => "Would your household claim Universal Credit if entitled? Yes counts what your answers entitle you to.",
    hintAs: "tooltip",
  },
};

// Number boxes
const NUMBERS = {
  age: { label: "Age", min: 16, max: 100, step: 1, hint: "The report's measures are for under-25s; the PIP removal is for 18 to 24-year-olds." },
  partnerAge: { label: "Partner's age", min: 16, max: 100, step: 1 },
  monthlyRent: { label: "Rent", min: 0, max: 10000, step: 25, money: true, suffix: "a month" },
  hours: { label: "Hours of paid work", min: 0, max: 60, step: 1, suffix: "a week" },
  salary: { label: `Pay in ${FISCAL_YEAR}`, min: 0, max: 200000, step: 500, money: true, suffix: "a year", hint: "Before tax." },
  partnerSalary: { label: `Partner's pay in ${FISCAL_YEAR}`, min: 0, max: 200000, step: 500, money: true, suffix: "a year" },
};

// Shown only when they apply
const APPLIES = {
  partnerAge: (a) => a.hasPartner,
  partnerSalary: (a) => a.hasPartner,
  partnerHealth: (a) => a.hasPartner,
  partnerPipDailyLiving: (a) => a.hasPartner,
  partnerPipMobility: (a) => a.hasPartner,
  rentFrom: (a) => isRentingTenure(a.tenure),
  monthlyRent: (a) => isRentingTenure(a.tenure),
  pay: (a) => a.hours > 0,
  sector: (a) => a.hours > 0,
  salary: (a) => a.hours > 0 && a.pay === "salary",
  newClaim: (a) => a.health,
};

/**
 * A step's line while it is closed: the answers that differ from the
 * typical ones (DEFAULT_ANSWERS), as the Budget calculator's stepSummary.
 */
export function milburnStepSummary(fields, answers) {
  const applies = (id) => !APPLIES[id] || APPLIES[id](answers);
  const parts = [];
  for (const id of fields.filter(applies)) {
    if (id === "children") continue;
    if (id === "childrenCount") {
      const n = answers.childAges.length;
      if (n) parts.push(n === 1 ? "1 child" : `${n} children`);
      continue;
    }
    if (id === "region") {
      if (answers.region !== DEFAULT_ANSWERS.region) parts.push(regionName(answers.region));
      continue;
    }
    if (answers[id] === DEFAULT_ANSWERS[id]) continue;
    if (id === "claimsUniversalCredit") parts.push(answers[id] ? "Claims Universal Credit" : "Does not claim Universal Credit");
    else if (id === "tenure") {
      const value = isRentingTenure(answers.tenure) ? RENTING : answers.tenure;
      parts.push(CHOICES.tenure.options.find((option) => option.value === value)?.label);
    } else if (id === "rentFrom") parts.push(CHOICES.rentFrom.options.find((option) => option.value === answers.tenure)?.label);
    else if (NUMBERS[id]) {
      const config = NUMBERS[id];
      parts.push(`${config.label} ${config.money ? money(answers[id]) : answers[id]}${config.suffix ? ` ${config.suffix}` : ""}`);
    } else if (CHOICES[id]) {
      const chosen = CHOICES[id].options.find((option) => option.value === answers[id]);
      if (chosen) parts.push(`${CHOICES[id].label}: ${chosen.label}`);
    }
  }
  const text = parts.filter(Boolean).join(" · ");
  return { text, changed: text.length > 0 };
}

// The form's last state, kept for the session so switching tabs keeps it
const saved = { answers: null, presetId: null, formOpen: false, stepOpen: {}, submitted: null, startFrom: null, custom: null };

/** Forget the form's saved state (a new session; for tests). */
export function resetSavedMilburnForm() {
  Object.assign(saved, { answers: null, presetId: null, formOpen: false, stepOpen: {}, submitted: null, startFrom: null, custom: null });
}

const IDLE = { status: "idle", results: null, error: null, startingUp: false };

// A part's name, short, for the waterfall's rows: the API's name without
// whom it is for ("PIP removed for 18 to 24-year-olds" is "PIP removed");
// the full name is in the row's tip
const shortPart = (name) => String(name ?? "").replace(/ for (?:under-|\d).*$/, "");

/** Each run's answer, as the Budget calculator's results read one. */
function runViews(results) {
  return Object.fromEntries(RUNS.map((run) => [run.key, normaliseHouseholdImpact(results[run.key])]));
}

/**
 * What the PIP removal's step includes beyond the PIP itself, in one line
 * under the waterfall, or null: its change on its own less the PIP the
 * household loses. A young single renter on PIP daily living is exempt
 * from the shared accommodation rate, so the step can include a fall in
 * Universal Credit's housing element; that is said when the amounts match,
 * any other difference only as other benefits.
 */
export function pipKnockOn(view) {
  const part = (view.byPolicy?.measures ?? []).find((measure) => /\bPIP\b/.test(measure.name ?? ""));
  const pip = (view.programmes ?? []).find((row) => row.id === "pip");
  if (!part || !pip) return null;
  const extra = part.change - pip.change;
  if (Math.round(extra) === 0) return null;
  const uc = (view.programmes ?? []).find((row) => row.id === "universal_credit");
  const housing = uc?.children?.find((child) => child.id === "uc_housing_costs_element")?.change ?? 0;
  const name = shortPart(part.name);
  if (Math.abs(extra - housing) < 1) {
    return `${name} (${formatSignedPounds(part.change)}) includes ${formatSignedPounds(extra)} from Universal Credit's housing element: without PIP daily living, a young single renter is paid the shared accommodation rate.`;
  }
  return `${name} (${formatSignedPounds(part.change)}) includes ${formatSignedPounds(extra)} from changes to other benefits, besides the PIP itself.`;
}

/**
 * The result: the Budget calculator's result card (three tiles, then the
 * waterfall from net income under current law through the package's two
 * removals), with the package's change as "Your change": the one run the
 * report sets out as its package. The separate runs follow, by run.
 */
function ResultCard({ views }) {
  const pkg = views.package;
  const totals = headlineTotals(pkg.net);
  // Each removal by a short name on the bar (the API's full name in its tip)
  const steps = pkg.byPolicy
    ? policyRows(pkg.byPolicy, totals.change, [], YEAR).rows.map((row) => ({ ...row, label: shortPart(row.name) }))
    : null;
  const share = totals.before > 0 ? (totals.change / totals.before) * 100 : null;
  const knockOn = pipKnockOn(pkg);
  return (
    <section className={`card result-card ${changeClass(totals.change)}`} aria-label="Your result">
      <div className="forecast-tiles position-tiles result-tiles">
        <HeadlineTile
          icon={Wallet}
          name="Your change"
          value={<span className="result-change-value">{changeWords(totals.change)}</span>}
          caption="a year, from the health element and PIP removal"
          trend={{ rows: [] }}
          meaning={`In ${FISCAL_YEAR}, with no replacement awards. The separate runs are below.`}
          meaningKind="small"
        />
        <HeadlineTile
          icon={Percent}
          name="Share of your income"
          value={share === null ? "Not available" : `${share > 0 ? "+" : share < 0 ? MINUS : ""}${Math.abs(share).toFixed(2)}%`}
          caption="of your household's net income"
          trend={{ rows: [] }}
          meaning={" "}
          meaningKind="small"
        />
        <HeadlineTile
          icon={UsersRound}
          name="Net income under current law"
          value={money(totals.before)}
          caption={`a year in ${FISCAL_YEAR}`}
          trend={{ rows: [] }}
          meaning="Before housing costs, with no Council Tax"
          meaningKind="small"
        />
      </div>
      <div className="result-card-body">
        <NetIncomeWaterfall
          totals={totals}
          steps={steps}
          yearLabel={FISCAL_YEAR}
          title="How each removal changes your income"
          afterName="With the removals"
          download={{
            name: "household-net-income-by-removal",
            notes: [
              `Your change: ${changeWords(totals.change)} a year in ${FISCAL_YEAR}, from the health element and PIP removal, with no replacement awards`,
              ...(share === null ? [] : [`Share of your income: ${share.toFixed(2)}% of net income under current law (before housing costs, with no Council Tax)`]),
              ...(knockOn ? [knockOn] : []),
            ],
          }}
        />
        {knockOn && (
          <p className="single-year-quiet milburn-waterfall-note" data-note="pip-knock-on">
            {knockOn}
          </p>
        )}
      </div>
    </section>
  );
}

/** Each run's change, as the Budget calculator's change by policy. */
function RunBars({ views }) {
  const rows = RUNS.map((run) => {
    const change = views[run.key].net.change;
    return { id: run.key, name: run.name, color: CHART_COLOURS.noChange, change, rounded: Math.round(change) };
  });
  return (
    <PolicyBars
      rows={rows}
      noEffect={[]}
      yearLabel={FISCAL_YEAR}
      title={`Change in net income by run, ${FISCAL_YEAR}`}
      description="Each run on its own, against current law for the same household."
      rowWord="Run"
    >
      <p className="single-year-quiet milburn-runs-note" role="note">
        The higher Youth Allowance, the work allowance and the employer NI threshold are separate runs: they are not
        added to the health element and PIP removal or to each other. The work allowance is illustrative: the report
        gives no amount, so the amount is our assumption.
      </p>
    </PolicyBars>
  );
}

/**
 * The Household impact tab: the Autumn Budget calculator's flow and parts
 * (its example cards, numbered steps, Calculate, result card, waterfall
 * and breakdown table) for one household under current law and the
 * report's four runs in 2029-30. The eight stored examples answer at once
 * (public/data/milburn_household_presets.json); any other answers are sent
 * with Calculate to the household API, one request for all four runs.
 */
export default function MilburnHouseholdTab({ presets: given = undefined, fetchImpl = undefined }) {
  const [loaded, setLoaded] = useState(given === undefined ? undefined : given);
  useEffect(() => {
    if (given !== undefined) return undefined;
    let cancelled = false;
    loadPresets(fetchImpl).then((data) => {
      if (!cancelled) setLoaded(data);
    });
    return () => {
      cancelled = true;
    };
  }, [given, fetchImpl]);
  const presets = given ?? loaded;
  const examples = useMemo(() => presets?.examples ?? [], [presets]);

  const [answers, setAnswers] = useState(() => ({ ...DEFAULT_ANSWERS, ...saved.answers }));
  // The example the form was last filled from, while its answers stand
  const [presetId, setPresetId] = useState(() => saved.presetId);
  const [formOpen, setFormOpen] = useState(() => saved.formOpen);
  const [startFrom, setStartFrom] = useState(() => saved.startFrom);
  const [stepOpen, setStepOpen] = useState(() => saved.stepOpen);
  // The answers last sent with Calculate (or an example's), and which
  // household they are: an example's id or "yours"
  const [submitted, setSubmitted] = useState(() => saved.submitted);
  const [custom, setCustom] = useState(() => saved.custom ?? IDLE);
  const form = useCollapse(formOpen);
  const narrow = useNarrow("(max-width: 640px)");
  const resultsRef = useRef(null);

  useEffect(() => {
    Object.assign(saved, { answers, presetId, formOpen, startFrom, stepOpen, submitted, custom: custom.status === "loading" ? IDLE : custom });
  }, [answers, presetId, formOpen, startFrom, stepOpen, submitted, custom]);

  // One calculation at a time: a new one aborts the one in flight
  const inFlight = useRef(null);
  useEffect(() => () => inFlight.current?.abort(), []);

  const scrollTo = useRef(null);
  const applyPreset = (example, { scroll = true } = {}) => {
    if (!example) return;
    const next = answersFromHousehold(example.household);
    inFlight.current?.abort();
    setAnswers(next);
    setPresetId(example.id);
    setStartFrom(null);
    setFormOpen(false);
    setSubmitted({ answers: next, household: example.id, at: Date.now() });
    writeExampleToLocation(example.id);
    if (scroll) scrollTo.current = "result";
  };

  // ?example=<slug|1-8> on load, once the examples are in
  const fromAddress = useRef(typeof window === "undefined" ? null : exampleFromLocation(window.location));
  useEffect(() => {
    if (!examples.length || fromAddress.current === null) return;
    const id = resolveExampleId(fromAddress.current, examples);
    fromAddress.current = null;
    if (id) applyPreset(examples.find((example) => example.id === id), { scroll: false });
    // Once, when the examples arrive
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examples]);

  const activePreset = examples.find((example) => example.id === presetId) ?? null;

  const change = (patch) => {
    setPresetId(null);
    writeExampleToLocation(null);
    setAnswers((prev) => ({ ...prev, ...patch }));
  };

  const chooseYours = () => {
    if (presetId === null) {
      if (!formOpen) scrollTo.current = "form";
      setFormOpen((open) => !open);
      return;
    }
    scrollTo.current = "form";
    setStartFrom(activePreset?.title ?? null);
    setPresetId(null);
    setSubmitted(null);
    setFormOpen(true);
    writeExampleToLocation(null);
  };

  const resetAnswers = () => {
    inFlight.current?.abort();
    setAnswers({ ...DEFAULT_ANSWERS });
    setPresetId(null);
    setStartFrom(null);
    setSubmitted(null);
    setCustom(IDLE);
    writeExampleToLocation(null);
  };

  // The answers differ from those of the result shown
  const changed = submitted !== null && !sameHousehold(householdRequest(answers), householdRequest(submitted.answers));
  const shownExample = submitted && submitted.household !== "yours" ? examples.find((example) => example.id === submitted.household) : null;
  const shownResults = shownExample ? shownExample.results : submitted?.household === "yours" && custom.status === "ready" ? custom.results : null;
  const views = useMemo(() => (shownResults ? runViews(shownResults) : null), [shownResults]);
  const running = submitted !== null && !changed && submitted.household === "yours" && custom.status === "loading";

  const calculate = (event) => {
    event?.preventDefault();
    if (running) return;
    scrollTo.current = "result";
    // Answers that are a stored example's, unedited: its result at once
    const stored = storedExampleFor(answers, examples);
    if (stored) {
      inFlight.current?.abort();
      setPresetId(stored.id);
      setSubmitted({ answers, household: stored.id, at: Date.now() });
      writeExampleToLocation(stored.id);
      return;
    }
    setSubmitted({ answers, household: "yours", at: Date.now() });
    if (!customAvailable() || !presets) {
      setCustom({ ...IDLE, status: "unavailable" });
      return;
    }
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    const current = () => inFlight.current === controller && !controller.signal.aborted;
    setCustom({ ...IDLE, status: "loading" });
    calculateHousehold(answers, {
      runs: presets.runs,
      fetchImpl,
      signal: controller.signal,
      onRetry: () => current() && setCustom((state) => ({ ...state, startingUp: true })),
    })
      .then((results) => current() && setCustom({ ...IDLE, status: "ready", results }))
      .catch((error) => current() && setCustom({ ...IDLE, status: "error", error }));
  };

  // Bring the form or the result into view below the sticky bars
  useEffect(() => {
    const target = scrollTo.current;
    if (!target) return undefined;
    scrollTo.current = null;
    const frame = requestAnimationFrame(() => {
      const node = target === "form" ? document.getElementById(FORM_PANEL_ID) : resultsRef.current;
      if (!node) return;
      if (target === "form") node.querySelector("input, select, textarea")?.focus({ preventScroll: true });
      else node.focus({ preventScroll: true });
      scrollBelowBars(node, { behavior: prefersReducedMotion() ? "auto" : "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [formOpen, submitted]);

  const showLoading = useDelayed(running);
  const seconds = useElapsedSeconds(running, submitted?.at ?? null);

  // The cards' figures: each example's package change and its two parts
  const cardPresets = useMemo(
    () =>
      Object.fromEntries(
        examples.map((example) => {
          const summary = summarise(example.results);
          return [example.id, { [YEAR]: { change: summary?.runs[0].change ?? 0, byPolicy: null } }];
        }),
      ),
    [examples],
  );
  const cardExamples = useMemo(
    () => examples.map((example) => ({ ...example, label: example.title, short: example.title, measures: [] })),
    [examples],
  );
  const yoursChange =
    presetId === null && submitted?.household === "yours" && !changed && custom.status === "ready"
      ? custom.results.package.net_income.change
      : null;

  const applies = (id) => !APPLIES[id] || APPLIES[id](answers);
  const childAges = answers.childAges;
  const setChildrenCount = (count) => {
    const ages = childAges.slice(0, count);
    while (ages.length < count) ages.push(NEW_CHILD_AGE);
    change({ childAges: ages, childEducation: ages.map((_, i) => answers.childEducation[i] !== false) });
  };

  const renderChild = (age, index) => (
    <div key={`child_${index}`} className={`household-field household-child ${age >= EDUCATION_AGE ? "has-education" : ""}`.trim()} data-row={`child_${index}`}>
      <div className="child-answers">
        <NumberField
          id={`child_age_${index}`}
          label={`Child ${index + 1}'s age`}
          value={age}
          min={0}
          max={OLDEST_CHILD}
          step={1}
          hint={`Age in ${FISCAL_YEAR}, from 0 to 19.`}
          onChange={(value) => change({ childAges: childAges.map((a, i) => (i === index ? value : a)) })}
        />
        {age >= EDUCATION_AGE && (
          <SelectField
            id={`child_in_education_${index}`}
            label={`Child ${index + 1} in full-time education (non-advanced)`}
            options={YES_NO.slice().reverse()}
            value={answers.childEducation[index] !== false}
            onChange={(value) => change({ childEducation: childAges.map((_, i) => (i === index ? value : answers.childEducation[i] !== false)) })}
            hint="School or college, not university or an apprenticeship. Only then does a 16- to 19-year-old count as a child."
            hintAs="tooltip"
          />
        )}
      </div>
    </div>
  );

  const renderField = (id) => {
    if (!applies(id)) return null;
    if (id === "children") return childAges.map(renderChild);
    let field;
    if (id === "childrenCount") {
      field = (
        <ChoiceTiles
          id="children_count"
          label="Children"
          layout="segmented"
          options={Array.from({ length: MAX_CHILDREN + 1 }, (_, n) => ({ value: n, label: String(n) }))}
          value={childAges.length}
          onChange={setChildrenCount}
        />
      );
    } else if (id === "region") {
      field = <SelectField id="region" label="Region" options={REGIONS} value={answers.region} onChange={(value) => change({ region: value })} />;
    } else if (id === "tenure") {
      const config = CHOICES.tenure;
      const hint = config.hint(answers);
      // Four choices: a select on a phone, where four tiles do not fit
      const Control = narrow ? SelectField : ChoiceTiles;
      field = (
        <Control
          id="tenure"
          label={config.label}
          {...(narrow ? {} : { layout: "segmented" })}
          options={config.options}
          value={isRentingTenure(answers.tenure) ? RENTING : answers.tenure}
          hint={hint}
          hintAs={hintPlace(hint)}
          onChange={(value) => change({ tenure: value !== RENTING ? value : isRentingTenure(answers.tenure) ? answers.tenure : "RENT_PRIVATELY" })}
        />
      );
    } else if (id === "rentFrom") {
      field = <SelectField id="rent_from" label="Rent from" options={CHOICES.rentFrom.options} value={answers.tenure} onChange={(value) => change({ tenure: value })} />;
    } else if (CHOICES[id]) {
      const config = CHOICES[id];
      const hint = config.hint?.(answers);
      const Control = config.select ? SelectField : ChoiceTiles;
      field = (
        <Control
          id={id}
          label={config.label}
          {...(config.select ? {} : { layout: "segmented" })}
          options={config.options}
          value={answers[id]}
          hint={hint}
          hintAs={hintPlace(hint, config.hintAs)}
          onChange={(value) => change({ [id]: value })}
        />
      );
    } else {
      const config = NUMBERS[id];
      field = (
        <div className="number-field-wrap">
          <NumberField id={id} {...config} hintAs={hintPlace(config.hint)} value={answers[id]} onChange={(value) => change({ [id]: value })} />
        </div>
      );
    }
    return (
      <div key={id} className="household-field" data-row={id}>
        {field}
      </div>
    );
  };

  const isStepOpen = (step) => stepOpen[step.key] ?? Boolean(step.open);

  const calculateButton = (
    <button type="submit" className={`calculate-button ${running ? "is-busy" : ""}`} disabled={running} aria-busy={running || undefined}>
      {running ? (
        <>
          <span className="calculate-spinner" aria-hidden="true" />
          Calculating…
        </>
      ) : (
        <>
          Calculate
          <span className="calculate-arrow" aria-hidden="true">
            →
          </span>
        </>
      )}
    </button>
  );
  const resetButton = (
    <button type="button" className="reset-answers-button" onClick={resetAnswers}>
      Reset answers
    </button>
  );

  if (presets === undefined) {
    return (
      <p className="milburn-loading" role="status">
        Loading the examples…
      </p>
    );
  }

  return (
    <div className="household-calculator milburn-household">
      {examples.length > 0 ? (
        <HouseholdCards
          examples={cardExamples}
          value={presetId}
          formOpen={formOpen}
          formId={form.mounted ? FORM_PANEL_ID : undefined}
          onYours={chooseYours}
          onChoose={(id) => applyPreset(examples.find((example) => example.id === id))}
          presets={cardPresets}
          year={YEAR}
          chosen={presetId !== null || formOpen || submitted !== null}
          yoursSelected={presetId === null && (formOpen || submitted !== null)}
          yoursChange={yoursChange}
          yearBars={false}
          positions={false}
          subtitle={`Young people in ${FISCAL_YEAR} under current law and the report's runs. Enter your own household, or start from an example below.`}
          yoursLead="See how the report's runs change your income. A calculation usually takes about 10–15 seconds; after a quiet spell or a busy moment it can take a minute or two."
          figureTip={() => `Change in net income in ${FISCAL_YEAR} from the health element and PIP removal (no replacement awards)`}
          cardExtra={(example) => {
            const summary = summarise(example.results);
            const others = separateRunsLine(summary, formatSignedPounds);
            return (
              <span className="milburn-card-lines">
                <span className="milburn-card-caption">Health element and PIP removal</span>
                <span className={`milburn-card-others${others ? "" : " is-empty"}`} data-others>
                  {others ? `Separate runs: ${others}` : "No change from the separate runs"}
                </span>
              </span>
            );
          }}
        />
      ) : (
        <p className="milburn-note">The stored examples are not available.</p>
      )}
      {activePreset && !formOpen && (
        <p className="household-example-summary" data-example={activePreset.id}>
          <button type="button" className="link-button" onClick={chooseYours}>
            Edit these answers
          </button>
        </p>
      )}
      <div className="household-layout">
        {form.mounted && (
          <div id={FORM_PANEL_ID} className={`expander-body household-form-panel ${form.expanded ? "is-expanded" : ""}`} data-open={formOpen}>
            <div className="expander-inner">
              <form className="card household-form" onSubmit={calculate} noValidate aria-label="Your household">
                <div className="household-form-header">
                  <div className="household-form-title">
                    <h2>
                      <TitleIcon name="house" />
                      Your household
                    </h2>
                    <p>Every answer starts at a typical value for a young person. Change any of them, then press Calculate.</p>
                    {startFrom && (
                      <p className="household-start-from">
                        Starting from: <strong>{startFrom}</strong>. Change anything, then Calculate.
                      </p>
                    )}
                  </div>
                  {!narrow && (
                    <div className="household-header-actions">
                      {resetButton}
                      {calculateButton}
                    </div>
                  )}
                </div>
                {MILBURN_STEPS.map((step, index) => (
                  <StepGroup
                    key={step.key}
                    group={step}
                    number={index + 1}
                    last={index === MILBURN_STEPS.length - 1}
                    open={isStepOpen(step)}
                    onToggle={() => setStepOpen((prev) => ({ ...prev, [step.key]: !isStepOpen(step) }))}
                    summary={milburnStepSummary(step.fields, answers)}
                  >
                    {step.fields.map((id) => renderField(id))}
                  </StepGroup>
                ))}
                {narrow && (
                  <div className="household-form-footer">
                    {resetButton}
                    {calculateButton}
                  </div>
                )}
              </form>
            </div>
          </div>
        )}

        {submitted !== null && changed && (
          <p className="household-results-stale" role="status">
            Your answers have changed. Press Calculate to see the new result.
          </p>
        )}
        {submitted !== null && !changed && (
          <div className="household-results" role="region" aria-label="Results" ref={resultsRef} tabIndex={-1}>
            {running ? (
              <div className="single-year-headline" aria-busy="true">
                <div className="card processing-card">
                  {(showLoading || custom.startingUp) && <ProcessingPanel seconds={seconds} startingUp={custom.startingUp} times={CALCULATION_TIMES} startingUpText={STARTING_UP_TEXT} />}
                </div>
              </div>
            ) : submitted.household === "yours" && custom.status === "unavailable" ? (
              <UnavailableNotice reason="Custom households are not available yet">
                <p>This build has no household calculator. The stored examples above are available.</p>
              </UnavailableNotice>
            ) : submitted.household === "yours" && custom.status === "error" ? (
              <SingleYearError error={custom.error} onRetry={() => calculate()} />
            ) : views ? (
              <div className="single-year-headline">
                <div className="single-year-result">
                  <SectionHeading
                    icon="wallet"
                    id="your-result"
                    title={`Your result, ${FISCAL_YEAR}`}
                    subtitle={
                      shownExample
                        ? `${shownExample.title}: ${shownExample.description}`
                        : "How the health element and PIP removal changes your net income, removal by removal."
                    }
                  />
                  <ResultCard views={views} />
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {views && submitted !== null && !changed && !running && <ResultDetails views={views} presets={presets} />}
    </div>
  );
}

/** The separate runs, then the breakdown by programme, run by run. */
function ResultDetails({ views, presets }) {
  const [run, setRun] = useState(RUNS[0].key);
  const view = views[run];
  const chosen = RUNS.find((item) => item.key === run);
  return (
    <div className="single-year-details milburn-household-details">
      <SectionHeading icon="bars" title="Change by run" subtitle="Each of the report's runs on its own, against current law for the same household." />
      <section className="report-section" id="change-by-run">
        <RunBars views={views} />
      </section>
      <section className="report-section" id="household-breakdown">
        <ProgrammeTable
          programmes={withUcWithdrawn(view.programmes)}
          totals={headlineTotals(view.net)}
          yearLabel={FISCAL_YEAR}
          year={YEAR}
          policies={[]}
          parameterTables={null}
          afterLabel={`Under the ${chosen.kind === "package" ? "removals" : "run"}`}
          runTabs={{ tabs: RUNS.map((item) => ({ id: item.key, label: item.tab })), value: run, onChange: setRun, label: "Run" }}
          // Universal Credit's elements and PIP's parts in view at first
          openRows={["universal_credit", "pip"]}
          // The Milburn Methodology has no household calculation section
          method={null}
        />
      </section>
      <Disclosure title="About these figures" preview="How they are calculated · What each run is" className="milburn-household-about">
        <div className="info-sections">
          <p className="info-text">
            {presets.label}
            {presets.build ? ` (${presets.build})` : ""}. Household calculations with no survey data. Amounts are pounds a
            year, before housing costs. Council Tax and Council Tax Reduction are left out for every household, renters
            included.
          </p>
          <ul className="info-list">
            {RUNS.map((item) => (
              <li key={item.key}>
                <strong>{item.name}.</strong> {presets.runDescriptions[item.key]}
              </li>
            ))}
            {presets.assumptions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </Disclosure>
    </div>
  );
}
