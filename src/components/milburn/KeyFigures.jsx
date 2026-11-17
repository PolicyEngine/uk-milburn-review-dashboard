import { useMeasureCatalogue } from "../../utils/measureCatalogue";
import { shortNameOf } from "../../utils/policyDetails";
import { fiscalYearTick } from "../../utils/chartTheme";
import {
  formatBn,
  formatPct,
  formatPeople,
  formatPounds,
  formatSignedPp,
  HEADLINE_RUN,
  RELATIVE_LINE_NOTE,
  savingInYear,
  summaryRun,
  useMilburnSummary,
} from "../../utils/milburn/summary";
import { RANGE_IDS, milburnDisplayName } from "../../utils/milburn/measureGroups";
import TitleIcon from "../TitleIcon";
import BenchmarkCallout from "./BenchmarkCallout";
import { buildChartCsv } from "../../utils/chartCsv";
import { CHART_COLOURS } from "../../utils/chartTheme";
import { ChartPanel, FiguresTable, HorizontalBars, MilburnChartCard, YearOnlyChip } from "./MilburnCharts";
import "./milburn.css";

/**
 * Why the report's package is an upper bound: no replacement payments, and
 * every existing claimant reached at once (the report reaches them at
 * reassessment; the phased run shows that timing).
 */
export const REPLACEMENT_NOT_MODELLED_NOTE =
  "With no replacement payments modelled and every claimant reached in April 2029, not at reassessment, the full package is an upper bound on losses.";

/** A headline card's visible line when it shows the fallback run, not one selected policy. */
export function fallbackRunLine(name) {
  return `Showing: ${name}. Select a single policy to see its own figures.`;
}

/** What those replacements are, as the final report names them (paragraphs 107 and 750 to 757). */
export const REPLACEMENT_PARTS_NOTE =
  "Left out: Additional Cost Allowance (ongoing costs), local Health and Disability Fund (one-off or changing costs), Severe and Complex Needs Insurance.";

/** Beside our £ figures: they are cash, where the review's sit in 2026-27 prices. */
export const CASH_TERMS_NOTE = "Cash terms; the review’s figures are in 2026-27 prices.";

/** Said once in a box's folded notes: what "static" means, and how counts are rounded. */
export const STATIC_NOTE = "Static: nobody changes their work or claims. Counts rounded to the nearest thousand.";

/**
 * The range strip's short names for its runs, by position in RANGE_IDS: what
 * each run does, never "central", which would read as a best estimate.
 */
const RANGE_NAMES = ["Full removal", "Partial removal", "Phased"];

/**
 * The packages' range, whatever run is selected: each package's saving and
 * the people moved into absolute poverty before housing costs, from
 * milburn_summary.json. A package the file does not list is left out.
 */
export function packageRange(summary) {
  return RANGE_IDS.map((id, index) => {
    const run = summaryRun(summary, id);
    if (!run) return null;
    return {
      id,
      name: RANGE_NAMES[index] ?? milburnDisplayName(id, id),
      saving: formatBn(savingInYear(run, summary.year)),
      savingValue: savingInYear(run, summary.year),
      povertyValue: run.peopleIntoPovertyAbs,
      poverty: run.peopleIntoPovertyAbs === null ? "" : `about ${formatPeople(run.peopleIntoPovertyAbs)}`,
    };
  }).filter(Boolean);
}

/** Under the range's title when the run shown above is one of the packages. */
export const RANGE_WITH_SELECTION =
  "Our designs, side by side; the one shown above is in full colour. Partial removal (severe cases kept, PIP at half rate) is a pre-report run from April 2027: the report has no such run.";

/** Under the range's title when the run shown above is not a package: nothing is picked out. */
export const RANGE_WITHOUT_SELECTION =
  "Our designs, for context: the report’s health element and PIP changes with no replacement, the same phased in, and a pre-report partial removal (severe cases kept, PIP at half rate) that the report has no run for.";

