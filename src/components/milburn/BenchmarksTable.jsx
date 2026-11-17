import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Tooltip } from "../ViewportTooltip";
import { TOOLTIP_PROPS } from "../ChartTooltip";
import SectionHeading from "../SectionHeading";
import TitleIcon from "../TitleIcon";
import { useMeasureCatalogue } from "../../utils/measureCatalogue";
import { AXIS_LINE, CHART_COLOURS, GRID_PROPS, HOVER_CURSOR, TICK_STYLE, barShape, fiscalYearTick, tickTextWidth, zeroBasedAxis } from "../../utils/chartTheme";
import { chartMotion } from "../../utils/chartMotion";
import { useAgeImpactRows } from "../YoungPeopleSection";
import {
  BENCHMARKS_FILE,
  BENCHMARK_ICON,
  BENCHMARK_SHORT,
  benchmarkGroups,
  comparisonFor,
  estimateFor,
  figureRange,
  figureShare,
  parseBenchmarks,
  splitValue,
} from "../../utils/milburn/benchmarks";
import { usePackageTable } from "../../utils/milburn/packageRun";
import "./milburn.css";
import "./BenchmarksTable.css";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Rounded to the nearest thousand: survey estimates carry no finer precision. */
const thousands = (value) =>
  (Math.round(value / 1000) * 1000).toLocaleString("en-GB", { maximumFractionDigits: 0 });

/** The two series of a comparison chart, the same on every panel. */
const SERIES = {
  published: { name: "Published", colour: CHART_COLOURS.reference },
  estimate: { name: "PolicyEngine", colour: CHART_COLOURS.gain },
};

/** A comparison axis's tick: "200k" for a count, "£4bn" for £ billion. */
export const compareTick = (unit) => (value) =>
  unit === "bn" ? `£${value.toLocaleString("en-GB")}bn` : value === 0 ? "0" : `${(value / 1000).toLocaleString("en-GB")}k`;

/** The gap in words: "10.77% lower", "3.00% higher", "the same". */
export const gapText = (gapPct) =>
  Math.abs(gapPct) < 0.005 ? "the same" : `${Math.abs(gapPct).toFixed(2)}% ${gapPct < 0 ? "lower" : "higher"}`;

