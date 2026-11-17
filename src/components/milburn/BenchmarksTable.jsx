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
  differentBasis as differentBasisFor,
  estimateFor,
  figureRange,
  figureShare,
  parseBenchmarks,
  splitValue,
  valueParts,
} from "../../utils/milburn/benchmarks";
import { SourceLinkChip, shortSource } from "./SourceChip";
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

/** The gap in words, to the nearest whole per cent: "14% lower", "33% higher", "within 1%". */
export const gapText = (gapPct) =>
  Math.round(Math.abs(gapPct)) === 0 ? "within 1%" : `${Math.round(Math.abs(gapPct))}% ${gapPct < 0 ? "lower" : "higher"}`;

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

/** A note that only names the figure's source again ("Resolution Foundation analysis" beside a Resolution Foundation chip). */
export function repeatsSource(note, source) {
  const words = String(note || "").trim().toLowerCase();
  if (!words) return true;
  const names = [source, shortSource(source)].map((name) => String(name || "").trim().toLowerCase()).filter(Boolean);
  return names.some((name) => words.startsWith(name) && !/[:;]/.test(words));
}

/** The one note a card carries: what the figure's wording adds after its number, else its basis, unless that only repeats the source. */
function cardNote(row, published, short) {
  if (published.note) return published.note;
  const basis = short.basis ?? row.basis;
  return repeatsSource(basis, row.source) ? "" : basis;
}

/** A build label without its build id: "PolicyEngine, build fcfac709, 2029-30" as "2029-30". */
export const oursLabel = (label) => String(label || "").replace(/^PolicyEngine, build [^,]+,\s*/, "");

/** A figure as worded, its number large and the qualifier after it ("in 2036-37", "a year") small beside it. */
function Value({ value }) {
  const { main, qualifier } = valueParts(value);
  return (
    <span className="bm-value">
      <span className="bm-value-main">{main}</span>
      {qualifier && (
        <>
          {" "}
          <span className="bm-qualifier">{qualifier}</span>
        </>
      )}
    </span>
  );
}

/** A card's one muted note line; the file's full wording is its tooltip. */
function Note({ text, full }) {
  if (!text) return null;
  return (
    <p className="bm-note" title={full || text}>
      {text}
    </p>
  );
}

