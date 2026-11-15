import { useEffect, useState } from "react";
import SectionHeading from "../SectionHeading";
import { fiscalYearTick } from "../../utils/chartTheme";
import { useMeasureCatalogue } from "../../utils/measureCatalogue";
import { HOURS_CASES, SCENARIOS_FILE, parseScenarios } from "../../utils/milburn/scenarios";
import {
  BREAK_EVEN_HOURS,
  DEFAULT_SUMMARY_RUN,
  ENTRY_RUN,
  breakEvenText,
  formatBn,
  formatPeople,
  formatPounds,
  formatSignedPp,
  savingInYear,
  summaryRun,
  useMilburnSummary,
} from "../../utils/milburn/summary";
import { shortNameOf } from "../../utils/policyDetails";
import "./milburn.css";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** The label the sub-tab carries. */
export const SCENARIOS_LABEL =
  "The move into work is an assumption: a quarter of the young people the package leaves worse off, microsimulated. The figures elsewhere are static.";

const pounds = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
const penceExact = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The scenarios file: { status: "loading"|"ready"|"unavailable", data }. */
function useScenariosFile() {
  const [state, setState] = useState({ status: "loading", data: null });
  useEffect(() => {
    let cancelled = false;
    fetch(`${BASE}/data/${SCENARIOS_FILE}`, { cache: "no-cache" })
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        const data = parseScenarios(json);
        if (!cancelled) setState({ status: data ? "ready" : "unavailable", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "unavailable", data: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

/** The gain from work is the same with and without the package: said wherever the arithmetic is. */
export const SAME_GAIN_SENTENCE =
  "The gain from moving into work is the same under current law and under the package, so this is arithmetic about how far work could offset the loss, not an incentive the reform creates.";

/** Why the move into work changes the public finances so little. */
export const SMALL_FISCAL_EFFECT_SENTENCE =
  "Many young PIP recipients are not on Universal Credit, because they live with their parents or already work, and the young people in losing households include siblings and partners. So moving into work recovers little benefit spending, and the effect on the public finances is small.";

/** "+0.59pp (about 410,000 people)": the change and its count, either left out when missing. */
function povertyText(run) {
  const pp = run.povertyPp.abs_ahc;
  const count = run.peopleIntoPovertyAbsAhc;
  if (pp === null && count === null) return "Not in the summary";
  const people = count !== null ? `about ${formatPeople(count)} people` : "";
  if (pp === null) return people;
  return people ? `${formatSignedPp(pp)} (${people})` : formatSignedPp(pp);
}

/**
 * The lead: the full abolition package as a static run beside the same
 * package with a quarter of the young people it leaves worse off moving
 * into work, microsimulated, from milburn_summary.json.
 */
export function EntryComparison({ summary, catalogue }) {
  const full = summaryRun(summary, DEFAULT_SUMMARY_RUN);
  const entry = summaryRun(summary, ENTRY_RUN);
  const yearLabel = fiscalYearTick(summary.year);
  if (!full || !entry) {
    return <p role="status">Not yet run: the comparison appears here once both national runs have finished.</p>;
  }
  const fullMeasure = catalogue?.byId?.get(DEFAULT_SUMMARY_RUN);
  const fullName = fullMeasure ? shortNameOf(fullMeasure) : DEFAULT_SUMMARY_RUN;
  const fullSaving = savingInYear(full, summary.year);
  const entrySaving = savingInYear(entry, summary.year);
  const rows = [
    { key: "saving", label: `Exchequer saving, ${yearLabel}`, full: formatBn(fullSaving), entry: formatBn(entrySaving) },
    { key: "poverty", label: "Absolute poverty after housing costs, all ages", full: povertyText(full), entry: povertyText(entry) },
    {
      key: "loss",
      label: "Average loss, young people in losing households (£ a year)",
      full: formatPounds(full.averageLossYoung),
      entry: formatPounds(entry.averageLossYoung),
    },
  ];
  return (
    <section className="report-section milburn-entry" aria-labelledby="milburn-entry-heading">
      <h3 id="milburn-entry-heading">With a quarter moving into work</h3>
      <p>
        {fullName}, {yearLabel}: the static run, and the same package with 25% of the young people aged 16 to 24 it
        leaves worse off moving into work, microsimulated.
      </p>
      <div className="milburn-table-wrap">
        <table className="milburn-table">
          <thead>
            <tr>
              <th scope="col">Figure</th>
              <th scope="col">Static package</th>
              <th scope="col">With 25% moving into work</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} data-row={row.key}>
                <th scope="row">{row.label}</th>
                <td>{row.full || "Not in the summary"}</td>
                <td>{row.entry || "Not in the summary"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {fullSaving !== null && entrySaving !== null && (
        <p data-entry-run-comparison="">
          The move into work {entrySaving >= fullSaving ? "adds" : "takes"} {formatBn(Math.abs(entrySaving - fullSaving))}{" "}
          {entrySaving >= fullSaving ? "to" : "from"} the Exchequer. {SMALL_FISCAL_EFFECT_SENTENCE}
        </p>
      )}
    </section>
  );
}

/** The household entry cases from milburn_scenarios.json, one row per hours case. */
function EntryCases({ data }) {
  const cases = HOURS_CASES.map((option) => data.entryCases.find((entry) => entry.id === option.id)).filter(Boolean);
  return (
    <section className="report-section milburn-notes" aria-labelledby="milburn-cases-heading">
      <h3 id="milburn-cases-heading">One young person moving into work</h3>
      <div className="milburn-table-wrap">
        <table className="milburn-table">
          <thead>
            <tr>
              <th scope="col">Hours a week</th>
              <th scope="col">Hourly wage</th>
              <th scope="col">Net income gain, £ a year (current law; package)</th>
              <th scope="col">Exchequer gain, £ a year (current law; package)</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((entry) => (
              <tr key={entry.id} data-hours={entry.hours}>
                <th scope="row">{entry.hours} hours</th>
                <td>{penceExact.format(entry.hourly_wage)}</td>
                <td>
                  {pounds.format(entry.net_income_gain_current_law)}; {pounds.format(entry.net_income_gain_package)}
                </td>
                <td>
                  {pounds.format(entry.exchequer_gain_current_law)}; {pounds.format(entry.exchequer_gain_package)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul>
        {data.basis && <li>{data.basis}</li>}
        {data.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Break-even arithmetic for one run, from milburn_summary.json: the share
 * of young people in losing households who would need to move into work
 * for their average income to recover, the entrants whose gains would
 * match the total income loss, and the Exchequer's gain per entrant, at 16
 * and 25 hours a week.
 */
export function BreakEven({ runId, catalogue }) {
  const summaryState = useMilburnSummary(catalogue?.manifest?.snapshotSha256 ?? null);
  return <BreakEvenSection runId={runId} catalogue={catalogue} summaryState={summaryState} />;
}

/** BreakEven with the summary already read. */
function BreakEvenSection({ runId, catalogue, summaryState }) {
  const id = runId || DEFAULT_SUMMARY_RUN;
  const { status, summary } = summaryState;
  const measure = catalogue?.byId?.get(id);
  const name = measure ? shortNameOf(measure) : id;
  let body;
  if (status === "loading") {
    body = (
      <p className="view-status" role="status">
        Loading the break-even arithmetic…
      </p>
    );
  } else if (status !== "ready") {
    body = <p role="status">Not available: the summary file has not been written yet.</p>;
  } else {
    const run = summaryRun(summary, id);
    const yearLabel = fiscalYearTick(summary.year);
    if (!run) {
      body = <p role="status">Not yet run: the arithmetic for {name} appears here once its national run has finished.</p>;
    } else if (run.direction === "gain") {
      body = <p role="status">{name} raises young people&rsquo;s household incomes, so there is no loss for work to make up: no break-even arithmetic applies.</p>;
    } else {
      body = (
        <>
          <p>
            For {name}, {yearLabel}: how many of the young people aged 16 to 24 in losing households would need to move
            into work for the gain to make up the loss. {SAME_GAIN_SENTENCE}
          </p>
          <div className="milburn-table-wrap">
            <table className="milburn-table">
              <thead>
                <tr>
                  <th scope="col">Hours a week</th>
                  <th scope="col">Share who would need to move into work for their average income to recover</th>
                  <th scope="col">Entrants whose gains would match the total income loss</th>
                  <th scope="col">Exchequer gain per entrant, £ a year</th>
                </tr>
              </thead>
              <tbody>
                {BREAK_EVEN_HOURS.map(({ id: hoursId, hours }) => (
                  <tr key={hoursId} data-hours={hours}>
                    <th scope="row">{hours} hours</th>
                    <td>{breakEvenText(run.breakEvenSharePct[hoursId]) || "Not in the summary"}</td>
                    <td>{run.entrantsToMatch[hoursId] !== null ? formatPeople(run.entrantsToMatch[hoursId]) : "Not in the summary"}</td>
                    <td>{run.exchequerGainPerEntrant[hoursId] !== null ? formatPounds(run.exchequerGainPerEntrant[hoursId]) : "Not in the summary"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            A share above 100% means that even if every young person in a losing household moved into work at those
            hours, the average gain would not restore the average loss. Counts are rounded to the nearest thousand.
          </p>
        </>
      );
    }
  }
  return (
    <section className="report-section milburn-breakeven" aria-labelledby="milburn-breakeven-heading">
      <h3 id="milburn-breakeven-heading">Break-even arithmetic</h3>
      {body}
    </section>
  );
}

/**
 * Impact's Return to work sub-tab (?sub=scenarios): the full abolition
 * package beside the same package with a quarter of the young people it
 * leaves worse off moving into work, microsimulated (milburn_summary.json);
 * then the household entry cases (milburn_scenarios.json) and the
 * break-even arithmetic for the selected run. Anything missing shows an
 * unavailable state, never zeros.
 */
export default function BehaviouralScenarios({ selectedRun } = {}) {
  const catalogue = useMeasureCatalogue();
  const file = useScenariosFile();
  const summaryState = useMilburnSummary(catalogue?.manifest?.snapshotSha256 ?? null);

  let lead;
  if (summaryState.status === "loading") {
    lead = (
      <p className="view-status" role="status">
        Loading the comparison…
      </p>
    );
  } else if (summaryState.status !== "ready") {
    lead = (
      <div className="milburn-unavailable" role="status">
        <p>The comparison is not available: the summary file has not been written yet.</p>
      </div>
    );
  } else {
    lead = <EntryComparison summary={summaryState.summary} catalogue={catalogue} />;
  }

  let cases;
  if (file.status === "loading") {
    cases = (
      <p className="view-status" role="status">
        Loading the entry cases…
      </p>
    );
  } else if (file.status !== "ready") {
    cases = (
      <div className="milburn-unavailable" role="status">
        <p>The entry cases are not available: their data file has not been published.</p>
      </div>
    );
  } else {
    cases = <EntryCases data={file.data} />;
  }

  return (
    <div className="results-container milburn-scenarios">
      <SectionHeading
        icon="sliders"
        title="Return to work"
        subtitle="How much the package's saving, poverty and losses change if some of the young people it leaves worse off move into work."
      />
      <p className="milburn-label" role="note">
        {SCENARIOS_LABEL}
      </p>
      {lead}
      {cases}
      <BreakEvenSection runId={selectedRun} catalogue={catalogue} summaryState={summaryState} />
    </div>
  );
}
