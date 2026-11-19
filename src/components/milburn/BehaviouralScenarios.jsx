import { useEffect, useState } from "react";
import SectionHeading from "../SectionHeading";
import TitleIcon from "../TitleIcon";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TOOLTIP_PROPS } from "../ChartTooltip";
import { ChartPanel, FiguresTable, HorizontalBars, MilburnChartCard } from "./MilburnCharts";
import { EntryShares, EntryYear } from "./EntryPathCards";
import { MethodLink } from "../../utils/methodLink";
import SourceChip from "./SourceChip";
import { MoreInfoDisclosure } from "./BenchmarkCards";

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
  HEADLINE_RUN,
  MORE_ENTRANTS_THAN_GROUP,
  breakEvenText,
  formatPeople,
  formatPounds,
  summaryRun,
  useMilburnSummary,
  useReviewFigures,
} from "../../utils/milburn/summary";
import { shortNameOf } from "../../utils/policyDetails";
import {
  ENTRY_GROUP,
  ENTRY_WORK,
  NONE_BEFORE_START,
  SCENARIOS_SUBTITLE,
  beforeStart,
  pathYear,
  shareText,
  useEntryPath,
} from "../../utils/milburn/entryPath";
import { FIGURE_WITHHELD } from "./EntryPathCards";
import "./milburn.css";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** The label the sub-tab carries. */
export const SCENARIOS_LABEL = `Assumes a share of ${ENTRY_GROUP} take ${ENTRY_WORK}: none before April 2029, then a phased share rising to 4.4% by 2031-32, or 9% with no ramp`;

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

/** A bullet with an icon (the caveats and reading notes). */
function Point({ icon = "pin", children, ...rest }) {
  return (
    <li {...rest}>
      <TitleIcon name={icon} bare size={14} />
      <span>{children}</span>
    </li>
  );
}

/** A link that leaves the site: a new tab, no opener. */
function SourceLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

/** The heading over the two exercises side by side. */
export const REVIEW_COMPARISON_TITLE = "Beside the review's own estimate";

/** The two exercises' names, on their cards and over the full table's columns. */
export const OUR_SCENARIO_TITLE = "PolicyEngine: assumed phased move into work";
export const REVIEW_MODELLING_TITLE = "The review’s modelling";

/** Said wherever the two figures meet: they are not the same exercise. */
export const DIFFERENT_EXERCISES_SENTENCE =
  "The two are different exercises, for different years, groups and measures: neither figure is a check on the other.";

/** Why our figure is not drawn beside the review's: it is an assumption, not an estimate. */
export const ASSUMED_NOT_ESTIMATED_SENTENCE = "Our figure follows from an assumed share moving into work, not an estimate of how many would, so the two are not drawn on one scale.";

const onePlace = (value) => `${value.toFixed(1)}%`;

/** "13.1% in 2026/27 to 6.8% in 2036/37; 13.4% without the reforms", from the review's own path. */
function neetRateText(rate) {
  if (!rate) return "";
  const last = rate.years.length - 1;
  const path = `${onePlace(rate.withReformsPct[0])} in ${rate.years[0]} to ${onePlace(rate.withReformsPct[last])} in ${rate.years[last]}; ${onePlace(rate.baselinePct[last])} in ${rate.years[last]} without the reforms`;
  // The review's own target, which its modelled path stops short of (paragraph 142)
  return rate.ambitionPct === null || rate.ambitionPct === undefined ? path : `${path}; the review’s ambition is around ${rate.ambitionPct}%`;
}

/**
 * This dashboard's illustrative run (the movers in milburn_summary.json)
 * beside the review's own employment estimate
 * (milburn_review_figures.json): two exercises, each with its year, group,
 * measures and method, and the report cited. Neither is said to be right.
 */
