import { Info } from "lucide-react";
import Disclosure from "../Disclosure";
import InfoSections, { hasInfo } from "../InfoSections";
import TitleIcon from "../TitleIcon";
import { BENCHMARK_ICON, BENCHMARK_SHORT, comparisonGapWords, differentBasis, graphicFor, moreInfo, splitValue, toleranceFor, toleranceWords, valueParts } from "../../utils/milburn/benchmarks";
import { SourceLinkChip } from "./SourceChip";

/** The one name of every Benchmarks card's disclosure. */
export const MORE_INFO = "More info";

/** Rounded to the nearest thousand: survey estimates carry no finer precision. */
export const thousands = (value) => (Math.round(value / 1000) * 1000).toLocaleString("en-GB", { maximumFractionDigits: 0 });

/** A figure as worded, its number large and the qualifier after it ("in 2036-37", "a year") small beside it. */
export function Value({ value }) {
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

/** A card's "More info", as on the Measures tab's cards, closed; no preview line, to keep the face short. */
function MoreInfo({ info }) {
  if (!hasInfo(info)) return null;
  return (
    <div className="policy-card-modelling bm-more">
      <Disclosure
        compact
        title={
          <>
            <Info size={14} aria-hidden="true" className="policy-card-icon-inline" />
            {MORE_INFO}
          </>
        }
        className="policy-card-details"
      >
        <InfoSections info={info} />
      </Disclosure>
    </div>
  );
}

function CardTitle({ row }) {
  const short = BENCHMARK_SHORT[row.id] ?? {};
  return (
    <h4 title={row.figure}>
      <TitleIcon name={short.icon ?? BENCHMARK_ICON} />
      <span className="title-text">{short.label ?? row.figure}</span>
    </h4>
  );
}

/** The 15% tolerance verdict, where the row has one: tested against a matched figure, or why not (in More info). */
function ToleranceBadge({ row }) {
  const verdict = toleranceFor(row);
  if (!verdict) return null;
  return (
    <p className={`bm-gap bm-tolerance${verdict.tested ? "" : " is-flag"}`} data-tolerance={verdict.tested ? (verdict.within ? "within" : "outside") : "untested"}>
      <TitleIcon name={verdict.tested ? (verdict.within ? "check" : "alert") : "info"} bare size={13} />
      <span>{toleranceWords(verdict)}</span>
    </p>
  );
}

/** A card's foot: the source chip (source and date, a link), then More info. */
function Foot({ row, info }) {
  return (
    <div className="bm-foot">
      {(row.source || row.date) && (
        <p className="bm-foot-source">
          <SourceLinkChip source={row.source} url={row.url} date={row.date} />
        </p>
      )}
      <MoreInfo info={info} />
    </div>
  );
}

/**
 * One comparable pair: the published figure and ours, large, side by side;
 * the gap as a badge (or "Not like for like", with no gap); two thin bars
 * from zero in the pair's own unit; the source chip; and everything else
 * (why they differ, both bases, our build, our saving) in More info.
 */
export function ComparePanel({ row, comparison }) {
  const published = splitValue(row.value);
  const basis = differentBasis(row.id);
  const gap = comparison.gapPct;
  const max = Math.max(comparison.published, comparison.estimate);
  const width = (value) => `${max > 0 ? (value / max) * 100 : 0}%`;
  return (
    <li id={`bm-card-${row.id}`} className="bm-card bm-compare" data-benchmark={row.id}>
      <CardTitle row={row} />
      <div className="bm-pair">
        <p className="bm-figure">
          <span className="bm-kicker">
            <span className="bm-key-ring" aria-hidden="true" /> Published
          </span>
          <Value value={published.value} />
        </p>
        <p className="bm-figure is-estimate">
          <span className="bm-kicker">
            <span className="bm-key-dot" aria-hidden="true" /> PolicyEngine
          </span>
          <Value value={row.estimate.fixed} />
        </p>
      </div>
      {basis ? (
        <p className="bm-gap is-flag" data-different-basis="">
          <TitleIcon name="alert" bare size={13} />
          <span>Not like for like</span>
        </p>
      ) : (
        <p className="bm-gap" data-gap="">
          <TitleIcon name={Math.round(Math.abs(gap)) === 0 ? "equal" : gap < 0 ? "arrowDown" : "arrowUp"} bare size={13} />
          <span>Ours {comparisonGapWords(comparison)}</span>
        </p>
      )}
      <ToleranceBadge row={row} />
      <div className="bm-bars" aria-hidden="true">
        <span className="bm-bar is-published" style={{ width: width(comparison.published) }} />
        <span className="bm-bar is-estimate" style={{ width: width(comparison.estimate) }} />
      </div>
      <Foot row={row} info={moreInfo(row)} />
    </li>
  );
}

/** A graphic's bars, one a point from zero, each with its label and figure. */
function GraphicBars({ points }) {
  const max = Math.max(...points.map((point) => point.number));
  return (
    <div className="bm-mini" aria-hidden="true">
      {points.map((point) => (
        <div key={point.label} className={`bm-mini-row${point.tone ? ` is-${point.tone}` : ""}`}>
          <span className="bm-mini-label">{point.label}</span>
          <span className="bm-mini-track">
            <span className="bm-mini-fill" style={{ width: `${max > 0 ? (point.number / max) * 100 : 0}%` }} />
          </span>
          <span className="bm-mini-value">{point.text}</span>
        </div>
      ))}
    </div>
  );
}

/** One bar split into its parts, each named under it with its figure. */
function GraphicStack({ points }) {
  const total = points.reduce((sum, point) => sum + point.number, 0);
  return (
    <div className="bm-stack" aria-hidden="true">
      <div className="bm-stack-bar">
        {points.map((point, index) => (
          <span key={point.label} className={`bm-stack-part is-${index}`} style={{ flexGrow: point.number / total }} />
        ))}
      </div>
      <ul className="bm-stack-key">
        {points.map((point, index) => (
          <li key={point.label}>
            <span className={`bm-stack-swatch is-${index}`} />
            {point.label} <strong>{point.text}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One share of a whole as a filled track, its label beside it. */
function GraphicMeter({ point }) {
  return (
    <div className="bm-mini" aria-hidden="true">
      <div className="bm-mini-row is-latest">
        <span className="bm-mini-label">{point.label}</span>
        <span className="bm-mini-track">
          <span className="bm-mini-fill" style={{ width: `${point.number}%` }} />
        </span>
        <span className="bm-mini-value">{point.text}</span>
      </div>
    </div>
  );
}

/** "1 in 5" as five people, one filled. */
function GraphicShare({ share }) {
  return (
    <div className="bm-share" aria-hidden="true">
      {Array.from({ length: share.of }, (_, index) => (
        <span key={index} className={`bm-share-person${index < share.count ? " is-counted" : ""}`}>
          <TitleIcon name="user" bare size={20} />
        </span>
      ))}
    </div>
  );
}

function Graphic({ graphic }) {
  if (!graphic) return null;
  if (graphic.kind === "bars") return <GraphicBars points={graphic.points} />;
  if (graphic.kind === "stack") return <GraphicStack points={graphic.points} />;
  if (graphic.kind === "meter") return <GraphicMeter point={graphic.points[0]} />;
  if (graphic.kind === "share") return <GraphicShare share={graphic.share} />;
  return null;
}

/**
 * One figure with no comparable pair, as a stat tile: its title, the
 * figure (published, or ours alone), a small graphic where its wording is
 * a series, a split or a share, a flag where its basis is not published,
 * the source chip and More info.
 */
export function StatTile({ row, estimate, yearLabel, runLabel }) {
  const published = splitValue(row.value);
  const ours = row.estimate?.fixed || (estimate !== null && estimate !== undefined ? thousands(estimate) : "");
  const unpublishedBasis = /^Basis not published/.test(row.basis);
  return (
    <li
      id={`bm-card-${row.id}`}
      className={`bm-card bm-tile${published.value ? "" : " is-estimate"}`}
      data-benchmark={row.id}
    >
      <CardTitle row={row} />
      {published.value && (
        <p className="bm-figure">
          <span className="bm-kicker">
            <span className="bm-key-ring" aria-hidden="true" /> Published
          </span>
          <Value value={published.value} />
        </p>
      )}
      {ours && (
        <p className="bm-figure is-estimate">
          <span className="bm-kicker">
            <span className="bm-key-dot" aria-hidden="true" /> PolicyEngine{!row.estimate?.fixed && yearLabel ? `, ${yearLabel}` : ""}
          </span>
          <Value value={ours} />
        </p>
      )}
      {unpublishedBasis && (
        <p className="bm-gap is-flag" data-unpublished-basis="">
          <TitleIcon name="alert" bare size={13} />
          <span>Basis not published</span>
        </p>
      )}
      <Graphic graphic={graphicFor(row)} />
      <Foot row={row} info={moreInfo(row, { estimate: ours || null, runLabel })} />
    </li>
  );
}
