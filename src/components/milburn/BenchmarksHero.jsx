import { MilburnChartCard } from "./MilburnCharts";
import TitleIcon from "../TitleIcon";
import { buildChartCsv } from "../../utils/chartCsv";
import { HERO_BAND_PCT, gapWords, heroSummary, signedGap } from "../../utils/milburn/benchmarks";

export const HERO_TITLE = "How close are our estimates?";

/** The axis's half-width in %: past the largest gap, in twenties, never under 20. */
export function heroDomain(rows) {
  const largest = Math.max(0, ...rows.filter((row) => row.likeForLike).map((row) => Math.abs(row.gapPct)));
  return Math.max(20, Math.ceil((largest + 2) / 20) * 20);
}

/** The axis's ticks: every 10% to ±20, else every 20%, always through 0. */
export function heroTicks(domain) {
  const step = domain > 20 ? 20 : 10;
  const ticks = [];
  for (let tick = -domain; tick <= domain; tick += step) ticks.push(tick);
  return ticks;
}

/** The hero's CSV: one row a pair, both figures as worded and the gap to the nearest whole per cent. */
export function heroCsv(rows) {
  return buildChartCsv({
    title: HERO_TITLE,
    units: "Gap: PolicyEngine estimate less the published figure, as a % of the published figure",
    source: "Published figures as cited on each card; PolicyEngine UK estimates",
    columns: [
      { key: "label", label: "Pair" },
      { key: "published", label: "Published" },
      { key: "estimate", label: "PolicyEngine" },
      { key: "gap", label: "Gap (%)", decimals: 0 },
      { key: "basis", label: "Like for like" },
    ],
    rows: rows.map((row) => ({
      label: row.label,
      published: row.published,
      estimate: row.estimate,
      gap: row.likeForLike ? Math.round(row.gapPct) : null,
      basis: row.likeForLike ? "Yes" : `No: ${row.differentBasis}`,
    })),
    notes: [
      `The shaded band marks gaps within ${HERO_BAND_PCT}% either way.`,
      "PIP and UC LCWRA combined is the sum of the two spending pairs above it.",
    ],
  });
}

const position = (value, domain) => `${((value + domain) / (2 * domain)) * 100}%`;

/** One pair's row: its label (a button to its card), and on the track the published ring at 0, a line and our dot at the gap. */
function HeroRow({ row, domain, onShow }) {
  const gap = row.gapPct;
  const start = row.likeForLike ? Math.min(0, gap) : 0;
  const end = row.likeForLike ? Math.max(0, gap) : 0;
  return (
    <li className={`bm-hero-row${row.likeForLike ? "" : " is-flagged"}${row.combined ? " is-combined" : ""}`} data-hero-row={row.id}>
      <button type="button" className="bm-hero-name" onClick={() => onShow(row.id)}>
        <span className="bm-hero-label">
          {row.label}
          {row.combined && <span className="bm-hero-sum"> (sum)</span>}
        </span>
        <span className="bm-hero-figures">
          {row.published} <span aria-hidden="true">→</span>
          <span className="visually-hidden"> published, </span> {row.estimate}
          <span className="visually-hidden"> ours</span>
        </span>
      </button>
      <div className="bm-hero-track" aria-hidden="true">
        {row.likeForLike ? (
          <>
            <span className="bm-hero-line" style={{ left: position(start, domain), right: `calc(100% - ${position(end, domain)})` }} />
            <span className="bm-hero-ring" style={{ left: position(0, domain) }} />
            <span className="bm-hero-dot" style={{ left: position(gap, domain) }} />
            {/* The label away from zero, unless that would run past the axis's end */}
            <span
              className={`bm-hero-value ${(gap < 0) !== Math.abs(gap) / domain > 0.7 ? "is-left" : "is-right"}`}
              style={{ left: position(gap, domain) }}
            >
              {signedGap(gap)}
            </span>
          </>
        ) : (
          <>
            <span className="bm-hero-ring is-hollow" style={{ left: position(0, domain) }} />
            <span className="bm-hero-flag">
              Not like for like<span className="bm-hero-flag-more">: no gap shown</span>
            </span>
          </>
        )}
      </div>
    </li>
  );
}