export function ReviewComparison({ entry, year, review, catalogue }) {
  const central = pathYear(entry, "central", year);
  // Before April 2029 no one moves: said so, not "withheld"; null after it is a withheld count
  const before = beforeStart(entry, central, year);
  const movers = !before && typeof central?.movers === "number" ? central.movers : null;
  const share = shareText(central?.share);
  const yearLabel = fiscalYearTick(year);
  const fullMeasure = catalogue?.byId?.get(HEADLINE_RUN);
  const fullName = fullMeasure ? shortNameOf(fullMeasure) : HEADLINE_RUN;
  const { employment, report, neetRate } = review;
  const ours = { column: OUR_SCENARIO_TITLE };
  const theirs = { name: `The review (published), by ${employment.byYear}`, column: REVIEW_MODELLING_TITLE };
  const noMovers = before ? NONE_BEFORE_START : FIGURE_WITHHELD;
  // The cards' one-line versions; the full wording is in the table under "Full comparison"
  const last = neetRate ? neetRate.years.length - 1 : -1;
  const cardRows = [
    { key: "when", icon: "calendar", label: "When", ours: yearLabel, theirs: `By ${employment.byYear}` },
    {
      key: "who",
      icon: "usersRound",
      label: "Who",
      ours: `${share} of non-working 18–24s losing the health element`,
      theirs: employment.who && "16–24s who would otherwise be NEET",
    },
    { key: "measures", icon: "layers", label: "Measures", ours: fullName, theirs: employment.measures && "The review’s whole package" },
    {
      key: "method",
      icon: "calculator",
      label: "Method",
      ours: "Microsimulation with an assumed move into work; entry rate assumed, not estimated",
      theirs: employment.method && "Evidence from past programmes, summed and adjusted for overlap",
    },
    {
      key: "work",
      icon: "briefcase",
      label: "Work assumed",
      // "16 hours a week at the minimum wage": the assumption's own words, shortened
      ours: "16 hours a week at the minimum wage",
      theirs: employment.hours && "Full-time and part-time mix; hours not published",
    },
    {
      key: "neet",
      icon: "percent",
      label: "NEET rate",
      ours: "Not modelled",
      theirs:
        neetRate &&
        `${onePlace(neetRate.withReformsPct[0])} to ${onePlace(neetRate.withReformsPct[last])} by ${neetRate.years[last]}${
          neetRate.ambitionPct === null || neetRate.ambitionPct === undefined ? "" : `; ambition around ${neetRate.ambitionPct}%`
        }`,
    },
  ].filter((row) => row.theirs);
  const cards = [
    {
      key: "ours",
      title: OUR_SCENARIO_TITLE,
      chip: null,
      figure: movers !== null ? `About ${formatPeople(movers)}` : noMovers,
      caption: before ? `people assumed to move into work in ${yearLabel}` : `people assumed to move into work in ${yearLabel}: an assumed ${share}, not an estimate`,
      side: "ours",
    },
    {
      key: "theirs",
      title: REVIEW_MODELLING_TITLE,
      chip: <SourceChip kind="published" source="the review" />,
      figure: `About ${formatPeople(employment.people)}`,
      caption: "people moving into work, the review estimates",
      side: "theirs",
    },
  ];
  const rows = [
    {
      key: "people",
      label: "People moving into work",
      ours: movers !== null ? `About ${formatPeople(movers)}, assumed (${share} of the group), not estimated` : noMovers,
      theirs: `About ${formatPeople(employment.people)}`,
    },
    { key: "when", label: "When", ours: yearLabel, theirs: `By ${employment.byYear}` },
    { key: "who", label: "Who", ours: `${share} of ${ENTRY_GROUP}`, theirs: employment.who },
    { key: "measures", label: "Measures covered", ours: `${fullName}, as this dashboard models it`, theirs: employment.measures },
    {
      key: "method",
      label: "Method",
      ours: "Microsimulation with an assumed move into work; the entry rate is assumed for illustration, not estimated",
      theirs: employment.method,
    },
    { key: "work", label: "Work assumed", ours: `${ENTRY_WORK[0].toUpperCase()}${ENTRY_WORK.slice(1)}`, theirs: employment.hours },
    { key: "neet", label: "NEET rate, 16 to 24-year-olds", ours: "Not modelled", theirs: neetRateText(neetRate) },
  ].filter((row) => row.theirs);
  const csv = () =>
    buildChartCsv({
      title: `${REVIEW_COMPARISON_TITLE}: people moving into work`,
      units: `As each row says. ${DIFFERENT_EXERCISES_SENTENCE} Source for the review's figures: ${report.title} (${report.published}), ${report.url}`,
      columns: [
        { key: "label", label: "Figure" },
        { key: "ours", label: ours.column },
        { key: "theirs", label: theirs.column },
      ],
      rows,
    });
  const annex = employment.annex;
  return (
    <section className="report-section milburn-entry milburn-review" aria-labelledby="milburn-review-heading">
      <MilburnChartCard
        logo={false}
        id="milburn-review-heading"
        icon="scale"
        title={REVIEW_COMPARISON_TITLE}
        description={`Different exercises, not a check on each other: ours assumes ${share} move into work in ${yearLabel}.`}
        name="beside-the-reviews-own-estimate"
        csv={csv}
        after={
          <>
            <details className="milburn-details" data-full-comparison="">
              <summary>
                <TitleIcon name="list" bare size={14} />
                Full comparison
              </summary>
            <div className="milburn-table-wrap">
              <table className="milburn-table milburn-review-table">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="visually-hidden">Figure</span>
                    </th>
                    <th scope="col">{ours.column}</th>
                    <th scope="col">{theirs.column} (published)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} data-row={row.key}>
                      <th scope="row">{row.label}</th>
                      <td>{row.ours}</td>
                      <td>{row.theirs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </details>
            <details className="milburn-details" data-review-more="">
              <summary>
                <TitleIcon name="info" bare size={14} />
                More info
              </summary>
            <p className="milburn-review-source" data-review-source="">
              Source for the review&rsquo;s figures: <SourceLink href={report.url}>{report.title}</SourceLink>
              {report.published ? ` (${report.published})` : ""}
              {employment.source && (
                <>
                  ; <SourceLink href={employment.source.url}>{employment.source.label.toLowerCase()}</SourceLink>
                </>
              )}
              {neetRate?.source && (
                <>
                  ; NEET rate: <SourceLink href={neetRate.source.url}>{neetRate.source.label.toLowerCase()}</SourceLink>
                </>
              )}
              .
            </p>
            </details>
            {annex && annex.moreInWork !== null && (
              <details className="milburn-details" data-review-annex="">
                <summary>
                  <TitleIcon name="alert" bare size={14} />
                  How the review states its figure
                </summary>
                <ul className="milburn-points">
                  <Point icon="usersRound">
                    The report gives about {formatPeople(employment.people)} into sustained work by {employment.byYear}. Its annex gives around{" "}
                    {formatPeople(annex.moreInWork)} more 16 to 24-year-olds in work in {employment.byYear}
                    {annex.moreInWorkOrEducation !== null ? `, and around ${formatPeople(annex.moreInWorkOrEducation)} more in employment and education` : ""}
                    {annex.roundedTo !== null ? `, rounded to the nearest ${formatPeople(annex.roundedTo)}` : ""}
                    {annex.source && (
                      <>
                        {" "}
                        (<SourceLink href={annex.source.url}>{annex.source.label.toLowerCase()}</SourceLink>)
                      </>
                    )}
                    .
                  </Point>
                  <Point icon="calendar">The review publishes its NEET rate year by year, but not its employment effect by year, by measure, or the hours and wages assumed.</Point>
                  <Point icon="scale">The annex says its analysis is not official government analysis.</Point>
                </ul>
              </details>
            )}
          </>
        }
      >
        {/* Two cards, not bars on one axis: our figure is an assumption, the review's an estimate */}
        <ul className="milburn-versus" aria-label="The two exercises side by side">
          {cards.map((card) => (
            <li key={card.key} className={`milburn-versus-card${card.side === "ours" ? " is-estimate" : ""}`} data-side={card.side}>
              {card.chip}
              <h4>{card.title}</h4>
              <p className="milburn-versus-figure">{card.figure}</p>
              <p className="milburn-versus-caption">{card.caption}</p>
              <ul className="milburn-versus-rows">
                {cardRows.map((row) => (
                  <li key={row.key} data-card-row={row.key}>
                    <TitleIcon name={row.icon} bare size={14} />
                    <span>
                      <strong>{row.label}:</strong> {row[card.side]}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </MilburnChartCard>
    </section>
  );
}

/**
 * The entry case beside the national average per mover: the flat path's
 * Exchequer change over static, over its movers, in the entry cases' year.
 * Null unless both figures are there. `cases`: the entry cases; the
 * 16-hour one is the one set beside the national path (16 hours too).
 */
export function perMoverNote(entry, cases, year) {
  const flat = pathYear(entry, "flat", year);
  const one = cases?.find((item) => item.hours === 16);
  const change = flat?.exchequer;
  if (!one || !change || change.static === null || change.scenario === null || !flat.movers) return null;
  const millions = (change.scenario - change.static) * 1000;
  const perMover = Math.round((millions * 1e6) / flat.movers / 100) * 100;
  return (
    `These two figures are not like for like. The entry case's ${pounds.format(one.exchequer_gain_package)} a year is one household: a single ${AGE_IN_CASE}-year-old private renter moving into 16 hours a week at the National Living Wage. ` +
    `Across the whole group, the flat path in ${fiscalYearTick(year)} gives the Exchequer about ${pounds.format(perMover)} a year per mover on average (£${millions.toFixed(1)}m over about ${formatPeople(flat.movers)} movers). ` +
    "Both count income tax, employee and employer National Insurance and benefits. The movers in the national figure are aged 18 to 24, are paid the minimum wage for their age (lower for 18 to 20-year-olds), and live in all household types and tenures, many with parents or in larger benefit units."
  );
}

/** The age of the person in the household entry cases (milburn_scenarios.py, AGE). */
const AGE_IN_CASE = 22;

/** The household entry cases from milburn_scenarios.json, one row per hours case. */
function EntryCases({ data, entry = null }) {
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
  const nationalNote = entry ? perMoverNote(entry, cases, data.year) : null;
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
            {(same || nationalNote || paragraphs.length > 0) && (
              <MoreInfoDisclosure className="milburn-more" data-case-more="">
                {same && (
                  <ul className="milburn-points" data-same-gain="">
                    <Point icon="scale">Same under current law and under the package.</Point>
                  </ul>
                )}
                {/* The entry case beside the national average per mover: not like for like */}
                {nationalNote && <p data-per-mover="">{nationalNote}</p>}
                {paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </MoreInfoDisclosure>
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

/** The review's line on the entrants chart: whose figure, for when, and the figure. */
export const reviewBreakEvenLabel = (employment) => `Review's own estimate, into work by ${employment.byYear}: ${formatPeople(employment.people)}`;

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

/**
 * BreakEven with the summary already read. `gainYear`: the year of the
 * household entry cases (milburn_scenarios.json) the gain per entrant comes
 * from, said on the card where known, as it can differ from the saving's.
 */
function BreakEvenSection({ runId, catalogue, summaryState, review = null, gainYear = null }) {
  const id = runId || HEADLINE_RUN;
  // The review's estimate is for its whole package: drawn only beside the package runs
  const reviewLine = review && id === HEADLINE_RUN ? review.employment : null;
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
    } else if (run.youngPeopleLosing > 0 && BREAK_EVEN_HOURS.every(({ id: hoursId }) => run.breakEvenSharePct[hoursId] === null)) {
      // The summary writes the break-even for every loss run with young
      // people in losing households, in its year, unless some 16-24s gain
      // (scripts/milburn_summary.py): with gains the saving is net of them
      body = <p role="status">{name} has gains as well as losses, so no break-even arithmetic applies.</p>;
    } else {
      const hoursRows = BREAK_EVEN_HOURS.map(({ id: hoursId, hours }) => ({
        hours,
        name: `${hours} hours`,
        share: run.breakEvenSharePct[hoursId],
        entrants: run.entrantsToMatch[hoursId],
        perEntrant: run.exchequerGainPerEntrant[hoursId],
      }));
      const gainLabel = Number.isInteger(gainYear) ? fiscalYearTick(gainYear) : null;
      description = gainLabel
        ? `How many young people would need to move into work to match the ${yearLabel} saving; the gain per entrant is a ${gainLabel} figure.`
        : `How many young people would need to move into work to match the saving, ${yearLabel}.`;
      const perEntrantLabel = `Exchequer gain per entrant, £ a year${gainLabel ? `, ${gainLabel}` : ""}`;
      csv = () =>
        buildChartCsv({
          title: `Break-even arithmetic: ${name}, ${yearLabel}`,
          units: "Share in %, entrants in people, Exchequer gain in £ a year per entrant",
          columns: [
            { key: "hours", label: "Hours a week" },
            { key: "entrants", label: `Entrants needed (Exchequer saving divided by one entrant's gain from work${gainLabel ? ` in ${gainLabel}` : ""})`, decimals: 0 },
            { key: "share", label: "Entrants needed as a share of 16 to 24-year-olds in losing households (%)", decimals: 1 },
            { key: "perEntrant", label: perEntrantLabel, decimals: 2 },
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
              references={[
                ...(run.youngPeopleLosing !== null ? [{ value: run.youngPeopleLosing, label: `16–24s in losing households: ${formatPeople(run.youngPeopleLosing)}` }] : []),
              ]}
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
                  <th scope="col">{perEntrantLabel}</th>
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
              <Point icon="user">{SAME_GAIN_SENTENCE} Other households gain differently.</Point>
              {reviewLine && (
                <Point icon="info" data-review-line="">
                  {reviewBreakEvenLabel(reviewLine)}, the review&rsquo;s own modelled figure for its whole package, with a mixture of full-time and
                  part-time work
                  {review.employment.source && (
                    <>
                      {" "}
                      (<SourceLink href={review.report.url}>{review.report.shortTitle}</SourceLink>, {review.employment.source.label.toLowerCase()})
                    </>
                  )}
                  . It is a different quantity, so it is not drawn on the chart: the entrants needed are for {yearLabel}, at fixed hours, for the measures modelled here.
                </Point>
              )}
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
        logo={false}
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
 * Impact's Moves into work (illustrative) sub-tab (?sub=scenarios): the
 * share of non-working young people losing the health element assumed in
 * work by year, and the selected year's figures static and on each path
 * (milburn_entry_path.json, arithmetic on two runs); our movers beside the
 * review's own employment estimate (milburn_review_figures.json); then the
 * household entry cases (milburn_scenarios.json) and the break-even
 * arithmetic for the selected run. Anything missing shows an unavailable
 * state, never zeros. `year`: the header's year.
 */
export default function BehaviouralScenarios({ selectedRun, year = 2029 } = {}) {
  const catalogue = useMeasureCatalogue();
  const file = useScenariosFile();
  const summaryState = useMilburnSummary(catalogue?.manifest?.snapshotSha256 ?? null);
  const entryState = useEntryPath();
  const reviewState = useReviewFigures();
  const review = reviewState.status === "ready" ? reviewState.review : null;
  const entry = entryState.status === "ready" ? entryState.data : null;
  const shownYear = entry && entry.years.includes(Number(year)) ? Number(year) : entry ? entry.years.find((y) => y >= (entry.startYear ?? y)) : Number(year);

  let lead;
  if (entryState.status === "loading") {
    lead = (
      <p className="view-status" role="status">
        Loading the scenario…
      </p>
    );
  } else if (!entry) {
    lead = (
      <div className="milburn-unavailable" role="status">
        <p>The scenario is not available: its data file has not been published.</p>
      </div>
    );
  } else {
    lead = (
      <>
        <EntryShares data={entry} />
        <EntryYear data={entry} year={shownYear} />
      </>
    );
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
    cases = <EntryCases data={file.data} entry={entry} />;
  }

  return (
    <div className="results-container milburn-scenarios">
      <SectionHeading
        icon="sliders"
        title="Moves into work (illustrative)"
        subtitle={SCENARIOS_SUBTITLE}
      />
      {/* The assumption and the link to how it was chosen, in one line */}
      <p className="milburn-assumption" role="note">
        <TitleIcon name="info" bare size={16} className="milburn-assumption-icon" />
        <span className="milburn-assumption-text">
          <span>{SCENARIOS_LABEL}</span>
          {" · "}
          <MethodLink anchor={ENTRY_METHOD_ANCHOR}>Why this path</MethodLink>
        </span>
      </p>
      {lead}
      {entry && review && <ReviewComparison entry={entry} year={shownYear} review={review} catalogue={catalogue} />}
      {entry && reviewState.status === "unavailable" && (
        <div className="milburn-unavailable" role="status">
          <p>The review&rsquo;s own figures are not available: their data file has not been published.</p>
        </div>
      )}
      {cases}
      <BreakEvenSection
        runId={selectedRun}
        catalogue={catalogue}
        summaryState={summaryState}
        review={review}
        gainYear={file.status === "ready" ? file.data.year : null}
      />
    </div>
  );
}
