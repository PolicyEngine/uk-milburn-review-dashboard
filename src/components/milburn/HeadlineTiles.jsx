import { useMeasureCatalogue } from "../../utils/measureCatalogue";
import { shortNameOf } from "../../utils/policyDetails";
import { fiscalYearTick } from "../../utils/chartTheme";
import {
  DEFAULT_SUMMARY_RUN,
  formatBn,
  formatPeople,
  formatSignedPp,
  savingInYear,
  summaryRun,
  useMilburnSummary,
} from "../../utils/milburn/summary";
import TitleIcon from "../TitleIcon";
import BenchmarkCallout from "./BenchmarkCallout";
import SourceChip from "./SourceChip";
import { packageRange } from "./KeyFigures";
import { YearOnlyChip } from "./MilburnCharts";
import "./milburn.css";

/** The four poverty lines the summary carries, absolute after housing costs first. */
export const POVERTY_LINES = [
  { key: "abs_ahc", label: "Absolute, after housing costs", icon: "house" },
  { key: "abs_bhc", label: "Absolute, before housing costs", icon: "wallet" },
  { key: "rel_ahc", label: "Relative, after housing costs", icon: "house" },
  { key: "rel_bhc", label: "Relative, before housing costs", icon: "wallet" },
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

/** The run the headline reads (one chosen policy, or the full package) and its summary. */
function useHeadlineRun(runId) {
  const catalogue = useMeasureCatalogue();
  const id = runId || DEFAULT_SUMMARY_RUN;
  const measure = catalogue.byId?.get(id);
  const { status, summary } = useMilburnSummary(catalogue.manifest?.snapshotSha256 ?? null);
  const run = status === "ready" ? summaryRun(summary, id) : null;
  // One chosen policy is already named in the status line above the page
  return { local: Boolean(catalogue.localBuild), named: Boolean(runId), name: measure ? shortNameOf(measure) : id, summary, run };
}

function Heading({ title, name, named, onlyYear }) {
  return (
    <div className="milburn-key-heading">
      <h3>
        <TitleIcon name="sparkle" />
        {title}
      </h3>
      <SourceChip plural />
      {named ? (
        <p className="visually-hidden">{name}</p>
      ) : (
        <p className="milburn-status-chip">
          <TitleIcon name="layers" bare size={14} />
          {name}
        </p>
      )}
      {/* The box's figures are for this year whatever year is chosen above the page */}
      {onlyYear !== undefined && <YearOnlyChip year={onlyYear} />}
    </div>
  );
}

function Tile({ icon, value, extra, label, note }) {
  return (
    <li className="milburn-key-tile">
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

/**
 * Poverty's headline, over its charts on the local build route: the people
 * moved across the absolute and relative lines, child poverty, and the
 * change on each of the four lines side by side, from milburn_summary.json
 * for the summary's year only (the file has no other year's poverty
 * figures), and labelled so. Nothing while the run or the file is missing.
 */
export function PovertyHeadline({ runId }) {
  const { local, name, named, summary, run } = useHeadlineRun(runId);
  if (!local || !run) return null;
  const direction = (count) => (count >= 0 ? "into" : "out of");
  const lines = POVERTY_LINES.filter((line) => run.povertyPp[line.key] !== null);
  const values = lines.map((line) => run.povertyPp[line.key]);
  return (
    <section className="report-section milburn-key card" aria-label="Poverty headline">
      <Heading title="Poverty at a glance" name={name} named={named} onlyYear={summary.year} />
      <ul className="milburn-key-tiles" aria-label="Figures">
        {run.peopleIntoPovertyAbsAhc !== null && (
          <Tile
            icon="usersRound"
            value={formatPeople(run.peopleIntoPovertyAbsAhc)}
            extra={formatSignedPp(run.povertyPp.abs_ahc)}
            label={`People ${direction(run.peopleIntoPovertyAbsAhc)} absolute poverty`}
            note="After housing costs; line fixed in real terms."
          />
        )}
        {run.peopleIntoPovertyRelAhc !== null && (
          <Tile
            icon="scale"
            value={formatPeople(run.peopleIntoPovertyRelAhc)}
            extra={formatSignedPp(run.povertyPp.rel_ahc)}
            label={`People ${direction(run.peopleIntoPovertyRelAhc)} relative poverty`}
            note="After housing costs; line moves with the median."
          />
        )}
        {run.childPovertyPpRelAhc !== null && (
          <Tile
            icon="cake"
            value={formatSignedPp(run.childPovertyPpRelAhc)}
            label="Child poverty rate"
            note="Relative, after housing costs."
          />
        )}
      </ul>
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
                value={formatSignedPp(run.povertyPp[line.key])}
                width={barShare(run.povertyPp[line.key], values)}
                tone={run.povertyPp[line.key] > 0 ? "is-loss" : "is-gain"}
              />
            ))}
          </ul>
        </div>
      )}
      <ul className="milburn-points">
        <li>
          <TitleIcon name="alert" bare size={14} />
          <span>Static: nobody changes their work or claims. Counts rounded to the nearest thousand.</span>
        </li>
      </ul>
      <BenchmarkCallout place="poverty" />
    </section>
  );
}