/** A card's last line: the source and its date as one chip-link, a press-report badge, and what our own figure is. */
function Foot({ row, ours, oursFull }) {
  if (!row.source && !row.date && !row.pressReport && !ours) return null;
  return (
    <p className="bm-foot">
      <SourceLinkChip source={row.source} url={row.url} date={row.date} />
      {row.pressReport && (
        <span className="bm-press">
          <TitleIcon name="newspaper" bare size={12} />
          Press report
        </span>
      )}
      {ours && (
        <span className="bm-ours" title={oursFull || undefined}>
          Ours: {ours}
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
  // A pair that counts different things is drawn without a gap
  const differentBasis = differentBasisFor(row.id);
  // Room right of the plot for the longest bar's own label
  const labelRoom = Math.ceil(Math.max(...bars.map((bar) => tickTextWidth(bar.text, 12)))) + 12;
  return (
    <li className="bm-compare" data-benchmark={row.id}>
      <h4 title={row.figure}>
        <TitleIcon name={short.icon ?? BENCHMARK_ICON} />
        <span className="title-text">{title}</span>
      </h4>
      {/* One verdict: how the two differ, or the gap where they count the same thing */}
      {differentBasis ? (
        <p className="bm-verdict" data-different-basis="">
          <TitleIcon name="scale" bare size={14} />
          <span>Not like for like: {differentBasis}</span>
        </p>
      ) : (
        <p className="bm-verdict">
          <TitleIcon name={Math.round(Math.abs(gap)) === 0 ? "equal" : gap < 0 ? "arrowDown" : "arrowUp"} bare size={14} />
          <span>
            {Math.abs(gap) < 10 ? "Close: " : ""}PolicyEngine is <strong>{gapText(gap)}</strong>
          </span>
        </p>
      )}
      {/* The chart is hidden from screen readers: both figures in words */}
      <p className="visually-hidden">
        Published: <span>{published.value}</span>. PolicyEngine estimate: <span>{row.estimate.fixed}</span>.
      </p>
      <div className="chart-plot bm-compare-plot" aria-hidden="true">
        <ResponsiveContainer width="100%" height={112}>
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
      {/* Why the two differ, where the file says */}
      {row.estimate.note && (
        <p className="bm-why" data-gap-note="">
          <TitleIcon name="info" bare size={13} />
          <span>{row.estimate.note}</span>
        </p>
      )}
      <Note text={cardNote(row, published, short)} full={row.basis} />
      {/* Our saving from a measure, apart from the pair: never set against spending */}
      {row.saving && (
        <p className="bm-separate" data-separate="" title={row.saving.basis || undefined}>
          <TitleIcon name="calculator" bare size={13} />
          <span>
            {row.saving.label}: <strong>{row.saving.value}</strong>
          </span>
        </p>
      )}
      <Foot row={row} ours={oursLabel(row.estimate.label)} oursFull={row.estimate.basis} />
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
 * One figure with no comparable pair as a stat tile: its icon beside the
 * figure (published, or PolicyEngine's alone), its one-line title, a small
 * graphic where its wording is a range or a share, one note and its source.
 */
function StatTile({ row, estimate, yearLabel }) {
  const short = BENCHMARK_SHORT[row.id] ?? {};
  const published = splitValue(row.value);
  const hasEstimate = Boolean(row.estimate?.fixed) || estimate !== null;
  const range = figureRange(published.value);
  const share = figureShare(published.value);
  const estimateKicker = (
    <span className="bm-kicker">
      <TitleIcon name="calculator" bare size={12} /> PolicyEngine estimate{!row.estimate?.fixed && yearLabel ? `, ${yearLabel}` : ""}
    </span>
  );
  const estimateValue = hasEstimate ? <Value value={row.estimate.fixed || thousands(estimate)} /> : null;
  // What our own figure is, on the last line: its short basis, else its year
  const ours = hasEstimate ? short.estimateBasis ?? (row.estimate.fixed ? oursLabel(row.estimate.label) : row.estimate.label) : "";
  return (
    <li className={`bm-tile${published.value ? "" : " is-estimate"}`} data-benchmark={row.id}>
      {/* Laid out as the comparison panels (Vahid, 17 Nov): icon and title, the figure in a band, its graphic */}
      <h4 title={row.figure}>
        <TitleIcon name={short.icon ?? BENCHMARK_ICON} />
        <span className="title-text">{short.label ?? row.figure}</span>
      </h4>
      {published.value && (
        <p className="bm-figure">
          <span className="bm-kicker">
            <TitleIcon name="fileText" bare size={12} /> Published
          </span>
          <Value value={published.value} />
        </p>
      )}
      {hasEstimate && (
        <p className="bm-figure is-estimate">
          {estimateKicker}
          {estimateValue}
        </p>
      )}
      {range && <RangeBars points={range} />}
      {share && <SharePictogram share={share} />}
      <Note text={published.value ? cardNote(row, published, short) : ""} full={row.basis} />
      <Foot row={row} ours={ours} oursFull={row.estimate?.basis || row.estimate?.label} />
    </li>
  );
}

/**
 * Population impact's Benchmarks sub-tab: published figures on young
 * people and work, in sections named for the question each answers. A
 * figure PolicyEngine has a comparable number for is a comparison chart
 * (two bars in the pair's own unit, with one verdict line); every other
 * figure is a stat tile, with one note, its source and date, and a
 * PolicyEngine estimate where the results have one. Build ids are in the
 * folded notes.
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
    const comparisons = new Map(data.rows.map((row) => [row.id, comparisonFor(row)]));
    const groups = benchmarkGroups(data.rows);
    // The builds our fixed figures come from, once, in the folded notes
    const builds = [...new Set(data.rows.map((row) => (row.estimate?.fixed ? row.estimate.label : "")).filter(Boolean))];
    body = (
      <section className="report-section bm" aria-label="Benchmarks">
        {groups.map((group) => {
          const pairs = group.rows.filter((row) => comparisons.get(row.id));
          const tiles = group.rows.filter((row) => !comparisons.get(row.id));
          return (
            <div key={group.key} className="bm-group" data-section={group.key}>
              <div className="bm-group-head">
                <h3>
                  <TitleIcon name={group.icon} />
                  <span className="title-text">{group.title}</span>
                </h3>
                <p>{group.intro}</p>
              </div>
              {pairs.length > 0 && (
                <ul className="bm-compare-grid">
                  {pairs.map((row) => (
                    <ComparePanel key={row.id} row={row} comparison={comparisons.get(row.id)} />
                  ))}
                </ul>
              )}
              {tiles.length > 0 && (
                <ul className="bm-tiles">
                  {tiles.map((row) => (
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
              )}
            </div>
          );
        })}
        <details className="milburn-details bm-about">
          <summary>
            <TitleIcon name="info" bare size={14} />
            About these figures
          </summary>
          <ul className="milburn-points">
            <li>
              <TitleIcon name="calculator" bare size={14} />
              <span>PolicyEngine estimates are static.{builds.length > 0 ? ` Builds: ${builds.join("; ")}.` : ""}</span>
            </li>
            <li>
              <TitleIcon name="hbars" bare size={14} />
              <span>Each pair of bars is on its own scale, from zero.</span>
            </li>
            <li>
              <TitleIcon name="scale" bare size={14} />
              <span>Where a pair still differs in date or area, it says so and gives no gap. Our savings from the measures are shown apart, never against spending.</span>
            </li>
            <li>
              <TitleIcon name="percent" bare size={14} />
              <span>Gap: the PolicyEngine estimate less the published figure, as a % of the published figure, to the nearest whole per cent; given only where the two count the same ages, area, year and measure (“close” is within 10%).</span>
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
