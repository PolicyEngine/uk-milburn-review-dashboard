import { useEffect, useState } from "react";
import SectionHeading from "../SectionHeading";
import TitleIcon from "../TitleIcon";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TOOLTIP_PROPS } from "../ChartTooltip";
import { ChartPanel, FiguresTable, HorizontalBars, MilburnChartCard, yearOnlyText } from "./MilburnCharts";
import { MethodLink } from "../../utils/methodLink";

/** The Methodology passage on the move into work: the share, who, and why. */
export const ENTRY_METHOD_ANCHOR = "method-behavioural-scenarios";
import { buildChartCsv } from "../../utils/chartCsv";
import {
  AXIS_LINE,
  BAR_RADIUS,
  CHART_COLOURS,
  GRID_PROPS,
  HOVER_CURSOR,
  TICK_STYLE,
  TOOLTIP_CONTENT_STYLE,
  axisWidth,
  chartMargin,
  legendLabelStyle,
  useNarrowViewport,
  zeroBasedAxis,
} from "../../utils/chartTheme";
import { fiscalYearTick } from "../../utils/chartTheme";
import { useMeasureCatalogue } from "../../utils/measureCatalogue";
import { HOURS_CASES, SCENARIOS_FILE, parseScenarios } from "../../utils/milburn/scenarios";
import {
  BREAK_EVEN_ENTRANTS_DEFINITION,
  BREAK_EVEN_HOURS,
  BREAK_EVEN_SHARE_DEFINITION,
  DEFAULT_SUMMARY_RUN,
  ENTRY_ASSUMPTION,
  ENTRY_ASSUMPTION_TEXT,
  ENTRY_RUN,
  MORE_ENTRANTS_THAN_GROUP,
  breakEvenText,
  entryMovers,
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
export const SCENARIOS_LABEL = `Assumption: ${ENTRY_ASSUMPTION_TEXT}, microsimulated. Other tabs: static.`;

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

/** The household case's gain from work is the same with and without the package: said wherever the arithmetic is. */
export const SAME_GAIN_SENTENCE =
  "In the household case used, the gain from work is the same under current law and under the package.";

/** The heading over what the run with a move into work does. */
export const ENTRY_RUN_HEADING = "What the run changes";

/**
 * What the run with a move into work does, a point each: who moves (their
 * number from the run's own results, left out when the file carries none),
 * into what work, and what the figures beside it then count.
 */
export function entryRunPoints(movers) {
  const share = `${ENTRY_ASSUMPTION.share} of ${ENTRY_ASSUMPTION.group}, chosen at random`;
  return [
    movers === null || movers === undefined ? `Who moves: ${share}.` : `Who moves: about ${formatPeople(movers)} people, ${share}.`,
    `Each moves from no work into ${ENTRY_ASSUMPTION.work}.`,
    "The Exchequer saving then counts the taxes paid on their earnings and any fall in their benefits.",
    "The average loss covers every 16 to 24-year-old in a losing household, whether or not they move.",
  ];
}

/** A bullet with an icon (the caveats and reading notes). */
function Point({ icon = "pin", children, ...rest }) {
  return (
    <li {...rest}>
      <TitleIcon name={icon} bare size={14} />
      <span>{children}</span>
    </li>
  );
}

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
 * package with a quarter of non-working 18 to 24-year-olds who themselves
 * have PIP or the health element moving into work, microsimulated, from
 * milburn_summary.json.
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
  const movers = entryMovers(entry);
  const fullSaving = savingInYear(full, summary.year);
  const entrySaving = savingInYear(entry, summary.year);
  const signedBn = (value) => `${value >= 0 ? "+" : "−"}${formatBn(Math.abs(value))}`;
  const signedPounds = (value) => `${value >= 0 ? "+" : "−"}${formatPounds(Math.abs(value))}`;
  const difference = (after, before) => (after !== null && before !== null ? after - before : null);
  // A fall in poverty or in the loss is the better outcome; a rise in the saving is
  const tone = (delta, betterWhen) => (delta === null || delta === 0 ? "flat" : Math.sign(delta) === betterWhen ? "more" : "less");
  const savingDelta = difference(entrySaving, fullSaving);
  const povertyDelta = difference(entry.povertyPp.abs_ahc, full.povertyPp.abs_ahc);
  const lossDelta = difference(entry.averageLossYoung, full.averageLossYoung);
  const rows = [
    {
      key: "saving",
      icon: "landmark",
      label: `Exchequer saving, ${yearLabel}`,
      short: "Exchequer saving (£bn)",
      full: formatBn(fullSaving),
      entry: formatBn(entrySaving),
      values: [fullSaving, entrySaving],
      format: (value) => `£${value}bn`,
      delta: savingDelta === null ? null : signedBn(savingDelta),
      tone: tone(savingDelta, 1),
    },
    {
      key: "poverty",
      icon: "percent",
      label: "Absolute poverty after housing costs, all ages",
      short: "Absolute poverty rate (pp)",
      full: povertyText(full),
      entry: povertyText(entry),
      values: [full.povertyPp.abs_ahc, entry.povertyPp.abs_ahc],
      barLabels: [formatSignedPp(full.povertyPp.abs_ahc), formatSignedPp(entry.povertyPp.abs_ahc)],
      format: (value) => `${value}pp`,
      delta: povertyDelta === null ? null : formatSignedPp(povertyDelta),
      tone: tone(povertyDelta, -1),
    },
    {
      key: "loss",
      icon: "wallet",
      label: "Average loss, young people in losing households (£ a year)",
      short: "Average household loss (£ a year)",
      full: formatPounds(full.averageLossYoung),
      entry: formatPounds(entry.averageLossYoung),
      values: [full.averageLossYoung, entry.averageLossYoung],
      format: (value) => `£${value.toLocaleString("en-GB")}`,
      delta: lossDelta === null ? null : signedPounds(lossDelta),
      tone: tone(lossDelta, -1),
    },
  ];
  const SERIES = [
    { name: "Static", color: CHART_COLOURS.before },
    { name: "25% move into work", color: CHART_COLOURS.after },
  ];
  const title = "With a quarter moving into work";
  const csv = () =>
    buildChartCsv({
      title: `${title}: ${fullName}, ${yearLabel}`,
      units: `As each row says; static, and with ${ENTRY_ASSUMPTION_TEXT}`,
      columns: [
        { key: "label", label: "Figure" },
        { key: "full", label: "Static" },
        { key: "entry", label: "25% move into work" },
      ],
      rows,
    });
  return (
    <section className="report-section milburn-entry" aria-labelledby="milburn-entry-heading">
      <MilburnChartCard
        id="milburn-entry-heading"
        icon="briefcase"
        title={title}
        description={`${fullName}, ${yearLabel}: static, against ${ENTRY_ASSUMPTION.share} of ${ENTRY_ASSUMPTION.group} moving into work${movers !== null ? ` (about ${formatPeople(movers)} people)` : ""}.`}
        name="quarter-moving-into-work"
        csv={csv}
        legendItems={SERIES.map((series) => ({ color: series.color, label: series.name, type: "rect" }))}
        after={
          <>
            <FiguresTable>
              <table className="milburn-table">
                <thead>
                  <tr>
                    <th scope="col">Figure</th>
                    <th scope="col">Static</th>
                    <th scope="col">25% move into work</th>
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
            </FiguresTable>
            {savingDelta !== null && (
              <details className="milburn-details" data-entry-run-comparison="">
                <summary>
                  <TitleIcon name="alert" bare size={14} />
                  {ENTRY_RUN_HEADING}
                </summary>
                <ul className="milburn-points">
                  <Point icon="landmark">
                    <strong>
                      The move into work {savingDelta >= 0 ? "adds" : "takes"} {formatBn(Math.abs(savingDelta))}{" "}
                      {savingDelta >= 0 ? "to" : "from"} the Exchequer.
                    </strong>
                  </Point>
                  {entryRunPoints(movers).map((point, index) => (
                    <Point key={point} icon={["usersRound", "briefcase", "wallet", "scale"][index]}>
                      {point}
                    </Point>
                  ))}
                </ul>
              </details>
            )}
          </>
        }
      >
        <div className="milburn-chart-grid cols-3">
          {rows.map((row) => (
            <ChartPanel key={row.key} icon={row.icon} title={row.short} chip={row.delta} chipTone={row.tone}>
              <HorizontalBars
                ariaLabel={`${row.label}: static ${row.full}, with 25% moving into work ${row.entry}`}
                format={row.format}
                labelWidth={132}
                rows={SERIES.map((series, index) => ({
                  name: series.name,
                  value: row.values[index],
                  label: row.barLabels?.[index] ?? (index === 0 ? row.full : row.entry),
                  color: series.color,
                }))}
              />
            </ChartPanel>
          ))}
        </div>
      </MilburnChartCard>
    </section>
  );
}

