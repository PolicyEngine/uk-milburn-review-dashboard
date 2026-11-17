import TitleIcon from "../TitleIcon";
import { MilburnChartCard } from "./MilburnCharts";
import { shortSource } from "./SourceChip";
import { yearLabel } from "../../utils/displayYears";
import { NEET_GROUPS, useNeetBreakdown } from "../../utils/milburn/neet";
import "./NeetBreakdown.css";

export const NEET_TITLE = "NEET young people";
export const NEET_DEFINITION_LINE = "approximated: no earnings and not in full-time education";
export const WITHHELD = "Withheld";

const number = (value, options) => value.toLocaleString("en-GB", options);

/** People, to the nearest thousand. */
export const formatPeople = (value) => number(Math.round(value / 1000) * 1000);

/** A share of a group, two decimal places. */
export const formatSharePct = (value) => `${number(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/** A change in pounds a year, signed, to the nearest pound. */
export function formatChange(value) {
  const pounds = Math.round(value);
  if (pounds === 0) return "£0";
  return `${pounds < 0 ? "−" : "+"}£${number(Math.abs(pounds))}`;
}

const ROWS = [
  { key: "population", label: "People", format: formatPeople },
  { key: "share_in_losing_households_pct", label: "Share in households that lose", format: formatSharePct, bar: true },
  {
    key: "average_change_in_household_net_income",
    label: "Average change in household net income, a year",
    format: formatChange,
  },
  { key: "people_losing_uc_health_or_pip", label: "People losing the UC health element or PIP", format: formatPeople },
  { key: "share_losing_uc_health_or_pip_pct", label: "Share losing the UC health element or PIP", format: formatSharePct, bar: true },
];

function Figure({ value, format, bar }) {
  if (value === null) return <span className="neet-breakdown-figure neet-breakdown-withheld">{WITHHELD}</span>;
  return (
    <>
      <span className="neet-breakdown-figure">{format(value)}</span>
      {bar && (
        <span className="neet-breakdown-bar" aria-hidden="true">
          <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
        </span>
      )}
    </>
  );
}

/** Our count beside the published one: no figure is stated that either file lacks. */
function CountLine({ neet, benchmark }) {
  if (neet.total === null) return null;
  const share = neet.shareOfYoung === null ? "" : ` (${number(neet.shareOfYoung, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% of 16–24s)`;
  const source = benchmark ? shortSource(benchmark.source) : "";
  return (
    <p className="neet-breakdown-count" data-neet-count="">
      Our approximation counts {formatPeople(neet.total)} people aged 16 to 24 as NEET in {yearLabel(neet.year)}
      {share}.
      {benchmark?.value && (
        <>
          {" "}
          {source ? `The ${source} estimates` : "The published estimate is"} {benchmark.value}
          {benchmark.url && (
            <>
              {" "}
              (
              <a href={benchmark.url} target="_blank" rel="noopener noreferrer">
                {benchmark.basis ? benchmark.basis.split(":")[0] : "source"}
              </a>
              )
            </>
          )}
          , on a different definition.
        </>
      )}
    </p>
  );
}

/**
 * Impact, Young people: the report package's effect on 16 to 24-year-olds
 * who are approximately NEET, beside the other 16 to 24-year-olds. The
 * figures are for the year the file was made for, whatever year is chosen.
 * Nothing unless one run is selected, its file can be read, and that run is
 * the one the file was made for (the report package).
 */
export default function NeetBreakdown({ selectedPolicies = [] }) {
  const selected = selectedPolicies.length === 1 ? selectedPolicies[0] : null;
  const { status, neet, benchmark } = useNeetBreakdown({ enabled: selected !== null });
  if (selected === null || status !== "ready" || neet.reformId !== selected) return null;
  const year = yearLabel(neet.year);
  const description = `The report package's effect on 16 to 24-year-olds not in education, employment or training (${NEET_DEFINITION_LINE}), beside other 16 to 24-year-olds, ${year}.`;
  return (
    <section className="report-section neet-breakdown" aria-label={NEET_TITLE} data-neet-breakdown="">
      {/* The card's frame comes from the stack, as the other tabs' cards */}
      <div className="charts-stack">
      <MilburnChartCard
        icon="cap"
        title={NEET_TITLE}
        description={description}
        after={
          <>
            <CountLine neet={neet} benchmark={benchmark} />
            {neet.notes.length > 0 && (
              <details className="milburn-details">
                <summary>
                  <TitleIcon name="alert" bare size={14} />
                  More info
                </summary>
                <ul>
                  {neet.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </details>
            )}
          </>
        }
      >
        <div className="milburn-table-wrap">
          <table className="milburn-table">
            <caption className="visually-hidden">
              {NEET_TITLE}, {year}
            </caption>
            <thead>
              <tr>
                <th scope="col">{year}</th>
                {NEET_GROUPS.map((group) => (
                  <th key={group.key} scope="col">
                    {group.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.key} data-neet-row={row.key}>
                  <th scope="row">{row.label}</th>
                  {NEET_GROUPS.map((group) => (
                    <td key={group.key}>
                      <Figure value={neet.groups[group.key][row.key]} format={row.format} bar={row.bar} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MilburnChartCard>
      </div>
    </section>
  );
}
