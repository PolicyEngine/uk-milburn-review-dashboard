import TitleIcon from "../TitleIcon";
import { MilburnChartCard } from "./MilburnCharts";
import { shortSource } from "./SourceChip";
import { yearLabel } from "../../utils/displayYears";
import { NEET_GROUPS, neetForYear, useNeetBreakdown } from "../../utils/milburn/neet";
import { buildChartCsv } from "../../utils/chartCsv";
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
  { key: "population", label: "People", icon: "users", format: formatPeople },
  { key: "share_in_losing_households_pct", label: "Share in households that lose", icon: "percent", format: formatSharePct, bar: true },
  {
    key: "average_change_in_household_net_income",
    label: "Average change in household net income, a year",
    icon: "wallet",
    format: formatChange,
  },
  { key: "people_losing_uc_health_or_pip", label: "People losing the UC health element or PIP", icon: "user", format: formatPeople },
  { key: "share_losing_uc_health_or_pip_pct", label: "Share losing the UC health element or PIP", icon: "scale", format: formatSharePct, bar: true },
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
    <span className="neet-breakdown-count" data-neet-count="">
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
    </span>
  );
}

/** The units of each row, for the CSV. */
const ROW_UNITS = {
  population: "people",
  share_in_losing_households_pct: "%",
  average_change_in_household_net_income: "£ a year",
  people_losing_uc_health_or_pip: "people",
  share_losing_uc_health_or_pip_pct: "%",
};

/** The table as CSV: a row each, a column each group; a withheld figure says so, never a zero. */
export function neetCsv(neet) {
  const year = yearLabel(neet.year);
  return buildChartCsv({
    title: `${NEET_TITLE}, ${year}`,
    units: `As each row's unit says; NEET is ${NEET_DEFINITION_LINE}; the page rounds people to the nearest thousand`,
    columns: [
      { key: "label", label: "Figure" },
      { key: "unit", label: "Unit" },
      ...NEET_GROUPS.map((group) => ({ key: group.key, label: group.label })),
    ],
    rows: ROWS.map((row) => ({
      label: row.label,
      unit: ROW_UNITS[row.key],
      ...Object.fromEntries(
        NEET_GROUPS.map((group) => {
          const value = neet.groups[group.key][row.key];
          return [group.key, value === null ? WITHHELD : String(Math.round(value * 100) / 100)];
        }),
      ),
    })),
    notes: neet.notes,
  });
}

/**
 * Impact, Young people: the report package's effect on 16 to 24-year-olds
 * who are approximately NEET, beside the other 16 to 24-year-olds, in the
 * year chosen when the file covers it (by_year), else the file's own year,
 * which the title names.
 * Nothing unless one run is selected, its file can be read, and that run is
 * the one the file was made for (the report package).
 */
export default function NeetBreakdown({ selectedPolicies = [], selectedYear }) {
  const selected = selectedPolicies.length === 1 ? selectedPolicies[0] : null;
  const { status, neet: file, benchmark } = useNeetBreakdown({ enabled: selected !== null });
  if (selected === null || status !== "ready" || file.reformId !== selected) return null;
  // The chosen year's figures where the file has them (by_year), else its own year's, named in the title
  const neet = neetForYear(file, selectedYear);
  const year = yearLabel(neet.year);
  const description = `The report package's effect on NEET 16 to 24-year-olds, beside other 16 to 24-year-olds, ${year}.`;
  return (
    <section className="report-section neet-breakdown" aria-label={NEET_TITLE} data-neet-breakdown="">
      {/* The card's frame comes from the stack, as the other tabs' cards */}
      <div className="charts-stack">
      <MilburnChartCard
        logo={false}
        icon="cap"
        title={NEET_TITLE}
        description={description}
        name="neet-young-people"
        csv={() => neetCsv(neet)}
        after={
          <details className="milburn-details">
            <summary>
              <TitleIcon name="alert" bare size={14} />
              More info
            </summary>
            <ul>
              <li>NEET is {NEET_DEFINITION_LINE}.</li>
              <li>
                <CountLine neet={neet} benchmark={benchmark} />
              </li>
              {neet.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </details>
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
                  <th scope="row">
                    <span className="neet-breakdown-rowlabel">
                      <TitleIcon name={row.icon} bare size={15} />
                      {row.label}
                    </span>
                  </th>
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
