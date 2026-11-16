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
import TitleIcon from "../TitleIcon";
import "./milburn.css";

/** The replacement support briefed for the review, which no run models. */
export const REPLACEMENT_NOT_MODELLED_NOTE =
  "Replacement support is not modelled (local fund, extra-costs allowance, higher payment for those who can never work, conditionality), so the full package is an upper bound on losses.";

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

function RangeStrip({ summary, selectedId }) {
  const rows = packageRange(summary);
  if (!rows.length) return null;
  return (
    <div className="milburn-table-wrap milburn-range">
      <table className="milburn-table">
        <caption>Package range, {fiscalYearTick(summary.year)}</caption>
        <thead>
          <tr>
            <th scope="col">Package</th>
            <th scope="col">Exchequer saving</th>
            <th scope="col">Into absolute poverty (after housing costs)</th>
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
      icon: "landmark",
      value: formatBn(Math.abs(saving)),
      label: `${saving >= 0 ? "Exchequer saving" : "Exchequer cost"}, ${yearLabel}`,
      definition: "Static: nobody changes their work or claims.",
    });
  }
  if (run.youngPeopleLosing !== null) {
    tiles.push({
      key: "young",
      icon: "usersRound",
      value: formatPeople(run.youngPeopleLosing),
      extra: run.youngShareLosingPct !== null ? `${formatPct(run.youngShareLosingPct)} of 16–24s` : null,
      label: `16–24s in households that ${gain ? "gain" : "lose"}`,
      definition: "Everyone aged 16–24 in the household, including siblings and partners, not only claimants.",
    });
  }
  if (run.averageLossYoung !== null) {
    tiles.push({
      key: "loss",
      icon: "wallet",
      value: formatPounds(Math.abs(run.averageLossYoung)),
      extra: "a year",
      label: `Their average household ${gain ? "gain" : "loss"}`,
      definition: `Whole-household ${gain ? "gain" : "loss"}, for those young people only. The charts below average per person over all 16–24s, so their figure is smaller.`,
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
      label: `People moved ${count >= 0 ? "into" : "out of"} ${basis} poverty after housing costs`,
      definition,
    });
  };
  povertyTile(
    "poverty-abs",
    run.peopleIntoPovertyAbsAhc,
    run.povertyPp.abs_ahc,
    "absolute",
    "All ages. The absolute line is fixed in real terms.",
  );
  return tiles;
}

/**
 * Key figures at the top of the Young people sub-tab, for the selected run
 * (the full package by default), from public/data/milburn_summary.json.
 * A run the file does not list says it has not yet run. Only on the local
 * build route.
 */
export default function KeyFigures({ runId, nameShownAbove = false }) {
  const catalogue = useMeasureCatalogue();
  const id = runId || DEFAULT_SUMMARY_RUN;
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
      {/* Already in the status line above when it is the one policy chosen */}
      {nameShownAbove ? (
        <p className="visually-hidden">{name}</p>
      ) : (
        <p className="milburn-status-chip">
          <TitleIcon name="layers" bare size={14} />
          {name}
        </p>
      )}
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
      {status === "ready" && <RangeStrip summary={summary} selectedId={id} />}
      <ul className="milburn-points">
        {status === "ready" && relativePovertySentence(summaryRun(summary, id)) && (
          <li data-poverty-note="">
            <TitleIcon name="percent" bare size={14} />
            <span>
              {relativePovertySentence(summaryRun(summary, id))} {RELATIVE_LINE_NOTE}
            </span>
          </li>
        )}
        <li data-replacement-note="">
          <TitleIcon name="alert" bare size={14} />
          <span>{REPLACEMENT_NOT_MODELLED_NOTE}</span>
        </li>
        <li>
          <TitleIcon name="calendar" bare size={14} />
          <span>Static estimates for {fiscalYearTick(summary?.year ?? 2027)}, against current law. Counts rounded to the nearest thousand.</span>
        </li>
      </ul>
    </section>
  );
}
