import TitleIcon from "../TitleIcon";
import "./milburn.css";

/** What every chart on Young people, Poverty and Public finances shows. */
export const CHARTS_ARE_ESTIMATES = "Charts show PolicyEngine estimates (static microsimulation, certified data).";

/** Why the age charts move for ages no measure targets (HBAI convention). */
export const AGE_HOUSEHOLD_NOTE =
  "Only people in the targeted ages lose the benefit; other ages change because they share a household with someone who does.";

/**
 * A publisher's name as a chip or a list says it: the review's report, annex
 * and data tables are "the review"; ONS and IFS by their initials; any other
 * source as the file names it.
 */
export function shortSource(source) {
  const name = String(source ?? "").trim();
  if (name.startsWith("From a Welfare State to a Working State")) return "the review";
  if (name === "Office for National Statistics") return "ONS";
  if (name === "Institute for Fiscal Studies") return "IFS";
  return name;
}

/** The distinct publishers of a set of sources, short, in the order first met. */
export const distinctSources = (sources) => [...new Set(sources.map(shortSource).filter(Boolean))];

/**
 * Whose figure this is: "PolicyEngine estimate" (teal, a calculator), or
 * "Published: <source>" (neutral, a document) for a figure someone else
 * published. `plural` for a box of several estimates.
 */
export default function SourceChip({ kind = "estimate", source, plural = false, className = "" }) {
  const published = kind === "published";
  const text = published ? `Published${source ? `: ${source}` : ""}` : `PolicyEngine estimate${plural ? "s" : ""}`;
  return (
    <span className={`source-chip ${published ? "is-published" : "is-estimate"} ${className}`.trim()} data-source-kind={published ? "published" : "estimate"}>
      <TitleIcon name={published ? "fileText" : "calculator"} bare size={12} />
      {text}
    </span>
  );
}

/** One quiet line under a sub-tab's heading: its charts are PolicyEngine's. */
export function ChartsSourceNote() {
  return (
    <p className="source-note" role="note" data-charts-source="">
      <SourceChip plural />
      <span>{CHARTS_ARE_ESTIMATES}</span>
    </p>
  );
}

/** The age charts' one line on why other ages change, on its own line at the end of a card's description. */
export function AgeHouseholdNote() {
  return (
    <span className="age-household-note" data-age-household-note="">
      <TitleIcon name="house" bare size={13} />
      <span>{AGE_HOUSEHOLD_NOTE}</span>
    </span>
  );
}
