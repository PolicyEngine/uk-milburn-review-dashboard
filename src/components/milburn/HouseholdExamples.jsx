import { useEffect, useState } from "react";
import SectionHeading from "../SectionHeading";
import "./HouseholdExamples.css";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Written by scripts/milburn_household_examples.py. */
export const HOUSEHOLDS_FILE = "milburn_households.json";
export const HOUSEHOLDS_TITLE = "Household examples";
/** Said of every figure on the card when the file carries no label of its own. */
export const HOUSEHOLDS_LABEL = "PolicyEngine household calculation, 2029-30";

const pounds = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const strings = (list) => (Array.isArray(list) ? list.filter((item) => typeof item === "string" && item) : []);

/** "£14,247" */
export function formatPounds(value) {
  return `£${pounds.format(Math.round(Math.abs(value)))}`;
}

/** "+£1,158", "−£9,883"; a change that rounds to nothing is "£0". */
export function formatSignedPounds(value) {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}£${pounds.format(Math.abs(rounded))}`;
}

function parseRun(run) {
  if (!run || typeof run.applies !== "boolean" || !isNumber(run.net_income_change)) return null;
  const lines = Array.isArray(run.breakdown)
    ? // A line that rounds to no pounds is rounding, not a change: never shown as "£0"
      run.breakdown.filter((line) => line && typeof line.label === "string" && isNumber(line.change) && Math.round(line.change) !== 0)
    : [];
  return { applies: run.applies, change: run.net_income_change, lines };
}

/**
 * The file, checked: null unless it names its package run and has at least
 * one household with a current-law net income and that run's change. A
 * household or run missing a figure is dropped, never read as zero.
 */
export function parseHouseholds(json) {
  if (!json || typeof json !== "object" || typeof json.package_id !== "string") return null;
  // The runs outside the package (the file marks the package and its parts: their
  // effect is the package's own breakdown, so they are not listed again)
  const separateRuns = (Array.isArray(json.runs) ? json.runs : []).filter(
    (run) => run && typeof run.id === "string" && typeof run.name === "string" && run.part_of_package === false,
  );
  const households = (Array.isArray(json.households) ? json.households : [])
    .map((household) => {
      if (!household || typeof household.id !== "string" || typeof household.title !== "string") return null;
      const netIncome = household.current_law?.net_income;
      const packageRun = parseRun(household.runs?.[json.package_id]);
      if (!isNumber(netIncome) || !packageRun) return null;
      // The runs outside the package that change this household, in the file's order
      const otherRuns = separateRuns
        .filter(({ id }) => id !== json.package_id)
        .map(({ id, name }) => ({ id, name, ...parseRun(household.runs?.[id]) }))
        .filter((run) => run.applies === true);
      return {
        id: household.id,
        title: household.title,
        description: typeof household.description === "string" ? household.description : "",
        netIncome,
        packageRun,
        otherRuns,
        notes: strings(household.notes),
      };
    })
    .filter(Boolean);
  if (!households.length) return null;
  return {
    label: typeof json.label === "string" && json.label ? json.label : HOUSEHOLDS_LABEL,
    basis: typeof json.basis === "string" ? json.basis : "",
    assumptions: strings(json.assumptions),
    households,
  };
}

function useHouseholds() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${BASE}/data/${HOUSEHOLDS_FILE}`, { cache: "no-cache" })
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        if (!cancelled) setData(parseHouseholds(json));
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return data;
}

const direction = (value) => (Math.round(value) > 0 ? "is-gain" : Math.round(value) < 0 ? "is-loss" : "is-none");

function Lines({ lines }) {
  if (!lines.length) return null;
  return (
    <ul className="hh-lines">
      {lines.map((line) => (
        <li key={line.label}>
          <span>{line.label}</span>
          <span className={`hh-amount ${direction(line.change)}`}>{formatSignedPounds(line.change)}</span>
        </li>
      ))}
    </ul>
  );
}

function HouseholdCard({ household }) {
  const { packageRun, otherRuns } = household;
  return (
    <li className="hh-card" data-household={household.id}>
      <h3 className="hh-card-title">{household.title}</h3>
      {household.description && <p className="hh-card-who">{household.description}</p>}
      <p className="hh-card-baseline">
        <span>Net income under current law, before housing costs</span>
        <strong>{formatPounds(household.netIncome)} a year</strong>
      </p>
      <div className="hh-card-package">
        <p className="hh-card-caption">Under the report&rsquo;s package</p>
        {packageRun.applies ? (
          <p className={`hh-card-change ${direction(packageRun.change)}`}>
            {formatSignedPounds(packageRun.change)} <span>a year</span>
          </p>
        ) : (
          <p className="hh-card-change is-none">No change</p>
        )}
        <Lines lines={packageRun.lines} />
      </div>
      {otherRuns.length > 0 && (
        <div className="hh-card-others">
          <p className="hh-card-caption">Separate runs, not in the package</p>
          {otherRuns.map((run) => (
            <div key={run.id} className="hh-run" data-run={run.id}>
              <p className="hh-run-head">
                <span>{run.name}</span>
                <strong className={`hh-amount ${direction(run.change)}`}>{formatSignedPounds(run.change)}</strong>
              </p>
              {/* One line is the run's own change again: shown only when there is more than one */}
              {run.lines.length > 1 && <Lines lines={run.lines} />}
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

/**
 * Typical young people under current law and under the report's runs, one
 * mini-card each, from public/data/milburn_households.json (exact household
 * calculations, no survey data). Nothing is shown until the file is read,
 * or when it is missing or fails its checks.
 */
export default function HouseholdExamples({ data: given }) {
  const fetched = useHouseholds();
  const data = given ?? fetched;
  if (!data) return null;
  const notes = data.households.filter((household) => household.notes.length > 0);
  return (
    <section id="household-examples" aria-label={HOUSEHOLDS_TITLE}>
      <SectionHeading
        icon="users"
        title={HOUSEHOLDS_TITLE}
        subtitle="Typical young people under current law and under the report's measures, by exact household calculation."
      />
      <div className="report-section hh-examples">
        <ul className="hh-cards">
          {data.households.map((household) => (
            <HouseholdCard key={household.id} household={household} />
          ))}
        </ul>
        <p className="hh-label">{data.label}. Amounts are pounds a year, compared with current law.</p>
        <details className="hh-more">
          <summary>More info</summary>
          {data.basis && <p>{data.basis}</p>}
          {data.assumptions.length > 0 && (
            <ul>
              {data.assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
          )}
          {notes.map((household) => (
            <div key={household.id}>
              <h4>{household.title}</h4>
              <ul>
                {household.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ))}
        </details>
      </div>
    </section>
  );
}
