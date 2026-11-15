import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Tooltip } from "../ViewportTooltip";
import SectionHeading from "../SectionHeading";
import StatTiles from "../StatTiles";
import TitleIcon from "../TitleIcon";
import ChartDownloadMenu from "../ChartDownloadMenu";
import { CHART_LOGO } from "../../utils/chartLogo";
import {
  AXIS_LINE,
  CHART_COLOURS,
  GRID_PROPS,
  TICK_STYLE,
  chartMargin,
  fiscalYearTick,
  useNarrowViewport,
} from "../../utils/chartTheme";
import { useMeasureCatalogue } from "../../utils/measureCatalogue";
import { usePackageTable } from "../../utils/milburn/packageRun";
import {
  DEFAULT_CASE,
  DEFAULT_SHARE,
  HOURS_CASES,
  SCENARIOS_FILE,
  SHARE_MAX,
  SHARE_MIN,
  SHARE_PRESETS,
  packageStaticBn,
  parseScenarios,
  scenarioFigures,
} from "../../utils/milburn/scenarios";
import { youngPeopleWorseOff } from "../../utils/milburn/youngPeople";
import {
  BREAK_EVEN_HOURS,
  DEFAULT_SUMMARY_RUN,
  ENTRY_RUN,
  breakEvenText,
  formatBn,
  formatPeople,
  formatPounds,
  savingInYear,
  summaryRun,
  useMilburnSummary,
} from "../../utils/milburn/summary";
import { shortNameOf } from "../../utils/policyDetails";
import "./milburn.css";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** The label every view of the scenarios carries. */
export const SCENARIOS_LABEL = "Illustrative scenarios, not a PolicyEngine estimate. The main figures are static.";

const people = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const pounds = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

