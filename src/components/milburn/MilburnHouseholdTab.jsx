import { useEffect, useMemo, useRef, useState } from "react";
import { Armchair, Baby, BriefcaseBusiness, GraduationCap, HardHat, House, KeyRound, PencilLine, UsersRound } from "lucide-react";
import SectionHeading from "../SectionHeading";
import { ChoiceTiles, NumberField, SelectField } from "../personal/FormControls";
import {
  DEFAULT_ANSWERS,
  FISCAL_YEAR,
  KIND_LABELS,
  PIP_OPTIONS,
  RUNS,
  SECTOR_OPTIONS,
  answersFromHousehold,
  calculateHousehold,
  customAvailable,
  exampleFromLocation,
  loadPresets,
  programmeRows,
  resolveExampleId,
  separateRunsLine,
  summarise,
  writeExampleToLocation,
} from "../../utils/milburn/householdCalculator";
import "../HouseholdCalculator.css";
import "./MilburnHouseholdTab.css";

const ICONS = { house: House, key: KeyRound, armchair: Armchair, graduate: GraduationCap, family: UsersRound, briefcase: BriefcaseBusiness, hardHat: HardHat, baby: Baby };
const CUSTOM = "custom";

const REGION_OPTIONS = [
  ["NORTH_EAST", "North East"],
  ["NORTH_WEST", "North West"],
  ["YORKSHIRE", "Yorkshire and the Humber"],
  ["EAST_MIDLANDS", "East Midlands"],
  ["WEST_MIDLANDS", "West Midlands"],
  ["EAST_OF_ENGLAND", "East of England"],
  ["LONDON", "London"],
  ["SOUTH_EAST", "South East"],
  ["SOUTH_WEST", "South West"],
  ["WALES", "Wales"],
  ["SCOTLAND", "Scotland"],
  ["NORTHERN_IRELAND", "Northern Ireland"],
].map(([value, label]) => ({ value, label }));

