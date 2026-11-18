import { useRef } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartDownloadMenu from "../ChartDownloadMenu";
import { TOOLTIP_PROPS } from "../ChartTooltip";
import TitleIcon from "../TitleIcon";
import { CHART_LOGO } from "../../utils/chartLogo";
import { openPopulationSub, populationSubHref } from "../../utils/populationSub";
import {
  AXIS_LINE,
  BAR_RADIUS,
  CHART_COLOURS,
  GRID_PROPS,
  HOVER_CURSOR,
  REFERENCE_DASH,
  TICK_STYLE,
  TOOLTIP_CONTENT_STYLE,
  UNSELECTED_OPACITY,
  axisWidth,
  fiscalYearTick,
  zeroBasedAxis,
} from "../../utils/chartTheme";
import "./milburn.css";

const LABEL_STYLE = { ...TICK_STYLE, fill: CHART_COLOURS.text, fontWeight: 600 };
const REFERENCE_LABEL_STYLE = { ...TICK_STYLE, fill: CHART_COLOURS.axisTitle };
/** The height a reference line's name takes over the plot (px). */
const REFERENCE_LABEL_ROW = 16;

/**
 * A chart card as the other tabs draw theirs: the title with its icon, one
 * line under it, the download menu (CSV, PNG and SVG), the plot and the
 * logo. `single` says the card holds one Recharts chart. `after` goes under the logo (notes,
 * the figures as a table).
 */
export function MilburnChartCard({ as: Heading = "h3", id, icon, title, description, name, csv, single = false, legendItems = [], className = "", children, after, logo = true }) {
  const chartRef = useRef(null);
  const download = csv
    ? {
        chartRef,
        name,
        csv,
        exportOptions: {
          title,
          description: typeof description === "string" ? description : undefined,
          logo: CHART_LOGO,
          reservedLegendHeight: 0,
          legendItems,
          // Several charts in panels: the image is the plot as the page
          // draws it (exportDomAsSvg), not the first chart alone
          ...(single ? {} : { svgSelector: "[data-single-chart] svg" }),
        },
      }
    : null;
  return (
    <div className={`milburn-chart ${className}`.trim()}>
      <div className="chart-header">
        <div>
          <Heading id={id}>
            <TitleIcon name={icon} />
            <span className="title-text">{title}</span>
          </Heading>
          {description && <p className="chart-description">{description}</p>}
        </div>
        {download && <ChartDownloadMenu download={download} chartTitle={title} />}
      </div>
      <div ref={chartRef} className="chart-plot milburn-chart-plot">
        {children}
      </div>
      {legendItems.length > 0 && (
        <ul className="milburn-chart-legend">
          {legendItems.map((item) => (
            <li key={item.label}>
              <i style={{ background: item.color, opacity: item.opacity }} aria-hidden="true" />
              {item.label}
            </li>
          ))}
        </ul>
      )}
      {/* The logo marks a plot; cards of text or tables go without (Vahid, 18 Nov) */}
      {logo && (
        <div className="chart-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={CHART_LOGO.href} alt="PolicyEngine" />
        </div>
      )}
      {after}
    </div>
  );
}

/**
 * A headline box's Download menu (CSV, PNG and SVG), as the chart cards'
 * menus: the CSV from `csv`, the image the element in `targetRef` (the
 * box's figures, not its notes) redrawn from the page (exportDomAsSvg) in
 * the frame, with the logo, whether or not the page shows one there.
 */
export function BoxDownload({ title, name, csv, targetRef }) {
  return (
    <ChartDownloadMenu
      download={{ chartRef: targetRef, name, csv, exportOptions: { title, logo: CHART_LOGO } }}
      chartTitle={title}
    />
  );
}

/** A link to another Impact sub-tab, switched to in place (openPopulationSub); a real link for a new tab. */
export function SubTabLink({ sub, children }) {
  return (
    <a
      href={populationSubHref(sub)}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        openPopulationSub(sub);
      }}
    >
      {children}
    </a>
  );
}

/** A bar's figure just past its end, on one line whatever the bar's length. */
function EndLabel({ x, y, width, height, value }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <text x={x + width + 6} y={y + height / 2} dominantBaseline="central" style={LABEL_STYLE}>
      {value}
    </text>
  );
}

