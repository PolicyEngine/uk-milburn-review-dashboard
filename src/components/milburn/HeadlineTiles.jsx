import { useRef } from "react";
import { useMeasureCatalogue } from "../../utils/measureCatalogue";
import { shortNameOf } from "../../utils/policyDetails";
import { fiscalYearTick } from "../../utils/chartTheme";
import {
  formatBn,
  formatPeople,
  formatSignedPp,
  HEADLINE_RUN,
  isWithheld,
  notYetStarted,
  savingInYear,
  STARTS_TEXT,
  summaryRun,
  useMilburnSummary,
} from "../../utils/milburn/summary";
import { WITHHELD_DETAIL, WITHHELD_LABEL } from "../../utils/withheld";
import TitleIcon from "../TitleIcon";
import BenchmarkCallout from "./BenchmarkCallout";
import { buildChartCsv } from "../../utils/chartCsv";
import { CASH_TERMS_NOTE, fallbackRunLine, packageRange, PARTIAL_REMOVAL_NOTE, removesHealthOrPip, ROUNDING_NOTE } from "./KeyFigures";
import { BoxDownload } from "./MilburnCharts";
import "./milburn.css";

/** The four poverty lines the summary carries, absolute before housing costs first. */
export const POVERTY_LINES = [
  { key: "abs_bhc", label: "Absolute, before housing costs", icon: "wallet" },
  { key: "abs_ahc", label: "Absolute, after housing costs", icon: "house" },
  { key: "rel_bhc", label: "Relative, before housing costs", icon: "wallet" },
  { key: "rel_ahc", label: "Relative, after housing costs", icon: "house" },
];

/** A share of the largest figure in a set, for a bar's width ("62%"); 0% with nothing to compare. */
export const barShare = (value, values) => {
  const max = Math.max(0, ...values.map((entry) => Math.abs(entry ?? 0)));
  return max > 0 && value !== null ? `${(Math.abs(value) / max) * 100}%` : "0%";
};

/** A labelled figure with a bar scaled to the largest in its list; decorative, the figure is in the text. */
function MeterRow({ icon, label, value, width, tone, current }) {
  return (
    <li className={`milburn-meter-row${current ? " is-current" : ""}`}>
      <span className="milburn-meter-label">
        <TitleIcon name={icon} bare size={14} />
        {label}
      </span>
      <span className="milburn-meter-track" aria-hidden="true">
        <span className={`milburn-meter-fill ${tone}`} style={{ width }} />
      </span>
      <span className="milburn-meter-value">{value}</span>
    </li>
  );
}

/** The run the headline reads (one chosen policy, or the report's package) and its summary. */
function useHeadlineRun(runId, year) {
  const catalogue = useMeasureCatalogue();
  const id = runId || HEADLINE_RUN;
  const measure = catalogue.byId?.get(id);
  // The chosen year's figures (milburn_summary.json's by_year)
  const { status, summary } = useMilburnSummary(catalogue.manifest?.snapshotSha256 ?? null, { year });
  const run = status === "ready" ? summaryRun(summary, id) : null;
  return { local: Boolean(catalogue.localBuild), name: measure ? shortNameOf(measure) : id, fallback: !runId, summary, run };
}

function Heading({ title, name, fallback, download = null }) {
  return (
    <div className="milburn-key-heading">
      <h3>
        <TitleIcon name="sparkle" />
        {title}
      </h3>
      {/* One selected policy: the header's button names it (screen readers only here); otherwise the fallback is named on the card */}
      {fallback ? <p data-fallback-run="">{fallbackRunLine(name)}</p> : <p className="visually-hidden">{name}</p>}
      {download}
    </div>
  );
}

/** How the Public finances figures are signed. */
export const SAVING_SIGN_NOTE = "A positive figure is a saving to the Exchequer; a negative one is a cost.";

/** A box's folded "Notes and caveats". */
function Notes({ children }) {
  return (
    <details className="milburn-details" data-notes="">
      <summary>
        <TitleIcon name="alert" bare size={14} />
        Notes and caveats
      </summary>
      <ul className="milburn-points">{children}</ul>
    </details>
  );
}