const pounds = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
/** "£14,247" */
export const formatPounds = (value) => `£${pounds.format(Math.round(Math.abs(value)))}`;
/** "+£1,158", "−£9,883"; a change that rounds to nothing is "£0". */
export function formatSignedPounds(value) {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}£${pounds.format(Math.abs(rounded))}`;
}
const tone = (value) => (Math.round(value) > 0 ? "is-gain" : Math.round(value) < 0 ? "is-loss" : "is-none");
const changeText = (value) => (Math.round(value) === 0 ? "No change" : formatSignedPounds(value));

const YES_NO = [
  { value: false, label: "No" },
  { value: true, label: "Yes" },
];

/** One card per stored example, then "Your household". */
function ExampleCards({ examples, value, onChoose, onCustom }) {
  return (
    <div className="household-cards-grid milburn-household-grid" role="group" aria-label="Example households">
      {examples.map((example, index) => {
        const Icon = ICONS[example.icon] ?? House;
        const summary = summarise(example.results);
        const change = summary?.runs[0].change ?? 0;
        const others = separateRunsLine(summary, formatSignedPounds);
        const pressed = value === example.id;
        return (
          <div key={example.id} className={`household-card ${pressed ? "is-selected" : ""}`.trim()} style={{ "--i": index + 1 }} data-example={example.id}>
            <span className="household-card-icon" aria-hidden="true">
              <Icon size={22} strokeWidth={1.8} />
            </span>
            <button
              type="button"
              className="household-card-hit"
              aria-pressed={pressed}
              aria-describedby={`milburn-card-${example.id}-description`}
              onClick={() => onChoose(example.id)}
            >
              <span className="household-card-name">{example.title}</span>
            </button>
            <span className="household-card-result">
              <span className={`household-card-figure ${tone(change)}`}>
                {changeText(change)}
                {Math.round(change) !== 0 && <span className="household-card-figure-unit"> a year</span>}
              </span>
              <span className="milburn-card-caption">Under the health element and PIP removal</span>
            </span>
            {/* Always there, so every card keeps the same height */}
            <span className={`milburn-card-others${others ? "" : " is-empty"}`} data-others>
              {others ? `Separate runs: ${others}` : "No change from the separate runs"}
            </span>
            <span className="household-card-description" id={`milburn-card-${example.id}-description`}>
              {example.description}
            </span>
          </div>
        );
      })}
      <div className={`household-card milburn-custom-card ${value === CUSTOM ? "is-selected" : ""}`.trim()} style={{ "--i": examples.length + 1 }}>
        <span className="household-card-icon" aria-hidden="true">
          <PencilLine size={22} strokeWidth={1.8} />
        </span>
        <button type="button" className="household-card-hit" aria-pressed={value === CUSTOM} onClick={onCustom}>
          <span className="household-card-name">Your household</span>
        </button>
        <span className="household-card-description">Enter your own answers, or change an example&rsquo;s.</span>
      </div>
    </div>
  );
}

/** The form: the answers the report's runs read. */
function HouseholdForm({ answers, onChange }) {
  const set = (key) => (value) => onChange({ ...answers, [key]: value });
  const working = answers.hours > 0;
  return (
    <div className="milburn-form">
      <fieldset>
        <legend>You</legend>
        <NumberField id="milburn-age" label="Age" value={answers.age} onChange={set("age")} min={16} max={100} step={1} hint="The report's measures are for under-25s; PIP changes are for 18 to 24-year-olds." />
        <SelectField id="milburn-region" label="Region" options={REGION_OPTIONS} value={answers.region} onChange={set("region")} />
        <ChoiceTiles
          id="milburn-home"
          label="Where you live"
          options={[
            { value: "renting", label: "Renting" },
            { value: "parents", label: "With parents" },
          ]}
          value={answers.home}
          onChange={set("home")}
          hint={answers.home === "parents" ? "Modelled as your own household with no rent: your parents' income and housing costs are left out." : undefined}
        />
        {answers.home === "renting" && (
          <NumberField id="milburn-rent" label="Rent a month" value={answers.monthlyRent} onChange={set("monthlyRent")} min={0} max={10000} step={25} money />
        )}
      </fieldset>
      <fieldset>
        <legend>Household</legend>
        <ChoiceTiles id="milburn-partner" label="Partner" options={YES_NO} value={answers.hasPartner} onChange={set("hasPartner")} />
        {answers.hasPartner && (
          <>
            <NumberField id="milburn-partner-age" label="Partner's age" value={answers.partnerAge} onChange={set("partnerAge")} min={16} max={100} step={1} />
            <ChoiceTiles id="milburn-partner-health" label="Partner has limited capability for work-related activity" options={YES_NO} value={answers.partnerHealth} onChange={set("partnerHealth")} />
          </>
        )}
        <NumberField
          id="milburn-children"
          label="Children"
          value={answers.childAges.length}
          onChange={(count) => onChange({ ...answers, childAges: Array.from({ length: count }, (_, i) => answers.childAges[i] ?? 1) })}
          min={0}
          max={4}
          step={1}
        />
        {answers.childAges.map((age, index) => (
          <NumberField
            key={index}
            id={`milburn-child-${index}`}
            label={`Child ${index + 1}'s age`}
            value={age}
            onChange={(value) => onChange({ ...answers, childAges: answers.childAges.map((old, i) => (i === index ? value : old)) })}
            min={0}
            max={15}
            step={1}
          />
        ))}
      </fieldset>
      <fieldset>
        <legend>Health and benefits</legend>
        <ChoiceTiles id="milburn-uc" label="Claims Universal Credit" options={YES_NO} value={answers.claimsUniversalCredit} onChange={set("claimsUniversalCredit")} />
        <ChoiceTiles
          id="milburn-health"
          label="Limited capability for work-related activity"
          options={YES_NO}
          value={answers.health}
          onChange={set("health")}
          hint="Assessed as having limited capability for work and work-related activity: the Universal Credit health element."
        />
        {answers.health && (
          <ChoiceTiles
            id="milburn-claim"
            label="Health element claim"
            options={[
              { value: false, label: "Before April 2026" },
              { value: true, label: "From April 2026" },
            ]}
            value={answers.newClaim}
            onChange={set("newClaim")}
            hint="Claims made from April 2026 are paid a lower health element; earlier claims keep the protected rate."
          />
        )}
        <ChoiceTiles id="milburn-pip-dl" label="PIP daily living" options={PIP_OPTIONS} value={answers.pipDailyLiving} onChange={set("pipDailyLiving")} />
        <ChoiceTiles id="milburn-pip-m" label="PIP mobility" options={PIP_OPTIONS} value={answers.pipMobility} onChange={set("pipMobility")} />
      </fieldset>
      <fieldset>
        <legend>Work</legend>
        <NumberField id="milburn-hours" label="Hours of paid work a week" value={answers.hours} onChange={set("hours")} min={0} max={60} step={1} />
        {working && (
          <>
            <ChoiceTiles
              id="milburn-pay"
              label="Pay"
              options={[
                { value: "minimum", label: "Minimum wage" },
                { value: "salary", label: "Enter pay" },
              ]}
              value={answers.pay}
              onChange={set("pay")}
              hint={answers.pay === "minimum" ? `The minimum wage for your age in ${FISCAL_YEAR}, for these hours, all year.` : undefined}
            />
            {answers.pay === "salary" && (
              <NumberField id="milburn-salary" label={`Pay a year before tax, ${FISCAL_YEAR}`} value={answers.salary} onChange={set("salary")} min={0} max={200000} step={500} money />
            )}
            <ChoiceTiles id="milburn-sector" label="Sector" options={SECTOR_OPTIONS} value={answers.sector} onChange={set("sector")} hint="The employer National Insurance run applies to 21 to 24-year-olds in retail and hospitality." />
          </>
        )}
      </fieldset>
    </div>
  );
}