function useBenchmarksFile() {
  const [state, setState] = useState({ status: "loading", data: null });
  useEffect(() => {
    let cancelled = false;
    fetch(`${BASE}/data/${BENCHMARKS_FILE}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        const data = parseBenchmarks(json);
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

/** A figure's one-line notes, each behind its own icon; the file's full wording is the line's tooltip. */
function Notes({ items }) {
  const shown = items.filter((item) => item.text);
  if (shown.length === 0) return null;
  return (
    <ul className="bm-notes">
      {shown.map((item) => (
        <li key={`${item.icon}-${item.text}`} title={item.full || item.text}>
          <TitleIcon name={item.icon} bare size={13} />
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Where a figure comes from, as chips: the source (a link), its date, a press-report badge and the PolicyEngine build. */
function SourceChips({ row, build }) {
  if (!row.source && !row.date && !row.pressReport && !build) return null;
  return (
    <p className="bm-chips">
      {row.source &&
        (row.url ? (
          <a className="bm-chip is-link" href={row.url} target="_blank" rel="noopener noreferrer" title={row.source}>
            <TitleIcon name="link" bare size={12} />
            <span className="bm-chip-text">{row.source}</span>
            <TitleIcon name="externalLink" bare size={11} />
            <span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        ) : (
          <span className="bm-chip">
            <TitleIcon name="fileText" bare size={12} />
            <span className="bm-chip-text">{row.source}</span>
          </span>
        ))}
      {row.date && (
        <span className="bm-chip is-plain">
          <TitleIcon name="calendar" bare size={12} />
          {row.date}
        </span>
      )}
      {row.pressReport && (
        <span className="bm-chip is-press">
          <TitleIcon name="newspaper" bare size={12} />
          Press report
        </span>
      )}
      {build && (
        <span className="bm-chip is-build">
          <TitleIcon name="calculator" bare size={12} />
          {build}
        </span>
      )}
    </p>
  );
}

function CompareTooltip({ active, payload, title }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{title}</p>
      <p className="chart-tooltip-row">
        <span className="chart-tooltip-swatch" style={{ background: point.colour }} aria-hidden="true" />
        <span>{point.name}</span>
        <span className="chart-tooltip-value">{point.full}</span>
      </p>
      {point.basis && <p className="chart-tooltip-note">{point.basis}</p>}
    </div>
  );
}

const COMPARE_BAR_SHAPE = barShape(["value"], { layout: "vertical" });

/**
 * One comparable pair as a panel: the published figure and the PolicyEngine
 * estimate as two bars on an axis from zero in the pair's own unit, the gap
 * between them as a % of the published figure, and both figures in text
 * (the chart is hidden from screen readers).
 */
function ComparePanel({ row, comparison }) {
  const short = BENCHMARK_SHORT[row.id] ?? {};
  const title = short.label ?? row.figure;
  const published = splitValue(row.value);
  const bars = [
    { ...SERIES.published, value: comparison.published, text: comparison.publishedText, full: published.value, basis: row.basis },
    { ...SERIES.estimate, value: comparison.estimate, text: comparison.estimateText, full: row.estimate.fixed, basis: row.estimate.basis },
  ];
  const { domain, ticks } = zeroBasedAxis(bars.map((bar) => bar.value));
  const tick = compareTick(comparison.unit);
  const gap = comparison.gapPct;
  // Room right of the plot for the longest bar's own label
  const labelRoom = Math.ceil(Math.max(...bars.map((bar) => tickTextWidth(bar.text, 12)))) + 12;
  return (
    <li className="bm-compare" data-benchmark={row.id}>
      <div className="bm-compare-head">
        <h4 title={row.figure}>
          <TitleIcon name={short.icon ?? BENCHMARK_ICON} />
          <span className="title-text">{title}</span>
        </h4>
        <p className="bm-gap">
          <TitleIcon name={Math.abs(gap) < 0.005 ? "equal" : gap < 0 ? "arrowDown" : "arrowUp"} bare size={13} />
          <span>
            PolicyEngine is <strong>{gapText(gap)}</strong>
          </span>
        </p>
      </div>
      <dl className="bm-pair">
        <div className="bm-pair-figure">
          <dt>
            <span className="bm-swatch is-published" aria-hidden="true" />
            Published
          </dt>
          <dd>{published.value}</dd>
        </div>
        <div className="bm-pair-figure is-estimate">
          <dt>
            <span className="bm-swatch is-estimate" aria-hidden="true" />
            PolicyEngine estimate
          </dt>
          <dd>{row.estimate.fixed}</dd>
        </div>
      </dl>
      <div className="chart-plot bm-compare-plot" aria-hidden="true">
        <ResponsiveContainer width="100%" height={128}>
          <BarChart data={bars} layout="vertical" margin={{ top: 4, right: labelRoom, left: 0, bottom: 0 }} barCategoryGap="24%">
            <CartesianGrid {...GRID_PROPS} vertical horizontal={false} />
            <XAxis
              type="number"
              domain={domain}
              ticks={ticks}
              tick={TICK_STYLE}
              axisLine={AXIS_LINE}
              tickLine={false}
              tickFormatter={tick}
            />
            <YAxis type="category" dataKey="name" width={84} tick={TICK_STYLE} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_PROPS} cursor={HOVER_CURSOR} content={<CompareTooltip title={title} />} />
            <Bar dataKey="value" shape={COMPARE_BAR_SHAPE} {...chartMotion()}>
              {bars.map((bar) => (
                <Cell key={bar.name} fill={bar.colour} />
              ))}
              <LabelList dataKey="text" position="right" offset={6} fill={CHART_COLOURS.text} fontSize={12} fontWeight={600} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Notes
        items={[
          { icon: "pin", text: published.note },
          { icon: "book", text: short.basis ?? row.basis, full: row.basis },
          { icon: "calculator", text: short.estimateBasis ?? row.estimate.basis, full: row.estimate.basis },
        ]}
      />
      <SourceChips row={row} build={row.estimate.label} />
    </li>
  );
}

/** Two dated points ("£1.3bn (2022) to £2.0bn (2025)") as two bars from zero; the figures are in the tile's value. */
function RangeBars({ points }) {
  const max = Math.max(...points.map((point) => point.number));
  return (
    <div className="bm-range" aria-hidden="true">
      {points.map((point, index) => (
        <div key={point.label} className="bm-range-row">
          <span className="bm-range-label">{point.label}</span>
          <span className="bm-range-track">
            <span
              className={`bm-range-fill${index === points.length - 1 ? " is-latest" : ""}`}
              style={{ width: `${max > 0 ? (point.number / max) * 100 : 0}%` }}
            />
          </span>
          <span className="bm-range-value">{point.text}</span>
        </div>
      ))}
    </div>
  );
}

/** "1 in 5" as five people, one filled; the figure is in the tile's value. */
function SharePictogram({ share }) {
  return (
    <div className="bm-share" aria-hidden="true">
      {Array.from({ length: share.of }, (_, index) => (
        <span key={index} className={`bm-share-person${index < share.count ? " is-counted" : ""}`}>
          <TitleIcon name="user" bare size={22} />
        </span>
      ))}
    </div>
  );
}

/**
 * One figure with no comparable pair as a stat tile: its icon, the figure
 * (published, or PolicyEngine's alone), a small graphic where its wording
 * is a range or a share, its notes and its source.
 */
function StatTile({ row, estimate, yearLabel }) {
  const short = BENCHMARK_SHORT[row.id] ?? {};
  const published = splitValue(row.value);
  const hasEstimate = Boolean(row.estimate?.fixed) || estimate !== null;
  const range = figureRange(published.value);
  const share = figureShare(published.value);
  return (
    <li className={`bm-tile${published.value ? "" : " is-estimate"}`} data-benchmark={row.id}>
      <span className="bm-tile-icon" aria-hidden="true">
        <TitleIcon name={short.icon ?? BENCHMARK_ICON} bare size={20} />
      </span>
      <h4 title={row.figure}>{short.label ?? row.figure}</h4>
      <div className="bm-tile-figures">
        {published.value && (
          <p className="bm-figure">
            <span className="bm-kicker">
              <TitleIcon name="fileText" bare size={12} /> Published
            </span>
            <span className="bm-value">{published.value}</span>
          </p>
        )}
        {hasEstimate && (
          <p className="bm-figure is-estimate">
            <span className="bm-kicker">
              <TitleIcon name="calculator" bare size={12} />{" "}
              {row.estimate.fixed ? "PolicyEngine estimate" : `PolicyEngine estimate${yearLabel ? `, ${yearLabel}` : ""}`}
            </span>
            <span className="bm-value">{row.estimate.fixed || thousands(estimate)}</span>
          </p>
        )}
      </div>
      {range && <RangeBars points={range} />}
      {share && <SharePictogram share={share} />}
      <Notes
        items={[
          { icon: "pin", text: published.note },
          { icon: "book", text: short.basis ?? row.basis, full: row.basis },
          hasEstimate
            ? {
                icon: "calculator",
                text: short.estimateBasis ?? (row.estimate.basis || (row.estimate.fixed ? "" : row.estimate.label)),
                full: row.estimate.basis || row.estimate.label,
              }
            : { icon: "calculator", text: "" },
        ]}
      />
      <SourceChips row={row} build={hasEstimate && row.estimate.fixed ? row.estimate.label : ""} />
    </li>
  );
}

/**
 * Population impact's Benchmarks sub-tab: published figures on young
 * people and work. A figure PolicyEngine has a comparable number for is a
 * comparison chart (two bars in the pair's own unit, with the gap as a %);
 * every other figure is a stat tile under its theme, with its basis, source
 * and date, and a PolicyEngine estimate where the results have one.
 */
export default function BenchmarksTable() {
  const catalogue = useMeasureCatalogue();
  const file = useBenchmarksFile();
  const age = useAgeImpactRows(catalogue);
  const packageAge = usePackageTable(catalogue, "age_impact");

  let body;
  if (file.status === "loading") {
    body = (
      <p className="view-status" role="status">
        Loading benchmarks…
      </p>
    );
  } else if (file.status !== "ready") {
    body = (
      <div className="milburn-unavailable" role="status">
        <p>The benchmarks are not available.</p>
      </div>
    );
  } else {
    const { data } = file;
    const yearLabel = data.year === null ? "" : fiscalYearTick(data.year);
    const pairs = data.rows.map((row) => ({ row, comparison: comparisonFor(row) })).filter((pair) => pair.comparison);
    const paired = new Set(pairs.map((pair) => pair.row.id));
    const groups = benchmarkGroups(data.rows.filter((row) => !paired.has(row.id)));
    body = (
      <section className="report-section bm" aria-label="Benchmarks">
        <p className="milburn-label" role="note">
          <TitleIcon name="alert" bare size={14} />
          <span>Published figures, each with its own definition and date. PolicyEngine estimates are context, not a check.</span>
        </p>
        {pairs.length > 0 && (
          <div className="charts-stack">
            <div className="bm-compare-card">
              <div className="chart-header">
                <div>
                  <h3>
                    <TitleIcon name="hbars" />
                    <span className="title-text">Published figures beside PolicyEngine estimates</span>
                  </h3>
                  <p className="chart-description">
                    Each pair on its own scale from zero. The gap is the PolicyEngine estimate against the published figure.
                  </p>
                </div>
              </div>
              <ul className="bm-compare-grid">
                {pairs.map(({ row, comparison }) => (
                  <ComparePanel key={row.id} row={row} comparison={comparison} />
                ))}
              </ul>
            </div>
          </div>
        )}
        {groups.map((group) => (
          <div key={group.key} className="bm-group" data-theme={group.key}>
            <h3>
              <TitleIcon name={group.icon} />
              <span className="title-text">{group.title}</span>
              <span className="bm-count">
                {group.rows.length} {group.rows.length === 1 ? "figure" : "figures"}
              </span>
            </h3>
            <ul className="bm-tiles">
              {group.rows.map((row) => (
                <StatTile
                  key={row.id}
                  row={row}
                  yearLabel={yearLabel}
                  estimate={estimateFor(row, {
                    ageRows: age.rows,
                    packageRows: packageAge.rows,
                    packageKey: packageAge.key,
                    year: data.year,
                  })}
                />
              ))}
            </ul>
          </div>
        ))}
        <details className="milburn-details bm-about">
          <summary>
            <TitleIcon name="info" bare size={14} />
            About these figures
          </summary>
          <ul className="milburn-points">
            <li>
              <TitleIcon name="calculator" bare size={14} />
              <span>PolicyEngine estimates are static; each names its build and year.</span>
            </li>
            <li>
              <TitleIcon name="scale" bare size={14} />
              <span>They can count a different group or area from the published figure beside them.</span>
            </li>
            <li>
              <TitleIcon name="percent" bare size={14} />
              <span>Gap: the PolicyEngine estimate less the published figure, as a % of the published figure.</span>
            </li>
            <li>
              <TitleIcon name="newspaper" bare size={14} />
              <span>Press report: the figure as a news site reported it, not taken from the source itself.</span>
            </li>
            <li>
              <TitleIcon name="usersRound" bare size={14} />
              <span>
                Package figure: people aged 16 to 24 in households whose income falls (
                {catalogue.localBuild ? "local build" : "verified"} run).
              </span>
            </li>
          </ul>
        </details>
      </section>
    );
  }

  return (
    <div className="results-container milburn-benchmarks">
      <SectionHeading
        icon="scale"
        title="Benchmarks"
        subtitle="Published figures beside PolicyEngine estimates, with sources."
      />
      {body}
    </div>
  );
}