function Tile({ icon, value, extra, label, note, detail }) {
  return (
    <li className="milburn-key-tile" title={detail}>
      <TitleIcon name={icon} className="milburn-key-icon" size={18} />
      <p className="milburn-key-value">
        {value}
        {extra && <span className="milburn-key-extra"> {extra}</span>}
      </p>
      <p className="milburn-key-label">{label}</p>
      {note && <p className="milburn-key-definition">{note}</p>}
    </li>
  );
}

/** The package range as meter rows: one per package, the run shown above marked. */
function RangeMeter({ range, values, format, tone, currentId, title, year }) {
  return (
    <div className="milburn-meter" data-range-meter="">
      <h4>
        <TitleIcon name="layers" bare size={14} />
        {title}, {fiscalYearTick(year)}
      </h4>
      <ul>
        {range.map((row, index) => (
          <MeterRow
            key={row.id}
            icon="scale"
            label={row.name}
            value={format(row, index)}
            width={barShare(values[index], values)}
            tone={tone}
            current={row.id === currentId}
          />
        ))}
      </ul>
    </div>
  );
}

/** Poverty's headline as CSV: the tiles' counts, the change on each line, and the package range. */
export function povertyHeadlineCsv(run, summary, name) {
  const range = packageRange(summary);
  const rows = [
    { figure: "People into absolute poverty, before housing costs", value: run.peopleIntoPovertyAbs, unit: "people" },
    { figure: "People into relative poverty, before housing costs", value: run.peopleIntoPovertyRel, unit: "people" },
    { figure: "Child poverty rate, relative, before housing costs", value: run.childPovertyPpRel, unit: "pp change" },
    ...POVERTY_LINES.map((line) => ({ figure: `Poverty rate change: ${line.label.toLowerCase()}`, value: run.povertyPp[line.key], unit: "pp change" })),
    ...range.map((row) => ({ figure: `Package range: ${row.name}, people into absolute poverty before housing costs`, value: row.povertyValue, unit: "people" })),
  ].filter((row) => row.value !== null && row.value !== undefined);
  return buildChartCsv({
    title: `Poverty at a glance, ${name}, ${fiscalYearTick(summary.year)}`,
    units: `People (a negative count is people out of poverty) or percentage points, as each row says; static${removesHealthOrPip(run.id) ? ", with no replacement payments modelled" : ""}; a figure withheld to protect survey households is left out`,
    columns: [
      { key: "figure", label: "Figure" },
      { key: "value", label: "Value", decimals: 3 },
      { key: "unit", label: "Unit" },
    ],
    rows,
  });
}

/** Public finances' headline as CSV: the saving in the year shown, and the package range. */
export function financesHeadlineCsv(run, summary, name, shown) {
  const range = packageRange(summary);
  const rows = [
    { figure: `Exchequer saving, ${fiscalYearTick(Number(shown))}`, value: savingInYear(run, shown), year: fiscalYearTick(Number(shown)) },
    ...range.map((row) => ({ figure: `Package range: ${row.name}`, value: row.savingValue, year: fiscalYearTick(summary.year) })),
  ].filter((row) => row.value !== null && row.value !== undefined);
  return buildChartCsv({
    title: `Public finances at a glance, ${name}`,
    units: `£ billion a year, cash terms; a positive figure is a saving to the Exchequer, a negative one a cost; static${removesHealthOrPip(run.id) ? ", with no replacement payments modelled" : ""}`,
    columns: [
      { key: "figure", label: "Figure" },
      { key: "year", label: "Fiscal year" },
      { key: "value", label: "Saving (£bn)", decimals: 3 },
    ],
    rows,
  });
}

/**
 * Poverty's headline, over its charts on the local build route: the people
 * moved across the absolute and relative lines, child poverty, the change
 * on each of the four lines side by side, and the packages' range of
 * people moved into absolute poverty, from milburn_summary.json for the
 * year chosen above the page. Nothing while the run or the file is missing.
 */