function RangeStrip({ summary, selectedId }) {
  const rows = packageRange(summary);
  if (!rows.length) return null;
  const yearLabel = fiscalYearTick(summary.year);
  const title = `Package range (our designs), ${yearLabel}`;
  // The selected package at full strength, the others faded; all at full
  // strength, and none said to be selected, when the selection is not one
  // of the packages
  const packageSelected = rows.some((row) => row.id === selectedId);
  const faded = (row) => packageSelected && row.id !== selectedId;
  const csv = () =>
    buildChartCsv({
      title,
      units: "Exchequer saving in £bn; people moved into absolute poverty before housing costs",
      columns: [
        { key: "name", label: "Package" },
        { key: "savingValue", label: "Exchequer saving (£bn)", decimals: 3 },
        { key: "povertyValue", label: "People into absolute poverty before housing costs", decimals: 0 },
      ],
      rows,
    });
  return (
    <MilburnChartCard
      as="h4"
      icon="layers"
      title={title}
      description={packageSelected ? RANGE_WITH_SELECTION : RANGE_WITHOUT_SELECTION}
      name="package-range"
      csv={csv}
      className="milburn-range"
      after={
        <FiguresTable>
          <table className="milburn-table">
            <caption className="visually-hidden">{title}</caption>
            <thead>
              <tr>
                <th scope="col">Package</th>
                <th scope="col">Exchequer saving</th>
                <th scope="col">Into absolute poverty (before housing costs)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} data-run={row.id} className={row.id === selectedId ? "is-selected" : undefined}>
                  <th scope="row">{row.name}</th>
                  <td>{row.saving || "Not in the summary"}</td>
                  <td>{row.poverty || "Not in the summary"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </FiguresTable>
      }
    >
      <div className="milburn-chart-grid cols-2">
        <ChartPanel icon="landmark" title="Exchequer saving (£bn)">
          <HorizontalBars
            ariaLabel={`Exchequer saving by package: ${rows.map((row) => `${row.name} ${row.saving}`).join(", ")}`}
            format={(value) => `£${value}bn`}
            labelWidth={96}
            rows={rows.map((row) => ({ name: row.name, value: row.savingValue, label: row.saving, color: CHART_COLOURS.gain, faded: faded(row) }))}
          />
        </ChartPanel>
        <ChartPanel icon="percent" title="People into absolute poverty, before housing costs">
          <HorizontalBars
            ariaLabel={`People moved into absolute poverty before housing costs by package: ${rows.map((row) => `${row.name} ${row.poverty}`).join(", ")}`}
            format={(value) => (Math.abs(value) >= 1000 ? `${value / 1000}k` : String(value))}
            labelWidth={96}
            rows={rows.map((row) => ({ name: row.name, value: row.povertyValue, label: row.poverty, color: CHART_COLOURS.loss, faded: faded(row) }))}
          />
        </ChartPanel>
      </div>
    </MilburnChartCard>
  );
}

/** The relative poverty figure as one footnote sentence, or null when the run carries none. */
export function relativePovertySentence(run) {
  const count = run?.peopleIntoPovertyRel;
  if (count === null || count === undefined) return null;
  const pp = run.povertyPp.rel_bhc;
  return `Relative poverty (60% of median, before housing costs): ${formatPeople(count)} people move ${count >= 0 ? "into" : "out of"} it${pp !== null ? ` (${formatSignedPp(pp)})` : ""}.`;
}

/**
 * The tiles for one run of milburn_summary.json, in its year: each a
 * figure, a short label and a one-line definition. A figure the file does
 * not carry is left out, never shown as zero.
 */
export function keyFigureTiles(run, year) {
  const yearLabel = fiscalYearTick(year);
  // A gain run's "losing" fields hold the gaining households (summary.js)
  const gain = run.direction === "gain";
  const tiles = [];
  const saving = savingInYear(run, year);
  if (saving !== null) {
    tiles.push({
      key: "saving",
      icon: "landmark",
      value: formatBn(Math.abs(saving)),
      label: `${saving >= 0 ? "Exchequer saving" : "Exchequer cost"}, ${yearLabel}`,
      definition: CASH_TERMS_NOTE,
    });
  }
  if (run.youngPeopleLosing !== null) {
    tiles.push({
      key: "young",
      icon: "usersRound",
      value: formatPeople(run.youngPeopleLosing),
      extra: run.youngShareLosingPct !== null ? `${formatPct(run.youngShareLosingPct)} of 16–24s` : null,
      label: `16–24s in households that ${gain ? "gain" : "lose"}`,
      definition: "Includes siblings, partners.",
    });
  }
  if (run.averageLossYoung !== null) {
    tiles.push({
      key: "loss",
      icon: "wallet",
      value: formatPounds(Math.abs(run.averageLossYoung)),
      extra: "a year",
      label: `Their average household ${gain ? "gain" : "loss"}`,
      definition: "Per household, not per person.",
    });
  }
  // Absolute poverty first: its line is fixed in real terms, while the
  // relative line moves with the measures' effect on the median
  const povertyTile = (key, count, pp, basis, definition) => {
    if (count === null) return;
    tiles.push({
      key,
      icon: "percent",
      value: formatPeople(count),
      extra: pp !== null ? formatSignedPp(pp) : null,
      label: `People ${count >= 0 ? "into" : "out of"} ${basis} poverty`,
      definition,
    });
  };
  povertyTile(
    "poverty-abs",
    run.peopleIntoPovertyAbs,
    run.povertyPp.abs_bhc,
    "absolute",
    "Before housing costs, all ages.",
  );
  return tiles;
}