/** £m with one decimal place and its sign: "+£12.3m", "−£4.0m". */
export function formatSignedM(value) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}£${Math.abs(value).toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}m`;
}

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

function Unavailable({ children }) {
  return (
    <div className="milburn-unavailable" role="status">
      <p>{children}</p>
    </div>
  );
}

/** The gain from work is the same with and without the package: said wherever the arithmetic is. */
export const SAME_GAIN_SENTENCE =
  "The gain from moving into work is the same under current law and under the package, so this is arithmetic about how far work could offset the loss, not an incentive the reform creates.";

/**
 * Break-even arithmetic for one run, from milburn_summary.json: the share
 * of young people in losing households who would need to move into work
 * for their average income to recover, the entrants whose gains would
 * match the total income loss, and the Exchequer's gain per entrant, at 16
 * and 25 hours a week. Beside it, where it has run, the package with an
 * illustrative 25% moving into work, microsimulated.
 */
export function BreakEven({ runId, catalogue }) {
  const id = runId || DEFAULT_SUMMARY_RUN;
  const { status, summary } = useMilburnSummary(catalogue?.manifest?.snapshotSha256 ?? null);
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
      const fullId = DEFAULT_SUMMARY_RUN;
      const full = summaryRun(summary, fullId);
      const entry = summaryRun(summary, ENTRY_RUN);
      const fullSaving = savingInYear(full, summary.year);
      const entrySaving = savingInYear(entry, summary.year);
      const fullName = catalogue?.byId?.get(fullId) ? shortNameOf(catalogue.byId.get(fullId)) : fullId;
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
          {entrySaving !== null && fullSaving !== null && (
            <p data-entry-run="">
              Static saving in {yearLabel}: {formatBn(fullSaving)} for {fullName}; {formatBn(entrySaving)} with 25%
              moving into work, microsimulated.
            </p>
          )}
          {entrySaving !== null && fullSaving !== null && (
            <p data-entry-run-comparison="">
              The microsimulated scenario adds {formatBn(entrySaving - fullSaving)} to the Exchequer, far less than the
              slider below gives at 25%. The slider applies one case (a single Universal Credit claimant adding £4,027 a year to the
              Exchequer) to every young person in a losing household. In the survey data many of them
              are not on Universal Credit because they live with their parents, some already work, and the count includes
              siblings and partners. Treat the slider as an upper bound and the microsimulated figure as the better guide.
            </p>
          )}
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
 * Population impact's Behavioural scenarios sub-tab: what the package's
 * effect on the public finances would be if a share of the young people it
 * leaves worse off moved into work. The entry cases (hours, wage, gains)
 * come from milburn_scenarios.json; the number of young people and the
 * static figure from the verified results. Any of them missing shows an
 * unavailable state, never zeros.
 */
export default function BehaviouralScenarios({ selectedRun } = {}) {
  const narrow = useNarrowViewport();
  const catalogue = useMeasureCatalogue();
  const file = useScenariosFile();
  // The package run's own rows (utils/milburn/packageRun.js)
  const age = usePackageTable(catalogue, "age_impact");
  const budgetary = usePackageTable(catalogue, "budgetary_impact");
  const [share, setShare] = useState(DEFAULT_SHARE);
  const [caseId, setCaseId] = useState(DEFAULT_CASE);
  const chartRef = useRef(null);

  const packageId = age.key;
  const data = file.data;
  const year = data?.year;
  const entryCase = data?.entryCases.find((entry) => entry.id === caseId) ?? null;
  const affected = useMemo(
    () => (year === undefined ? null : youngPeopleWorseOff(age.rows, packageId, year)),
    [age.rows, packageId, year],
  );
  const staticBn = useMemo(
    () => (year === undefined ? null : packageStaticBn(budgetary.rows, packageId, year)),
    [budgetary.rows, packageId, year],
  );
  const figures = scenarioFigures({ entryCase, sharePct: share, affected, staticBn });

  const heading = (
    <SectionHeading
      icon="sliders"
      title="Behavioural scenarios"
      subtitle="What the package's effect on the public finances would be if some of the young people it leaves worse off moved into work."
    />
  );
  const label = (
    <p className="milburn-label" role="note">
      {SCENARIOS_LABEL}
    </p>
  );

  let body;
  if (file.status === "loading" || (file.status === "ready" && (age.status === "loading" || budgetary.status === "loading"))) {
    body = (
      <p className="view-status" role="status">
        Loading scenarios…
      </p>
    );
  } else if (file.status !== "ready") {
    body = <Unavailable>The behavioural scenarios are not available: their data file has not been published.</Unavailable>;
  } else if (affected === null || staticBn === null) {
    body = (
      <Unavailable>
        The behavioural scenarios are not available: the package&rsquo;s {catalogue.localBuild ? "local build" : "verified"} results for {fiscalYearTick(year)}{" "}
        {affected === null ? "give no count of young people affected" : "give no figure for the public finances"}.
      </Unavailable>
    );
  } else if (!entryCase || !figures) {
    body = <Unavailable>This hours case is not in the scenarios file.</Unavailable>;
  } else {
    const yearLabel = fiscalYearTick(year);
    const chartData = [
      { key: "static", label: "Static estimate", value: figures.staticM, fill: CHART_COLOURS.before },
      { key: "after", label: "After the illustrative offset", value: figures.afterM, fill: CHART_COLOURS.after },
    ];
    const download = {
      chartRef,
      name: "milburn-behavioural-scenario",
      csv: () =>
        [
          "series,year,share_moving_into_work_pct,hours_case,net_effect_gbp_m",
          ...chartData.map((row) => `${row.label},${yearLabel},${share},${entryCase.hours},${row.value.toFixed(3)}`),
        ].join("\n"),
    };
    body = (
      <>
        <section className="report-section milburn-controls" aria-label="Scenario settings">
          <div className="milburn-control">
            <label htmlFor="milburn-share" className="milburn-control-label">
              Share of affected young people who move into work: <strong>{share}%</strong>
            </label>
            <input
              id="milburn-share"
              type="range"
              min={SHARE_MIN}
              max={SHARE_MAX}
              step={1}
              value={share}
              onChange={(event) => setShare(Number(event.target.value))}
            />
            <div className="milburn-presets" role="group" aria-label="Preset shares">
              {SHARE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`milburn-chip${share === preset ? " is-selected" : ""}`}
                  aria-pressed={share === preset}
                  onClick={() => setShare(preset)}
                >
                  {preset}%
                </button>
              ))}
            </div>
          </div>
          <div className="milburn-control">
            <span className="milburn-control-label" id="milburn-hours">
              Hours case
            </span>
            <div className="milburn-presets" role="radiogroup" aria-labelledby="milburn-hours">
              {HOURS_CASES.filter((option) => data.entryCases.some((entry) => entry.id === option.id)).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={caseId === option.id}
                  className={`milburn-chip${caseId === option.id ? " is-selected" : ""}`}
                  onClick={() => setCaseId(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="milburn-control-note">
              At {pounds.format(entryCase.hourly_wage)} an hour, each young person who moves into work gains{" "}
              {pounds.format(entryCase.net_income_gain_package)} a year in net income under the package (
              {pounds.format(entryCase.net_income_gain_current_law)} under current law), and the Exchequer gains{" "}
              {pounds.format(entryCase.exchequer_gain_package)} a year ({pounds.format(entryCase.exchequer_gain_current_law)}{" "}
              under current law).
            </p>
          </div>
        </section>

        <StatTiles
          items={[
            {
              key: "movers",
              value: people.format(figures.movers),
              label: "Young people moving into work",
              sub: `${share}% of ${people.format(affected)} aged 16 to 24 left worse off by the package, ${yearLabel}`,
            },
            {
              key: "offset",
              value: formatSignedM(figures.offsetM),
              label: "Exchequer offset",
              sub: `A year, ${yearLabel}`,
            },
            {
              key: "after",
              value: formatSignedM(figures.afterM),
              label: "Net effect after the offset",
              sub: `Static estimate: ${formatSignedM(figures.staticM)}`,
            },
          ]}
        />

        <section className="report-section">
          <div className="milburn-chart-card">
            <div className="chart-header">
              <div>
                <h3>
                  <TitleIcon name="landmark" />
                  <span className="title-text">Static estimate and after the illustrative offset</span>
                </h3>
                <p className="chart-description">
                  The package&rsquo;s net effect on the public finances in {yearLabel}, £ million a year; a
                  positive figure is a gain to the Exchequer. {SCENARIOS_LABEL}
                </p>
              </div>
              <ChartDownloadMenu download={download} chartTitle="Behavioural scenario" period={yearLabel} />
            </div>
            <div ref={chartRef}>
              <ResponsiveContainer width="100%" height={narrow ? 300 : 340}>
                <BarChart data={chartData} margin={chartMargin(narrow, { top: 28 })}>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="label" tick={TICK_STYLE} axisLine={AXIS_LINE} tickLine={false} />
                  <YAxis
                    tick={TICK_STYLE}
                    axisLine={AXIS_LINE}
                    tickLine={false}
                    width={72}
                    tickFormatter={(value) => `£${Number(value).toLocaleString("en-GB")}m`}
                  />
                  <ReferenceLine y={0} stroke={CHART_COLOURS.zeroLine} />
                  <Tooltip formatter={(value) => [formatSignedM(Number(value)), `Net effect, ${yearLabel}`]} />
                  <Bar dataKey="value" name="Net effect on the public finances" radius={[5, 5, 0, 0]} isAnimationActive={false}>
                    {chartData.map((row) => (
                      <Cell key={row.key} fill={row.fill} />
                    ))}
                    <LabelList dataKey="value" position="top" formatter={(value) => formatSignedM(Number(value))} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CHART_LOGO.href} alt="PolicyEngine" />
            </div>
          </div>
        </section>

        <section className="report-section milburn-notes">
          <h3>How the scenario is built</h3>
          <ul>
            <li>
              Young people affected: people aged 16 to 24 in households whose net income falls under the package
              in {yearLabel}, from the {catalogue.localBuild ? "local build’s" : "verified"} static results.
            </li>
            <li>
              Each young person who moves into work is assumed to match the selected entry case; the Exchequer
              offset is their number times the case&rsquo;s gain to the Exchequer under the package.
            </li>
            <li>No other behaviour changes, and the labour market absorbs the extra workers at the case&rsquo;s wage.</li>
            {data.basis && <li>{data.basis}</li>}
            {data.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      </>
    );
  }

  return (
    <div className="results-container milburn-scenarios">
      {heading}
      {label}
      {catalogue.localBuild && <BreakEven runId={selectedRun} catalogue={catalogue} />}
      {body}
    </div>
  );
}