export function PovertyHeadline({ runId, selectedYear }) {
  const { local, name, fallback, summary, run } = useHeadlineRun(runId, selectedYear);
  const figuresRef = useRef(null);
  if (!local || !run) return null;
  const direction = (count) => (count >= 0 ? "into" : "out of");
  // Before the run starts (a report run, from April 2029): said, not zeros
  const notStarted = notYetStarted(run, summary.year);
  // A line the file withholds stays, marked withheld; one it does not carry is left out
  const withheldLine = (line) => isWithheld(run, `poverty_change_pp.${line.key}`);
  const lines = notStarted ? [] : POVERTY_LINES.filter((line) => run.povertyPp[line.key] !== null || withheldLine(line));
  const values = lines.map((line) => run.povertyPp[line.key]);
  const range = packageRange(summary).filter((row) => row.povertyValue !== null);
  const showRange = range.length > 1;
  // The file's subtitle names the header's selection; the fallback run is named in the title
  const title = `Poverty at a glance${fallback ? `, ${name}` : ""}, ${fiscalYearTick(summary.year)}`;
  return (
    <section className="report-section milburn-key card" aria-label="Poverty headline">
      <Heading
        title="Poverty at a glance"
        name={name}
        fallback={fallback}
        download={<BoxDownload title={title} name="poverty-at-a-glance" targetRef={figuresRef} csv={() => povertyHeadlineCsv(run, summary, name)} />}
      />
      <div ref={figuresRef} className="milburn-box-figures">
        <ul className="milburn-key-tiles" aria-label="Figures">
          {notStarted ? (
            <Tile icon="calendar" value={STARTS_TEXT} label={`No change in ${fiscalYearTick(summary.year)}`} note="The measures start in April 2029." />
          ) : (
            <>
              {run.peopleIntoPovertyAbs !== null ? (
                <Tile
                  icon="usersRound"
                  value={formatPeople(run.peopleIntoPovertyAbs)}
                  extra={formatSignedPp(run.povertyPp.abs_bhc)}
                  label={`People ${direction(run.peopleIntoPovertyAbs)} absolute poverty`}
                  note="Before housing costs; line fixed in real terms."
                />
              ) : (
                isWithheld(run, "people_into_poverty_abs_bhc") && (
                  <Tile icon="usersRound" value="Withheld" label="People into or out of absolute poverty" note={`${WITHHELD_LABEL}.`} detail={WITHHELD_DETAIL} />
                )
              )}
              {run.peopleIntoPovertyRel !== null ? (
                <Tile
                  icon="scale"
                  value={formatPeople(run.peopleIntoPovertyRel)}
                  extra={formatSignedPp(run.povertyPp.rel_bhc)}
                  label={`People ${direction(run.peopleIntoPovertyRel)} relative poverty`}
                  note="Before housing costs; line moves with the median."
                />
              ) : (
                isWithheld(run, "people_into_poverty_rel_bhc") && (
                  <Tile icon="scale" value="Withheld" label="People into or out of relative poverty" note={`${WITHHELD_LABEL}.`} detail={WITHHELD_DETAIL} />
                )
              )}
              {run.childPovertyPpRel !== null ? (
                <Tile
                  icon="cake"
                  value={formatSignedPp(run.childPovertyPpRel)}
                  label="Child poverty rate"
                  note="Relative, before housing costs."
                />
              ) : (
                isWithheld(run, "child_poverty_change_pp_rel_bhc") && (
                  <Tile icon="cake" value="Withheld" label="Child poverty rate" note={`${WITHHELD_LABEL}.`} detail={WITHHELD_DETAIL} />
                )
              )}
            </>
          )}
        </ul>
        {(lines.length > 0 || showRange) && (
          <div className="milburn-split milburn-meters">
            {lines.length > 0 && (
              <div className="milburn-meter">
                <h4>
                  <TitleIcon name="percent" bare size={14} />
                  Change in the poverty rate, by line
                </h4>
                <ul>
                  {lines.map((line) => (
                    <MeterRow
                      key={line.key}
                      icon={line.icon}
                      label={line.label}
                      // The narrow value column says "Withheld"; the notes give the label
                      value={run.povertyPp[line.key] === null ? "Withheld" : formatSignedPp(run.povertyPp[line.key])}
                      width={barShare(run.povertyPp[line.key], values)}
                      tone={run.povertyPp[line.key] > 0 ? "is-loss" : "is-gain"}
                    />
                  ))}
                </ul>
              </div>
            )}
            {/* The packages side by side: people into absolute poverty, before housing costs */}
            {showRange && (
              <RangeMeter
                range={range}
                values={range.map((row) => row.povertyValue)}
                format={(row) => formatPeople(row.povertyValue)}
                tone="is-loss"
                currentId={run.id}
                title="Package range (our designs): people into absolute poverty"
                year={summary.year}
              />
            )}
          </div>
        )}
      </div>
      <Notes>
        <li>
          <TitleIcon name="calculator" bare size={14} />
          <span>{ROUNDING_NOTE}</span>
        </li>
        {[...(run.withheld ?? [])].some((field) => /poverty/.test(field)) && (
          <li data-withheld-note="">
            <TitleIcon name="shield" bare size={14} />
            <span>{WITHHELD_LABEL}: {WITHHELD_DETAIL.replace(/^Withheld: t/, "T")}</span>
          </li>
        )}
        {showRange && (
          <li data-range-note="">
            <TitleIcon name="layers" bare size={14} />
            <span>{PARTIAL_REMOVAL_NOTE}</span>
          </li>
        )}
      </Notes>
      {/* Published figures: a link to Benchmarks */}
      <BenchmarkCallout place="poverty" />
    </section>
  );
}