/** The household entry cases from milburn_scenarios.json, one row per hours case. */
function EntryCases({ data }) {
  const cases = HOURS_CASES.map((option) => data.entryCases.find((entry) => entry.id === option.id)).filter(Boolean);
  // The same gains with and without the package: one column each, and a
  // line saying so; both figures side by side only where they differ
  const same = cases.length > 0 && cases.every(
    (entry) =>
      entry.net_income_gain_current_law === entry.net_income_gain_package &&
      entry.exchequer_gain_current_law === entry.exchequer_gain_package,
  );
  // The file's own sentences, too long for one-line bullets: prose, folded away
  const paragraphs = [data.basis, data.notes.join(" ")].filter(Boolean);
  const narrow = useNarrowViewport();
  // One bar per gain, and per law where the two differ
  const series = same
    ? [
        { key: "net_income_gain_current_law", name: "Net income gain", color: CHART_COLOURS.gain },
        { key: "exchequer_gain_current_law", name: "Exchequer gain", color: CHART_COLOURS.highlight },
      ]
    : [
        { key: "net_income_gain_current_law", name: "Net income gain, current law", color: CHART_COLOURS.gainLight },
        { key: "net_income_gain_package", name: "Net income gain, package", color: CHART_COLOURS.gain },
        { key: "exchequer_gain_current_law", name: "Exchequer gain, current law", color: CHART_COLOURS.reference },
        { key: "exchequer_gain_package", name: "Exchequer gain, package", color: CHART_COLOURS.highlight },
      ];
  const chartData = cases.map((entry) => ({ ...entry, name: `${entry.hours} hours` }));
  const { domain, ticks } = zeroBasedAxis(chartData.flatMap((entry) => series.map((item) => entry[item.key])));
  const tick = (value) => pounds.format(value);
  const wage = cases[0] && cases.every((entry) => entry.hourly_wage === cases[0].hourly_wage) ? penceExact.format(cases[0].hourly_wage) : null;
  const title = "One young person moving into work";
  const description = `Gain from moving from no work to ${cases.map((entry) => entry.hours).join(" or ")} hours a week${wage ? ` at ${wage} an hour` : ""}, £ a year.`;
  const csv = () =>
    buildChartCsv({
      title,
      units: "£ a year, in work minus out of work",
      columns: [
        { key: "hours", label: "Hours a week" },
        { key: "hourly_wage", label: "Hourly wage (£)", decimals: 2 },
        { key: "net_income_gain_current_law", label: "Net income gain, current law", decimals: 2 },
        { key: "net_income_gain_package", label: "Net income gain, package", decimals: 2 },
        { key: "exchequer_gain_current_law", label: "Exchequer gain, current law", decimals: 2 },
        { key: "exchequer_gain_package", label: "Exchequer gain, package", decimals: 2 },
      ],
      rows: cases,
    });
  return (
    <section className="report-section milburn-notes milburn-card" aria-labelledby="milburn-cases-heading">
      <MilburnChartCard
        id="milburn-cases-heading"
        icon="user"
        title={title}
        description={description}
        name="one-young-person-moving-into-work"
        csv={csv}
        single
        after={
          <>
            {same && (
              <ul className="milburn-points" data-same-gain="">
                <Point icon="scale">Same under current law and under the package.</Point>
              </ul>
            )}
            <FiguresTable>
              <table className="milburn-table">
                <thead>
                  <tr>
                    <th scope="col">Hours a week</th>
                    <th scope="col">Hourly wage</th>
                    <th scope="col">Net income gain, £ a year{same ? "" : " (current law; package)"}</th>
                    <th scope="col">Exchequer gain, £ a year{same ? "" : " (current law; package)"}</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((entry) => (
                    <tr key={entry.id} data-hours={entry.hours}>
                      <th scope="row">{entry.hours} hours</th>
                      <td>{penceExact.format(entry.hourly_wage)}</td>
                      <td>
                        {pounds.format(entry.net_income_gain_current_law)}
                        {!same && `; ${pounds.format(entry.net_income_gain_package)}`}
                      </td>
                      <td>
                        {pounds.format(entry.exchequer_gain_current_law)}
                        {!same && `; ${pounds.format(entry.exchequer_gain_package)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </FiguresTable>
            {paragraphs.length > 0 && (
              <details className="milburn-details">
                <summary>
                  <TitleIcon name="list" bare size={14} />
                  How the case is set up
                </summary>
                {paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </details>
            )}
          </>
        }
      >
        <div role="img" aria-label={`${title}: ${chartData.map((entry) => `${entry.name}, ${series.map((item) => `${item.name} ${tick(entry[item.key])}`).join(", ")}`).join("; ")}`}>
          <ResponsiveContainer width="100%" height={narrow ? 300 : 340}>
            <BarChart data={chartData} margin={chartMargin(narrow, { top: 24 })} barCategoryGap="24%" barGap={6}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="name" tick={TICK_STYLE} axisLine={AXIS_LINE} tickLine={false} interval={0} />
              <YAxis
                domain={domain}
                ticks={ticks}
                width={axisWidth(ticks, tick, { title: false })}
                tick={TICK_STYLE}
                axisLine={false}
                tickLine={false}
                tickFormatter={tick}
              />
              <Tooltip {...TOOLTIP_PROPS} cursor={HOVER_CURSOR} contentStyle={TOOLTIP_CONTENT_STYLE} formatter={(value) => `${tick(value)} a year`} />
              <Legend wrapperStyle={{ paddingTop: "20px" }} formatter={(value) => <span style={legendLabelStyle(narrow)}>{value}</span>} />
              {series.map((item) => (
                <Bar key={item.key} dataKey={item.key} name={item.name} fill={item.color} radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]} maxBarSize={72} isAnimationActive={false}>
                  {!(narrow && !same) && (
                    <LabelList dataKey={item.key} position="top" formatter={tick} style={{ ...TICK_STYLE, fill: CHART_COLOURS.text, fontWeight: 600 }} />
                  )}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </MilburnChartCard>
    </section>
  );
}

/**
 * Break-even arithmetic for one run, from milburn_summary.json: the
 * entrants whose gains from work would match the total income loss (the
 * Exchequer saving), those entrants as a share of the young people in
 * losing households, and the Exchequer's gain per entrant, at 16 and 25
 * hours a week.
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
  let after = null;
  let csv = null;
  let description = null;
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
      const hoursRows = BREAK_EVEN_HOURS.map(({ id: hoursId, hours }) => ({
        hours,
        name: `${hours} hours`,
        share: run.breakEvenSharePct[hoursId],
        entrants: run.entrantsToMatch[hoursId],
        perEntrant: run.exchequerGainPerEntrant[hoursId],
      }));
      description = `${name}, ${yearLabel}: the entrants whose gains from work would match the Exchequer saving, beside the 16 to 24-year-olds in losing households.`;
      csv = () =>
        buildChartCsv({
          title: `Break-even arithmetic: ${name}, ${yearLabel}`,
          units: "Share in %, entrants in people, Exchequer gain in £ a year per entrant",
          columns: [
            { key: "hours", label: "Hours a week" },
            { key: "entrants", label: "Entrants needed (Exchequer saving divided by one entrant's gain from work)", decimals: 0 },
            { key: "share", label: "Entrants needed as a share of 16 to 24-year-olds in losing households (%)", decimals: 1 },
            { key: "perEntrant", label: "Exchequer gain per entrant (£ a year)", decimals: 2 },
          ],
          rows: hoursRows,
        });
      body = (
        <div className="milburn-chart-grid cols-2">
          <ChartPanel icon="percent" title="Entrants needed, as a share of 16–24s in losing households">
            <HorizontalBars
              ariaLabel={`Entrants needed, as a share of 16 to 24-year-olds in losing households: ${hoursRows.map((row) => `${row.name} ${row.share?.toFixed(1)}%`).join(", ")}; all of them is 100%`}
              format={(value) => `${value}%`}
              labelWidth={76}
              references={[{ value: 100, label: "All 16–24s in losing households" }]}
              rows={hoursRows.map((row) => ({
                name: row.name,
                value: row.share,
                label: row.share === null ? "" : `${row.share.toFixed(1)}%`,
                color: row.share > 100 ? CHART_COLOURS.loss : CHART_COLOURS.gain,
              }))}
            />
          </ChartPanel>
          <ChartPanel icon="usersRound" title="Entrants needed to match the Exchequer saving">
            <HorizontalBars
              ariaLabel={`Entrants needed to match the Exchequer saving: ${hoursRows.map((row) => `${row.name} ${formatPeople(row.entrants)}`).join(", ")}`}
              format={(value) => (value >= 1000 ? `${value / 1000}k` : String(value))}
              labelWidth={76}
              references={run.youngPeopleLosing !== null ? [{ value: run.youngPeopleLosing, label: `16–24s in losing households: ${formatPeople(run.youngPeopleLosing)}` }] : []}
              rows={hoursRows.map((row) => ({
                name: row.name,
                value: row.entrants,
                label: row.entrants === null ? "" : formatPeople(row.entrants),
                color: CHART_COLOURS.highlight,
              }))}
            />
          </ChartPanel>
        </div>
      );
      after = (
        <>
          <FiguresTable>
            <table className="milburn-table">
              <thead>
                <tr>
                  <th scope="col">Hours a week</th>
                  <th scope="col">Entrants needed, as a share of 16–24s in losing households</th>
                  <th scope="col">Entrants needed to match the Exchequer saving</th>
                  <th scope="col">Exchequer gain per entrant, £ a year</th>
                </tr>
              </thead>
              <tbody>
                {BREAK_EVEN_HOURS.map(({ id: hoursId, hours }) => (
                  <tr key={hoursId} data-hours={hours}>
                    <th scope="row">{hours} hours</th>
                    <td>
                      {run.breakEvenSharePct[hoursId] > 100 ? (
                        <>
                          {run.breakEvenSharePct[hoursId].toFixed(1)}%{" "}
                          <span className="milburn-tag" title={`${MORE_ENTRANTS_THAN_GROUP}.`}>
                            Above 100%: more than the group
                          </span>
                        </>
                      ) : (
                        breakEvenText(run.breakEvenSharePct[hoursId]) || "Not in the summary"
                      )}
                    </td>
                    <td>{run.entrantsToMatch[hoursId] !== null ? formatPeople(run.entrantsToMatch[hoursId]) : "Not in the summary"}</td>
                    <td>{run.exchequerGainPerEntrant[hoursId] !== null ? formatPounds(run.exchequerGainPerEntrant[hoursId]) : "Not in the summary"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </FiguresTable>
          <details className="milburn-details">
            <summary>
              <TitleIcon name="alert" bare size={14} />
              Notes and caveats
            </summary>
            <ul className="milburn-points">
              <Point icon="usersRound">{BREAK_EVEN_ENTRANTS_DEFINITION}</Point>
              <Point icon="percent">{BREAK_EVEN_SHARE_DEFINITION}</Point>
              <Point icon="alert">
                <strong>Above 100%.</strong> {MORE_ENTRANTS_THAN_GROUP}.
              </Point>
              <Point icon="scale">{SAME_GAIN_SENTENCE}</Point>
              <Point icon="user">The gain from work is one household case, set out above; other households gain differently.</Point>
              <Point icon="calculator">Counts rounded to the nearest thousand.</Point>
            </ul>
          </details>
        </>
      );
    }
  }
  return (
    <section className="report-section milburn-breakeven" aria-labelledby="milburn-breakeven-heading">
      <MilburnChartCard
        id="milburn-breakeven-heading"
        icon="calculator"
        title="Break-even arithmetic"
        description={description}
        name="break-even-arithmetic"
        csv={csv}
        after={after}
      >
        {body}
      </MilburnChartCard>
    </section>
  );
}

/**
 * Impact's Return to work sub-tab (?sub=scenarios): the full abolition
 * package beside the same package with a quarter of non-working 18 to
 * 24-year-olds with PIP or the health element moving into work,
 * microsimulated (milburn_summary.json);
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
        subtitle="What changes if some non-working young people with PIP or the health element move into work."
      />
      {/* The assumption, the link to how it was chosen, and the year it covers, in one panel */}
      <div className="milburn-assumption" role="note">
        <TitleIcon name="info" bare size={16} className="milburn-assumption-icon" />
        <div className="milburn-assumption-body">
          <p className="milburn-assumption-text">
            <span>{SCENARIOS_LABEL}</span>{" "}
            <MethodLink anchor={ENTRY_METHOD_ANCHOR}>Why 25%, and how it is run</MethodLink>
          </p>
          {summaryState.status === "ready" && Number.isInteger(summaryState.summary.year) && (
            <p className="milburn-assumption-year" data-year-only="">
              <TitleIcon name="calendar" bare size={13} />
              {yearOnlyText(summaryState.summary.year, "this tab")}
            </p>
          )}
        </div>
      </div>
      {lead}
      {cases}
      <BreakEvenSection runId={selectedRun} catalogue={catalogue} summaryState={summaryState} />
    </div>
  );
}