/**
 * The Benchmarks hero: every comparable pair on one axis, the gap between
 * our estimate and the published figure as a % of the published figure.
 * Each published figure is a grey ring at 0, ours a teal dot at its gap,
 * the shaded band ±15%. A pair that counts different things is shown
 * flagged, with no gap. Three headline chips above; a table for screen
 * readers; the download menu gives CSV, PNG and SVG.
 */
export default function BenchmarksHero({ rows, onShow }) {
  const summary = heroSummary(rows);
  const domain = heroDomain(rows);
  const ticks = heroTicks(domain);
  const band = { left: position(-HERO_BAND_PCT, domain), width: `${(HERO_BAND_PCT / domain) * 50}%` };
  return (
    <MilburnChartCard
      className="bm-hero"
      icon="scale"
      title={HERO_TITLE}
      description="Each published figure beside our estimate on the same basis: the gap is ours less the published figure, as a % of the published figure."
      name="benchmarks-how-close"
      csv={() => heroCsv(rows)}
    >
      <ul className="bm-hero-chips" aria-label="In short">
        <li className="bm-chip">
          <strong>
            {summary.within} of {summary.like}
          </strong>{" "}
          like-for-like pairs within {HERO_BAND_PCT}%
        </li>
        {summary.largest && (
          <li className="bm-chip">
            Largest gap: <strong>{gapWords(summary.largest.gapPct)}</strong> ({summary.largest.label})
          </li>
        )}
        {summary.notLike > 0 && (
          <li className="bm-chip is-flag">
            <TitleIcon name="alert" bare size={13} />
            <span>
              <strong>{summary.notLike}</strong> {summary.notLike === 1 ? "pair" : "pairs"} not like for like
            </span>
          </li>
        )}
      </ul>
      <ul className="bm-legend" aria-hidden="true">
        <li>
          <span className="bm-key-ring" /> Published (0%)
        </li>
        <li>
          <span className="bm-key-dot" /> PolicyEngine
        </li>
        <li>
          <span className="bm-key-band" /> Within {HERO_BAND_PCT}%
        </li>
      </ul>
      <div className="bm-hero-plot" style={{ "--bm-band-left": band.left, "--bm-band-width": band.width }}>
        <div className="bm-hero-guides" aria-hidden="true">
          <span className="bm-hero-band" />
          {ticks.map((tick) => (
            <span key={tick} className={`bm-hero-grid${tick === 0 ? " is-zero" : ""}`} style={{ left: position(tick, domain) }} />
          ))}
        </div>
        <ul className="bm-hero-rows" aria-label="Pairs, each a button to its card">
          {rows.map((row) => (
            <HeroRow key={row.id} row={row} domain={domain} onShow={onShow} />
          ))}
        </ul>
        <div className="bm-hero-axis" aria-hidden="true">
          <span className="bm-hero-axis-spacer" />
          <span className="bm-hero-axis-ticks">
            {ticks.map((tick) => (
              <span key={tick} style={{ left: position(tick, domain) }}>
                {signedGap(tick)}
              </span>
            ))}
          </span>
        </div>
        <p className="bm-hero-axis-title" aria-hidden="true">
          <span>← Ours lower</span>
          <span>Ours higher →</span>
        </p>
      </div>
      <table className="visually-hidden">
        <caption>{HERO_TITLE}</caption>
        <thead>
          <tr>
            <th scope="col">Pair</th>
            <th scope="col">Published</th>
            <th scope="col">PolicyEngine</th>
            <th scope="col">Gap</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.label}</th>
              <td>{row.published}</td>
              <td>{row.estimate}</td>
              <td>{row.likeForLike ? `Ours ${gapWords(row.gapPct)}` : `Not like for like: ${row.differentBasis}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="bm-hero-note">The combined pair is the sum of the two spending pairs above it.</p>
    </MilburnChartCard>
  );
}