/**
 * Public finances' headline, over its chart on the local build route: the
 * run's Exchequer saving in the chosen year (the chart below shows every
 * year) beside the packages' range (RANGE_IDS), from milburn_summary.json.
 * Nothing while the run or the file is missing.
 */
export function FinancesHeadline({ runId, selectedYear }) {
  const { local, name, fallback, summary, run } = useHeadlineRun(runId, selectedYear);
  const figuresRef = useRef(null);
  if (!local || !run) return null;
  const years = Object.keys(run.savingBn).sort();
  if (!years.length) return null;
  const shown = years.includes(String(selectedYear)) ? String(selectedYear) : String(summary.year);
  const current = savingInYear(run, shown);
  const range = packageRange(summary);
  const rangeValues = range.map((row) => savingInYear(summaryRun(summary, row.id), summary.year));
  const showRange = range.length > 1;
  const word = (value) => (value >= 0 ? "saving" : "cost");
  // The file's subtitle names the header's selection; the fallback run is named in the title
  const title = `Public finances at a glance${fallback ? `, ${name}` : ""}`;
  return (
    <section className="report-section milburn-key card" aria-label="Public finances headline">
      <Heading
        title="Public finances at a glance"
        name={name}
        fallback={fallback}
        download={<BoxDownload title={title} name="public-finances-at-a-glance" targetRef={figuresRef} csv={() => financesHeadlineCsv(run, summary, name, shown)} />}
      />
      <div ref={figuresRef} className="milburn-split">
        <ul className="milburn-key-tiles" aria-label="Figures">
          {current !== null && (
            <Tile
              icon="landmark"
              value={formatBn(Math.abs(current))}
              label={`Exchequer ${word(current)}, ${fiscalYearTick(Number(shown))}`}
              note={CASH_TERMS_NOTE}
            />
          )}
        </ul>
        {showRange && (
          <RangeMeter
            range={range}
            values={rangeValues}
            format={(row) => row.saving}
            tone="is-gain"
            currentId={run.id}
            title="Package range (our designs)"
            year={summary.year}
          />
        )}
      </div>
      <Notes>
        <li>
          <TitleIcon name="scale" bare size={14} />
          <span>{SAVING_SIGN_NOTE}</span>
        </li>
        {showRange && (
          <li data-range-note="">
            <TitleIcon name="layers" bare size={14} />
            <span>{PARTIAL_REMOVAL_NOTE}</span>
          </li>
        )}
      </Notes>
      {/* Published figures: a link to Benchmarks */}
      <BenchmarkCallout place="finances" />
    </section>
  );
}