/** A small titled panel holding one chart of a card with several. */
export function ChartPanel({ icon, title, chip, chipTone = "flat", children }) {
  return (
    <div className="milburn-chart-panel">
      <p className="milburn-chart-panel-title">
        <TitleIcon name={icon} bare size={14} />
        <span>{title}</span>
        {chip && <span className={`milburn-delta ${chipTone}`}>{chip}</span>}
      </p>
      {children}
    </div>
  );
}

/**
 * Horizontal bars, one per row, each labelled with its figure at its end:
 * `rows` are { name, value, label, color?, faded? }; `references` are
 * dashed lines across the plot, { value, label }, each named over the plot.
 */
export function HorizontalBars({ rows, format, references = [], color = CHART_COLOURS.gain, ariaLabel, labelWidth, rowHeight = 40 }) {
  const shown = rows.filter((row) => Number.isFinite(row.value));
  if (!shown.length) return <p className="milburn-chart-empty" role="status">Not in the summary.</p>;
  const { domain, ticks } = zeroBasedAxis([...shown.map((row) => row.value), ...references.map((reference) => reference.value)]);
  const longest = Math.max(...shown.map((row) => String(row.label).length), 1);
  // Each reference line's name sits on its own row over the plot, so two lines close together both read
  const labelRows = references.length * REFERENCE_LABEL_ROW;
  const height = shown.length * rowHeight + 34 + (references.length ? 6 + labelRows : 0);
  return (
    <div role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={shown} layout="vertical" margin={{ top: references.length ? 8 + labelRows : 4, right: longest * 7 + 14, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid {...GRID_PROPS} vertical horizontal={false} />
          <XAxis type="number" domain={domain} ticks={ticks} tick={TICK_STYLE} axisLine={AXIS_LINE} tickLine={false} tickFormatter={format} />
          <YAxis
            type="category"
            dataKey="name"
            width={labelWidth ?? axisWidth(shown.map((row) => row.name), String, { title: false })}
            tick={TICK_STYLE}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <Tooltip
            {...TOOLTIP_PROPS}
            cursor={HOVER_CURSOR}
            contentStyle={TOOLTIP_CONTENT_STYLE}
            formatter={(value, key, item) => [item?.payload?.label ?? format(value), item?.payload?.tip ?? ""]}
            separator=""
          />
          <Bar dataKey="value" radius={[0, BAR_RADIUS, BAR_RADIUS, 0]} isAnimationActive={false}>
            {shown.map((row) => (
              <Cell key={row.name} fill={row.color ?? color} fillOpacity={row.faded ? UNSELECTED_OPACITY : 1} />
            ))}
            <LabelList dataKey="label" content={EndLabel} />
          </Bar>
          {references.map((reference, index) => (
            <ReferenceLine
              key={reference.label}
              x={reference.value}
              stroke={CHART_COLOURS.reference}
              strokeDasharray={REFERENCE_DASH}
              label={{ value: reference.label, position: "top", offset: 5 + index * REFERENCE_LABEL_ROW, style: REFERENCE_LABEL_STYLE }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** The figures a chart draws, as a table, folded away under it. */
export function FiguresTable({ children, label = "Figures as a table" }) {
  return (
    <details className="milburn-details">
      <summary>
        <TitleIcon name="list" bare size={14} />
        {label}
      </summary>
      <div className="milburn-table-wrap">{children}</div>
    </details>
  );
}

/** What the year-only chip says of a box whose figures are for one year. */
export const yearOnlyText = (year, what = "these figures") => `${fiscalYearTick(year)} only: the year selector does not change ${what}.`;

/**
 * The chip on a box whose figures are for the summary's year whatever year
 * is chosen above the page: "2027-28 only", with the reason beside it.
 */
export function YearOnlyChip({ year, what }) {
  if (!Number.isInteger(year)) return null;
  return (
    <p className="milburn-status-chip milburn-year-only" data-year-only="" role="note">
      <TitleIcon name="calendar" bare size={14} />
      {yearOnlyText(year, what)}
    </p>
  );
}
