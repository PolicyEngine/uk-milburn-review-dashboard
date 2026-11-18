import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import TitleIcon from "../TitleIcon";
import { TOOLTIP_PROPS } from "../ChartTooltip";
import { FiguresTable, MilburnChartCard } from "./MilburnCharts";
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
  fiscalYearTick,
  legendLabelStyle,
} from "../../utils/chartTheme";
import {
  ENTRY_GROUP,
  ENTRY_METHOD_SENTENCE,
  ENTRY_PATHS,
  ENTRY_WORK,
  NINE_PER_CENT_SENTENCE,
  NO_CHANGE_SENTENCE,
  PAIRING_SENTENCE,
  RELATIVE_APPROXIMATE_SENTENCE,
  REPLACEMENTS_SENTENCE,
  REVIEW_FIGURE_CAVEAT,
  pathYear,
  shareText,
} from "../../utils/milburn/entryPath";
import { formatBn, formatPeople, formatSignedPp } from "../../utils/milburn/summary";

/** Said in place of a figure the file withholds. */
export const FIGURE_WITHHELD = "Withheld";

/** The heading over what the scenario changes. */
export const ENTRY_RUN_HEADING = "What the scenario changes";

/** A bullet with an icon. */
function Point({ icon = "pin", children, ...rest }) {
  return (
    <li {...rest}>
      <TitleIcon name={icon} bare size={14} />
      <span>{children}</span>
    </li>
  );
}

/**
 * What the scenario does in a year, a point each: who moves and how many
 * (left out when withheld), into what work, what the Exchequer figure
 * counts, and how the figures are made.
 */
export function entryRunPoints(central, flat, yearLabel) {
  const movers = central?.movers;
  return [
    `Who moves: ${ENTRY_GROUP}. None before April 2029; in ${yearLabel}, ${shareText(central?.share)} of them on the phased path${
      movers ? ` (about ${formatPeople(movers)} people)` : ""
    }, or ${shareText(flat?.share)} with no ramp.`,
    `Each moves from no work into ${ENTRY_WORK}. Each year's figure is that year's share of that year's group in work.`,
    "The Exchequer figure counts the fall in their benefits and any tax on their earnings.",
    ENTRY_METHOD_SENTENCE,
  ];
}

const missing = (value) => value === null || value === undefined;
const bnText = (value) => (missing(value) ? FIGURE_WITHHELD : formatBn(value));
const ppText = (value) => (missing(value) ? FIGURE_WITHHELD : formatSignedPp(value));
const pctText = (value) => (missing(value) ? FIGURE_WITHHELD : `${value.toFixed(2)}%`);
const peopleText = (value) => (missing(value) ? "" : ` (${value < 0 ? "−" : "+"}${formatPeople(Math.abs(value))})`);

/** The year's table: each figure, for the static package and on each path. */
export function entryPathRows(data, year) {
  const figures = ENTRY_PATHS.map((path) => pathYear(data, path.id, year));
  const central = figures[0];
  const rollout = figures[ENTRY_PATHS.findIndex((path) => path.id === "rollout")];
  const text = (figure, key, side, format, people) => {
    const value = figure?.[key]?.[side];
    return missing(value) ? FIGURE_WITHHELD : `${format(value)}${people ? peopleText(figure?.[people]?.[side]) : ""}`;
  };
  const row = (key, label, format, people) => ({
    key,
    label,
    static: text(central, key, "static", format, people),
    phasedStatic: text(rollout, key, "static", format, people),
    paths: figures.map((figure) => text(figure, key, "scenario", format, people)),
  });
  return [
    row("exchequer", "Exchequer saving", bnText),
    row("povertyAbs", "Absolute poverty before housing costs, all ages (pp)", ppText, "peopleAbs"),
    row("youngLosing", "16–24s in losing households (%)", pctText),
  ];
}

const COLOURS = { central: CHART_COLOURS.after, flat: CHART_COLOURS.before, rollout: CHART_COLOURS.highlight };

/**
 * The share assumed in work and the movers, by year, on each path, beside
 * the review's NEET gap the phased path takes its timing from.
 */
