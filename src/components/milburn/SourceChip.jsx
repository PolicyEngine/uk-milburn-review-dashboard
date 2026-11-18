import TitleIcon from "../TitleIcon";
import "./milburn.css";

/** Why the age charts move for ages no measure targets (HBAI convention). */
export const AGE_HOUSEHOLD_NOTE =
  "Other ages change only because they share a household with someone in the targeted ages.";

/**
 * Why Gains and losses shows gains and losses in age groups the selected
 * policy does not target (María, #6 item 4).
 */
export const AGE_SHARES_NOTE =
  "Each person carries their household's change, so groups the policy does not target move too: a parent living with a 20-year-old who loses PIP counts as worse off.";

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

/** A publisher's name as a source chip says it: "Review, annex", "Review, data tables", "Review", "ONS". */
export function chipSource(source) {
  const name = String(source ?? "").trim();
  const short = shortSource(name);
  if (short !== "the review") return short;
  const part = name.split(":")[1]?.trim().replace(/^analytical /, "");
  return part ? `Review, ${part}` : "Review";
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "17 November 2026" as "17 Nov 2026"; any other wording as it is. */
export function shortDate(date) {
  const text = String(date ?? "").trim();
  const [day, month, year, ...rest] = text.split(" ");
  return MONTHS.includes(month) && year && !rest.length ? `${day} ${month.slice(0, 3)} ${year}` : text;
}

/**
 * Where a published figure comes from, as one compact chip: the short
 * source and its date ("Review, annex · 17 Nov 2026"), a link in a new tab
 * when there is a URL, with the full title as its tooltip.
 */
export function SourceLinkChip({ source, url, date, className = "" }) {
  if (!source && !date) return null;
  const text = [chipSource(source), shortDate(date)].filter(Boolean).join(" · ");
  const classes = `source-link-chip ${className}`.trim();
  if (!url) {
    return (
      <span className={classes} title={source || undefined} data-source-link="">
        <TitleIcon name="fileText" bare size={12} />
        <span className="source-link-text">{text}</span>
      </span>
    );
  }
  return (
    <a className={`${classes} is-link`} href={url} target="_blank" rel="noopener noreferrer" title={source || undefined} data-source-link="">
      <TitleIcon name="link" bare size={12} />
      <span className="source-link-text">{text}</span>
      <TitleIcon name="externalLink" bare size={11} />
      <span className="visually-hidden"> (opens in a new tab)</span>
    </a>
  );
}

/**
 * Whose figure this is: "PolicyEngine estimate" (teal, a calculator), or
 * "Published: <source>" (neutral, a document) for a figure someone else
 * published.
 */
export default function SourceChip({ kind = "estimate", source, className = "" }) {
  const published = kind === "published";
  const text = published ? `Published${source ? `: ${source}` : ""}` : "PolicyEngine estimate";
  return (
    <span className={`source-chip ${published ? "is-published" : "is-estimate"} ${className}`.trim()} data-source-kind={published ? "published" : "estimate"}>
      <TitleIcon name={published ? "fileText" : "calculator"} bare size={12} />
      {text}
    </span>
  );
}

/** The age charts' one line on why other ages change, on its own line at the end of a card's description. */
export function AgeHouseholdNote({ text = AGE_HOUSEHOLD_NOTE }) {
  return (
    // Read as part of the card's description, one paragraph (Vahid, 17 Nov)
    <span className="age-household-note age-household-note--inline" data-age-household-note="">
      {" "}
      {text}
    </span>
  );
}