/** Each run's change, the package with its two parts. */
function RunSummary({ summary }) {
  return (
    <section className="milburn-runs" aria-label="Change in net income by run">
      <p className="milburn-baseline">
        <span>Net income under current law, {FISCAL_YEAR}</span>
        <strong>{formatPounds(summary.netIncome)} a year</strong>
      </p>
      <ul className="milburn-run-list">
        {summary.runs.map((run) => (
          <li key={run.key} className={`milburn-run is-${run.kind}`} data-run={run.key}>
            <div className="milburn-run-head">
              <span className="milburn-run-name">
                {run.name}
                <span className="milburn-run-kind">{KIND_LABELS[run.kind]}</span>
              </span>
              <strong className={`milburn-amount ${tone(run.change)}`}>{changeText(run.change)}</strong>
            </div>
            {run.parts.length > 1 && (
              <ul className="milburn-run-parts">
                {run.parts.map((part) => (
                  <li key={part.id}>
                    <span>{part.name} on its own</span>
                    <span className={`milburn-amount ${tone(part.change)}`}>{changeText(part.change)}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <p className="milburn-note">
        Each run is compared with current law for the same household. The three separate runs are not added to the package or to each other.
      </p>
    </section>
  );
}

/** The programmes under current law and one run, with the change. */
function ProgrammeBreakdown({ results }) {
  const [chosen, setChosen] = useState(RUNS[0].key);
  const result = results[chosen];
  const rows = programmeRows(result);
  const row = (item, child = false) => (
    <tr key={item.id} className={child ? "is-child" : undefined}>
      <th scope="row">{item.label}</th>
      <td>{item.signed ? formatSignedPounds(item.baseline) : formatPounds(item.baseline)}</td>
      <td>{item.signed ? formatSignedPounds(item.reform) : formatPounds(item.reform)}</td>
      <td className={`milburn-amount ${tone(item.change)}`}>{changeText(item.change)}</td>
    </tr>
  );
  return (
    <section className="milburn-breakdown" aria-label="Breakdown by programme">
      <div className="milburn-breakdown-tabs" role="tablist" aria-label="Run">
        {RUNS.map((run) => (
          <button key={run.key} type="button" role="tab" aria-selected={chosen === run.key} className={chosen === run.key ? "is-active" : ""} onClick={() => setChosen(run.key)}>
            {run.name}
          </button>
        ))}
      </div>
      <div className="milburn-table-wrap">
        <table className="milburn-table">
          <caption className="visually-hidden">Income, taxes and benefits under current law and under {RUNS.find((run) => run.key === chosen).inSentence}, {FISCAL_YEAR}</caption>
          <thead>
            <tr>
              <th scope="col">Programme</th>
              <th scope="col">Current law</th>
              <th scope="col">Under the run</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => [row(item), ...item.children.map((childRow) => row(childRow, true))])}
            <tr className="is-total">
              <th scope="row">Net income</th>
              <td>{formatPounds(result.net_income.baseline)}</td>
              <td>{formatPounds(result.net_income.reform)}</td>
              <td className={`milburn-amount ${tone(result.net_income.change)}`}>{changeText(result.net_income.change)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="milburn-note">
        Amounts are pounds a year. Rows the run does not change are left out, other than Universal Credit, PIP and pay. Taxes are shown as amounts paid. Universal Credit&rsquo;s elements are before the earnings taper. The employer
        National Insurance run shows as higher pay: the model passes the employer&rsquo;s saving to wages.
      </p>
    </section>
  );
}

/**
 * The Household impact tab: eight stored young people (precomputed, no API)
 * and a custom household (the household API), each under current law and
 * the report's four runs in 2029-30.
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
  const [chosen, setChosen] = useState(() => (typeof window === "undefined" ? null : exampleFromLocation(window.location)));
  const [answers, setAnswers] = useState(DEFAULT_ANSWERS);
  const [custom, setCustom] = useState({ status: "idle", results: null, error: null });
  const examples = useMemo(() => presets?.examples ?? [], [presets]);
  // A slug or a number from 1 to 8 (resolveExampleId)
  const chosenId = chosen === CUSTOM ? CUSTOM : resolveExampleId(chosen, examples);
  const example = examples.find((item) => item.id === chosenId) ?? null;
  // An unknown example in the address opens the first one
  const value = chosen === CUSTOM ? CUSTOM : (example?.id ?? examples[0]?.id ?? CUSTOM);
  const shown = value === CUSTOM ? custom.results : (example ?? examples[0])?.results;
  const summary = shown ? summarise(shown) : null;
  // Choosing "Your household" brings its form into view (not on load)
  const formRef = useRef(null);
  const scrollToForm = useRef(false);
  useEffect(() => {
    if (!scrollToForm.current || chosen !== CUSTOM) return;
    scrollToForm.current = false;
    formRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [chosen]);
  const choose = (id) => {
    setChosen(id);
    writeExampleToLocation(id);
    scrollToForm.current = id === CUSTOM;
  };
  const editExample = () => {
    const from = example ?? examples[0];
    changeAnswers(from ? answersFromHousehold(from.household) : answers);
    choose(CUSTOM);
  };
  // One calculation at a time: a new one, or an edited answer, aborts the
  // one in flight, and its answer (or error) is never shown
  const inFlight = useRef(null);
  useEffect(() => () => inFlight.current?.abort(), []);
  const changeAnswers = (next) => {
    inFlight.current?.abort();
    inFlight.current = null;
    setAnswers(next);
    setCustom({ status: "idle", results: null, error: null });
  };
  const calculate = () => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    const current = () => inFlight.current === controller && !controller.signal.aborted;
    setCustom({ status: "loading", results: null, error: null, startingUp: false });
    calculateHousehold(answers, {
      runs: presets?.runs,
      fetchImpl,
      signal: controller.signal,
      onRetry: () => current() && setCustom((state) => ({ ...state, startingUp: true })),
    })
      .then((results) => current() && setCustom({ status: "ready", results, error: null }))
      .catch((error) => current() && setCustom({ status: "error", results: null, error: error.message }));
  };
  if (presets === undefined) return <p className="milburn-loading" role="status">Loading the examples…</p>;
  return (
    <div className="results-container milburn-household">
      <section className="household-cards" aria-label="Choose a household">
        <SectionHeading icon="users" title="Choose a household" subtitle={`Young people in ${FISCAL_YEAR} under current law and under the report's runs, by exact household calculation.`} />
        {examples.length > 0 ? (
          <ExampleCards examples={examples} value={value} onChoose={choose} onCustom={() => choose(CUSTOM)} />
        ) : (
          <p className="milburn-note">The stored examples are not available.</p>
        )}
      </section>

      {value === CUSTOM && (
        <section ref={formRef} className="report-section milburn-custom" aria-label="Your household" id="milburn-household-form">
          <HouseholdForm answers={answers} onChange={changeAnswers} />
          {customAvailable() && presets ? (
            <div className="milburn-actions">
              <button type="button" className="milburn-calculate" onClick={calculate} disabled={custom.status === "loading"}>
                {custom.status === "loading" ? "Calculating…" : "Calculate"}
              </button>
              {custom.status === "loading" && (
                <span role="status">
                  {custom.startingUp ? "The calculator is starting up; this can take up to a minute." : "Calculating the four runs…"}
                </span>
              )}
              {custom.status === "error" && <span role="alert" className="milburn-error">{custom.error}</span>}
            </div>
          ) : (
            <p className="milburn-note" role="note">
              Custom households are not available yet. The stored examples above are.
            </p>
          )}
        </section>
      )}

      {summary && (
        <>
          <SectionHeading
            icon="calculator"
            title="Change in net income"
            subtitle={value === CUSTOM ? "Your household under each of the report's runs." : `${(example ?? examples[0]).title}: ${(example ?? examples[0]).description}`}
          />
          {value !== CUSTOM && (
            <p className="milburn-edit">
              <button type="button" className="milburn-link-button" onClick={editExample}>
                Change these answers
              </button>
            </p>
          )}
          <div className="report-section">
            <RunSummary summary={summary} />
          </div>
          <SectionHeading icon="list" title="Breakdown by programme" subtitle="Each programme under current law and under the run chosen." />
          <div className="report-section">
            <ProgrammeBreakdown results={shown} />
          </div>
        </>
      )}

      {presets && (
        <details className="milburn-more">
          <summary>About these figures</summary>
          <p>
            {presets.label}
            {presets.build ? ` (${presets.build})` : ""}. Household calculations with no survey data. Amounts are pounds a year, before housing costs.
            Council Tax and Council Tax Reduction are left out for every household, renters included.
          </p>
          <ul>
            {RUNS.map((run) => (
              <li key={run.key}>
                <strong>{run.name}.</strong> {presets.runDescriptions[run.key]}
              </li>
            ))}
            {presets.assumptions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