/**
 * Public finances' headline, over its chart on the local build route: the
 * run's Exchequer saving in each year, the chosen year marked, beside the
 * three packages' range, from milburn_summary.json. Nothing while the run
 * or the file is missing.
 */
export function FinancesHeadline({ runId, selectedYear }) {
  const { local, name, named, summary, run } = useHeadlineRun(runId);
  if (!local || !run) return null;
  const years = Object.keys(run.savingBn).sort();
  if (!years.length) return null;
  const shown = years.includes(String(selectedYear)) ? String(selectedYear) : String(summary.year);
  const current = savingInYear(run, shown);
  const savings = years.map((year) => run.savingBn[year]);
  const range = packageRange(summary);
  const rangeValues = range.map((row) => savingInYear(summaryRun(summary, row.id), summary.year));
  const word = (value) => (value >= 0 ? "saving" : "cost");
  return (
    <section className="report-section milburn-key card" aria-label="Public finances headline">
      <Heading title="Public finances at a glance" name={name} named={named} />
      <div className="milburn-split">
        <ul className="milburn-key-tiles" aria-label="Figures">
          {current !== null && (
            <Tile
              icon="landmark"
              value={formatBn(Math.abs(current))}
              label={`Exchequer ${word(current)}, ${fiscalYearTick(Number(shown))}`}
              note="Static: nobody changes their work or claims."
            />
          )}
        </ul>
        <div className="milburn-meter">
          <h4>
            <TitleIcon name="calendar" bare size={14} />
            By year
          </h4>
          <ul>
            {years.map((year) => (
              <MeterRow
                key={year}
                icon="banknote"
                label={fiscalYearTick(Number(year))}
                value={formatBn(run.savingBn[year])}
                width={barShare(run.savingBn[year], savings)}
                tone={run.savingBn[year] >= 0 ? "is-gain" : "is-loss"}
                current={year === shown}
              />
            ))}
          </ul>
        </div>
        {range.length > 1 && (
          <div className="milburn-meter">
            <h4>
              <TitleIcon name="layers" bare size={14} />
              Package range, {fiscalYearTick(summary.year)}
            </h4>
            <ul>
              {range.map((row, index) => (
                <MeterRow
                  key={row.id}
                  icon="scale"
                  label={row.name}
                  value={row.saving}
                  width={barShare(rangeValues[index], rangeValues)}
                  tone="is-gain"
                  current={row.id === run.id}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
      <ul className="milburn-points">
        <li>
          <TitleIcon name="alert" bare size={14} />
          <span>A positive figure is a saving to the Exchequer; a negative one is a cost.</span>
        </li>
      </ul>
      <BenchmarkCallout place="finances" />
    </section>
  );
}