/**
 * Key figures at the top of the Young people sub-tab, for the selected run
 * (the report's package, named on the card, unless one policy is chosen), from public/data/milburn_summary.json.
 * A run the file does not list says it has not yet run. Only on the local
 * build route.
 */
export default function KeyFigures({ runId }) {
  const catalogue = useMeasureCatalogue();
  const id = runId || HEADLINE_RUN;
  const measure = catalogue.byId?.get(id);
  const name = measure ? shortNameOf(measure) : id;
  // Read afresh whenever the runs the page read change
  const { status, summary } = useMilburnSummary(catalogue.manifest?.snapshotSha256 ?? null);
  if (!catalogue.localBuild) return null;

  const heading = (
    <div className="milburn-key-heading">
      <h3>
        <TitleIcon name="sparkle" />
        Key figures
      </h3>
      {/* One selected policy: the header's button names it (screen readers only here); otherwise the fallback is named on the card */}
      {runId ? <p className="visually-hidden">{name}</p> : <p data-fallback-run="">{fallbackRunLine(name)}</p>}
      {status === "ready" && <YearOnlyChip year={summary.year} />}
    </div>
  );
  let body;
  if (status === "loading") {
    body = (
      <p className="view-status" role="status">
        Loading key figures…
      </p>
    );
  } else if (status !== "ready") {
    body = <p className="milburn-key-missing" role="status">Key figures are not available: the summary file has not been written yet.</p>;
  } else {
    const run = summaryRun(summary, id);
    const tiles = run ? keyFigureTiles(run, summary.year) : [];
    body = !run ? (
      <p className="milburn-key-missing" role="status">
        Not yet run: the key figures for {name} appear here once its national run has finished.
      </p>
    ) : !tiles.length ? (
      <p className="milburn-key-missing" role="status">The summary file carries no key figures for {name}.</p>
    ) : (
      <ul className="milburn-key-tiles" aria-label="Figures">
        {tiles.map((tile) => (
          <li key={tile.key} className="milburn-key-tile" data-key={tile.key}>
            <TitleIcon name={tile.icon} className="milburn-key-icon" size={18} />
            <p className="milburn-key-value">
              {tile.value}
              {tile.extra && <span className="milburn-key-extra"> {tile.extra}</span>}
            </p>
            <p className="milburn-key-label">{tile.label}</p>
            {tile.definition && <p className="milburn-key-definition">{tile.definition}</p>}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <section className="report-section milburn-key card" aria-label="Key figures">
      {heading}
      {body}
      {/* Under the tiles, once the run has figures to set them beside */}
      {status === "ready" && summaryRun(summary, id) && <BenchmarkCallout place="young" />}
      {status === "ready" && <RangeStrip summary={summary} selectedId={id} />}
      <details className="milburn-details">
        <summary>
          <TitleIcon name="alert" bare size={14} />
          Notes and caveats
        </summary>
        <ul className="milburn-points">
          {/* Relative poverty, folded with the notes (Vahid, 17 Nov) */}
          {status === "ready" && relativePovertySentence(summaryRun(summary, id)) && (
            <li data-poverty-note="">
              <TitleIcon name="percent" bare size={14} />
              <span>{relativePovertySentence(summaryRun(summary, id))}</span>
            </li>
          )}
          <li>
            <TitleIcon name="scale" bare size={14} />
            <span>{RELATIVE_LINE_NOTE}</span>
          </li>
          <li data-replacement-note="">
            <TitleIcon name="alert" bare size={14} />
            <span>{REPLACEMENT_NOT_MODELLED_NOTE}</span>
          </li>
          <li>
            <TitleIcon name="lifebuoy" bare size={14} />
            <span>{REPLACEMENT_PARTS_NOTE}</span>
          </li>
          <li>
            <TitleIcon name="calendar" bare size={14} />
            <span>{STATIC_NOTE}</span>
          </li>
        </ul>
      </details>
    </section>
  );
}