export function EntryShares({ data }) {
  const years = data.years;
  const charted = ENTRY_PATHS.filter((path) => COLOURS[path.id]);
  const chartData = years.map((year) => {
    const point = { year: fiscalYearTick(year) };
    for (const path of charted) {
      const share = pathYear(data, path.id, year)?.share;
      point[path.id] = missing(share) ? null : Math.round(share * 1000) / 10;
    }
    return point;
  });
  const title = "Share assumed in work, by year";
  const csv = () =>
    buildChartCsv({
      title,
      units: `Share of ${ENTRY_GROUP} assumed in work (%), and people. ${ENTRY_METHOD_SENTENCE}`,
      columns: [
        { key: "year", label: "Year" },
        ...ENTRY_PATHS.flatMap((path) => [
          { key: `${path.id}_share`, label: `${path.label}: share (%)`, decimals: 2 },
          { key: `${path.id}_movers`, label: `${path.label}: people` },
        ]),
        { key: "gap", label: "Review's NEET gap, whole package (pp)", decimals: 1 },
      ],
      rows: years.map((year) => ({
        year: fiscalYearTick(year),
        ...Object.fromEntries(
          ENTRY_PATHS.flatMap((path) => {
            const figure = pathYear(data, path.id, year);
            return [
              [`${path.id}_share`, missing(figure?.share) ? null : figure.share * 100],
              [`${path.id}_movers`, figure?.movers ?? null],
            ];
          }),
        ),
        gap: data.neetGap[year] ?? null,
      })),
    });
  return (
    <section className="report-section milburn-entry" aria-labelledby="milburn-entry-shares-heading">
      <MilburnChartCard
        id="milburn-entry-shares-heading"
        icon="briefcase"
        title={title}
        description={`The share of ${ENTRY_GROUP} assumed in work in each year: an assumption built from two of the review's figures, not an estimate.`}
        name="share-assumed-in-work"
        csv={csv}
        legendItems={charted.map((path) => ({ color: COLOURS[path.id], label: path.label, type: "rect" }))}
        after={
          <>
            <FiguresTable>
              <table className="milburn-table" data-entry-shares="">
                <thead>
                  <tr>
                    <th scope="col">Year</th>
                    {ENTRY_PATHS.map((path) => (
                      <th key={path.id} scope="col">
                        {path.label}
                      </th>
                    ))}
                    <th scope="col">Review&rsquo;s NEET gap, whole package</th>
                  </tr>
                </thead>
                <tbody>
                  {years.map((year) => (
                    <tr key={year} data-year={year}>
                      <th scope="row">{fiscalYearTick(year)}</th>
                      {ENTRY_PATHS.map((path) => {
                        const figure = pathYear(data, path.id, year);
                        const movers = figure?.movers;
                        const people = movers ? ` (about ${formatPeople(movers)})` : missing(movers) && figure?.share ? ` (people ${FIGURE_WITHHELD.toLowerCase()})` : "";
                        return (
                          <td key={path.id}>
                            {shareText(figure?.share)}
                            {people}
                          </td>
                        );
                      })}
                      <td>{missing(data.neetGap[year]) ? "" : `${data.neetGap[year].toFixed(1)}pp`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </FiguresTable>
            <details className="milburn-details" data-entry-path-notes="">
              <summary>
                <TitleIcon name="alert" bare size={14} />
                How the shares are set
              </summary>
              <ul className="milburn-points">
                <Point icon="percent">{NINE_PER_CENT_SENTENCE}</Point>
                <Point icon="calendar">{PAIRING_SENTENCE}</Point>
                <Point icon="calculator">Table 3 is rounded to one decimal place, so the 2029-30 phased share could be between about 0.9% and 1.6%.</Point>
                <Point icon="usersRound">
                  The with-PIP path applies the same shares to non-working 18 to 24-year-olds who have PIP but not the health element too. The annex states
                  its 9% for Universal Credit health claimants; it gives no figure for PIP recipients.
                </Point>
                <Point icon="layers">
                  The rollout path applies 9% to the group once the new rules reach them, on the phased package: new 18-year-olds at once, existing claimants
                  at an assumed 45% a year (our assumption), drawn at random, so its figures rest on that draw. Its share of the whole group is lower.
                </Point>
                <Point icon="info" data-review-caveat="">
                  {REVIEW_FIGURE_CAVEAT}
                </Point>
              </ul>
            </details>
          </>
        }
      >
        <div role="img" aria-label={`${title}: ${chartData.map((point) => `${point.year}: phased ${point.central}%, flat ${point.flat}%`).join("; ")}`}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={chartMargin()}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="year" tick={TICK_STYLE} axisLine={AXIS_LINE} />
              <YAxis tick={TICK_STYLE} axisLine={AXIS_LINE} width={axisWidth(["10%"])} tickFormatter={(value) => `${value}%`} domain={[0, 10]} />
              <Tooltip {...TOOLTIP_PROPS} contentStyle={TOOLTIP_CONTENT_STYLE} cursor={HOVER_CURSOR} formatter={(value) => (missing(value) ? "" : `${value}%`)} />
              <Legend wrapperStyle={{ paddingTop: "20px" }} formatter={(value) => <span style={legendLabelStyle()}>{value}</span>} />
              {charted.map((path) => (
                <Bar key={path.id} dataKey={path.id} name={path.label} fill={COLOURS[path.id]} radius={BAR_RADIUS} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </MilburnChartCard>
    </section>
  );
}

/**
 * The selected year: the static package beside each path's figures. Before
 * April 2029 there is nothing to compare, and the card says so.
 */
export function EntryYear({ data, year }) {
  const yearLabel = fiscalYearTick(year);
  const title = `Static and with the assumed move into work, ${yearLabel}`;
  if (data.startYear !== null && year < data.startYear) {
    return (
      <section className="report-section milburn-entry" aria-labelledby="milburn-entry-year-heading">
        <MilburnChartCard id="milburn-entry-year-heading" icon="scale" title={title} logo={false}>
          <p role="status" data-no-change="">
            {NO_CHANGE_SENTENCE}
          </p>
        </MilburnChartCard>
      </section>
    );
  }
  const rows = entryPathRows(data, year);
  const central = pathYear(data, "central", year);
  const flat = pathYear(data, "flat", year);
  const csv = () =>
    buildChartCsv({
      title,
      units: `As each row says. ${ENTRY_METHOD_SENTENCE}`,
      columns: [
        { key: "label", label: "Figure" },
        { key: "static", label: "Static package" },
        ...ENTRY_PATHS.map((path, index) => ({ key: `p${index}`, label: path.label })),
        { key: "phasedStatic", label: "Static phased package (the rollout path's comparator)" },
      ],
      rows: rows.map((row) => ({ ...row, ...Object.fromEntries(row.paths.map((value, index) => [`p${index}`, value])) })),
    });
  return (
    <section className="report-section milburn-entry" aria-labelledby="milburn-entry-year-heading">
      <MilburnChartCard
        id="milburn-entry-year-heading"
        icon="scale"
        title={title}
        description="The report's benefit changes, static and with each path's share moving into work. The rollout path is set against the phased package."
        name="static-and-with-the-move-into-work"
        csv={csv}
        logo={false}
        after={
          <details className="milburn-details" data-entry-run-comparison="">
            <summary>
              <TitleIcon name="alert" bare size={14} />
              {ENTRY_RUN_HEADING}
            </summary>
            <ul className="milburn-points">
              {entryRunPoints(central, flat, yearLabel).map((point, index) => (
                <Point key={point} icon={["usersRound", "briefcase", "wallet", "calculator"][index]}>
                  {point}
                </Point>
              ))}
              <Point icon="percent">{RELATIVE_APPROXIMATE_SENTENCE}</Point>
              <Point icon="layers">{REPLACEMENTS_SENTENCE}</Point>
              <Point icon="alert">
                The changes rest on a few hundred survey records, and poverty changes on tens of households; no sampling interval is given. A figure resting on
                too few survey households is withheld.
              </Point>
            </ul>
          </details>
        }
      >
        <div className="milburn-table-wrap">
          <table className="milburn-table" data-entry-year={year}>
            <thead>
              <tr>
                <th scope="col">Figure</th>
                <th scope="col">Static package</th>
                {ENTRY_PATHS.map((path) => (
                  <th key={path.id} scope="col">
                    {path.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} data-row={row.key}>
                  <th scope="row">{row.label}</th>
                  <td>{row.static}</td>
                  {row.paths.map((value, index) => (
                    <td key={ENTRY_PATHS[index].id}>{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="milburn-note" data-phased-static="">
          The rollout path is set against the phased package, static: {rows.map((row) => `${row.label} ${row.phasedStatic}`).join("; ")}.
        </p>
      </MilburnChartCard>
    </section>
  );
}
