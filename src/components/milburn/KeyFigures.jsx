import { useMeasureCatalogue } from "../../utils/measureCatalogue";
import { shortNameOf } from "../../utils/policyDetails";
import { fiscalYearTick } from "../../utils/chartTheme";
import {
  DEFAULT_SUMMARY_RUN,
  formatBn,
  formatPct,
  formatPeople,
  formatPounds,
  formatSignedPp,
  RELATIVE_LINE_NOTE,
  savingInYear,
  summaryRun,
  useMilburnSummary,
} from "../../utils/milburn/summary";
import { PACKAGE_IDS, milburnDisplayName } from "../../utils/milburn/measureGroups";
import "./milburn.css";

/** The replacement support briefed for the review, which no run models. */
export const REPLACEMENT_NOT_MODELLED_NOTE =
  "The replacement support briefed for the review is not modelled: a discretionary local fund, an allowance for the extra costs of the most disabled, a higher payment for those who can never work, and conditionality. The full package is therefore an upper bound on losses.";

/** The range strip's short names for the packages, by position in PACKAGE_IDS. */
const RANGE_NAMES = ["Upper bound", "Central", "Phased"];

/**
 * The packages' range, whatever run is selected: each package's saving and
 * the people moved into absolute poverty after housing costs, from
 * milburn_summary.json. A package the file does not list is left out.
 */
export function packageRange(summary) {
  return PACKAGE_IDS.map((id, index) => {
    const run = summaryRun(summary, id);
    if (!run) return null;
    return {
      id,
      name: RANGE_NAMES[index] ?? milburnDisplayName(id, id),
      saving: formatBn(savingInYear(run, summary.year)),
      poverty: run.peopleIntoPovertyAbsAhc === null ? "" : `about ${formatPeople(run.peopleIntoPovertyAbsAhc)}`,
    };
  }).filter(Boolean);
}

function RangeStrip({ summary }) {
  const rows = packageRange(summary);
  if (!rows.length) return null;
  return (
    <div className="milburn-table-wrap milburn-range">
      <table className="milburn-table">
        <caption>The packages&rsquo; range, {fiscalYearTick(summary.year)}</caption>
        <thead>
          <tr>
            <th scope="col">Package</th>
            <th scope="col">Exchequer saving</th>
            <th scope="col">People moved into absolute poverty after housing costs</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-run={row.id}>
              <th scope="row">{row.name}</th>
              <td>{row.saving || "Not in the summary"}</td>
              <td>{row.poverty || "Not in the summary"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The relative poverty figure as one footnote sentence, or null when the run carries none. */
export function relativePovertySentence(run) {
  const count = run?.peopleIntoPovertyRelAhc;
  if (count === null || count === undefined) return null;
  const pp = run.povertyPp.rel_ahc;
  return `On the relative line (60% of median income after housing costs), ${formatPeople(count)} people move ${count >= 0 ? "into" : "out of"} poverty${pp !== null ? ` (${formatSignedPp(pp)})` : ""}.`;
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
      value: formatBn(Math.abs(saving)),
      label: `${saving >= 0 ? "Exchequer saving" : "Exchequer cost"}, ${yearLabel}`,
      definition: "Static: the change in benefit spending and tax receipts with nobody changing their work or claims.",
    });
  }
  if (run.youngPeopleLosing !== null) {
    tiles.push({
      key: "young",
      value: formatPeople(run.youngPeopleLosing),
      extra: run.youngShareLosingPct !== null ? `${formatPct(run.youngShareLosingPct)} of 16–24s` : null,
      label: `Young people aged 16–24 living in households that ${gain ? "gain" : "lose"}`,
      definition: `16–24-year-olds living in a household whose net income ${gain ? "rises" : "falls"}, including siblings and partners, not only claimants.`,
    });
  }
  if (run.averageLossYoung !== null) {
    tiles.push({
      key: "loss",
      value: formatPounds(Math.abs(run.averageLossYoung)),
      extra: "a year",
      label: `Their average household ${gain ? "gain" : "loss"}`,
      definition: gain
        ? "The average rise in household net income across those young people, each counting their whole household's gain."
        : "The average fall in household net income across those young people, each counting their whole household's loss.",
    });
  }
  // Absolute poverty first: its line is fixed in real terms, while the
  // relative line moves with the measures' effect on the median
  const povertyTile = (key, count, pp, basis, definition) => {
    if (count === null) return;
    tiles.push({
      key,
      value: formatPeople(count),
      extra: pp !== null ? formatSignedPp(pp) : null,
      label: `People moved ${count >= 0 ? "into" : "out of"} ${basis} poverty after housing costs`,
      definition,
    });
  };
  povertyTile(
    "poverty-abs",
    run.peopleIntoPovertyAbsAhc,
    run.povertyPp.abs_ahc,
    "absolute",
    "The change in the number of people of all ages in households below the absolute poverty line after housing costs, which is fixed in real terms.",
  );
  return tiles;
}

/**
 * Key figures at the top of the Young people sub-tab, for the selected run
 * (the full package by default), from public/data/milburn_summary.json.
 * A run the file does not list says it has not yet run. Only on the local
 * build route.
 */
export default function KeyFigures({ runId }) {
  const catalogue = useMeasureCatalogue();
  const id = runId || DEFAULT_SUMMARY_RUN;
  const measure = catalogue.byId?.get(id);
  const name = measure ? shortNameOf(measure) : id;
  // Read afresh whenever the runs the page read change
  const { status, summary } = useMilburnSummary(catalogue.manifest?.snapshotSha256 ?? null);
  if (!catalogue.localBuild) return null;

  const heading = (
    <div className="milburn-key-heading">
      <h3>Key figures</h3>
      <p>{name}</p>
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
      <ul className="milburn-key-tiles">
        {tiles.map((tile) => (
          <li key={tile.key} className="milburn-key-tile" data-key={tile.key}>
            <p className="milburn-key-value">
              {tile.value}
              {tile.extra && <span className="milburn-key-extra"> {tile.extra}</span>}
            </p>
            <p className="milburn-key-label">{tile.label}</p>
            <p className="milburn-key-definition">{tile.definition}</p>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <section className="report-section milburn-key card" aria-label="Key figures">
      {heading}
      {body}
      {status === "ready" && relativePovertySentence(summaryRun(summary, id)) && (
        <p className="milburn-key-foot" data-poverty-note="">
          {relativePovertySentence(summaryRun(summary, id))} {RELATIVE_LINE_NOTE}
        </p>
      )}
      {status === "ready" && <RangeStrip summary={summary} />}
      <p className="milburn-key-foot" data-replacement-note="">
        {REPLACEMENT_NOT_MODELLED_NOTE}
      </p>
      <p className="milburn-key-foot">
        Static estimates for {fiscalYearTick(summary?.year ?? 2027)}, against current law. Counts are rounded to the nearest thousand.
      </p>
    </section>
  );
}
