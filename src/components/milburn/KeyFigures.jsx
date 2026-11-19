import { useRef } from "react";
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
  isWithheld,
  notYetStarted,
  savingInYear,
  REPORT_START_YEAR,
  STARTS_TEXT,
  summaryRun,
  useMilburnSummary,
} from "../../utils/milburn/summary";
import { WITHHELD_DETAIL, WITHHELD_LABEL } from "../../utils/withheld";
import { RANGE_IDS, milburnDisplayName } from "../../utils/milburn/measureGroups";
import TitleIcon from "../TitleIcon";
import BenchmarkCallout from "./BenchmarkCallout";
import { buildChartCsv } from "../../utils/chartCsv";
import { POVERTY_FIGURES_SHOWN } from "../../utils/povertyFigures";
import { BoxDownload, SubTabLink } from "./MilburnCharts";
import "./milburn.css";

/**
 * Why the report's package is an upper bound: no replacement payments, and
 * every existing claimant reached at once (the report reaches them at
 * reassessment; the phased run shows that timing).
 */
export const REPLACEMENT_NOT_MODELLED_NOTE =
  "With no replacement payments modelled and every claimant reached in April 2029, not at reassessment, the full package is an upper bound on losses.";

/**
 * The UC health element and PIP overlap in our data, against the Resolution
 * Foundation's: why more young people lose both than published counts imply.
 */
export const HEALTH_PIP_OVERLAP_NOTE =
  "In our data 90.6% of 16 to 24-year-olds with the UC health element also get PIP, against 62.5% in the Resolution Foundation's figures, so more young people lose both payments than published counts imply.";

/** A headline card's visible line when it shows the fallback run, not one selected policy. */
export function fallbackRunLine(name) {
  return `Showing: ${name}. Select a single policy to see its own figures.`;
}

/** What those replacements are, as the final report names them (paragraphs 107 and 750 to 757). */
export const REPLACEMENT_PARTS_NOTE =
  "Left out: Additional Cost Allowance (ongoing costs), local Health and Disability Fund (one-off or changing costs), Severe and Complex Needs Insurance.";

/** Beside our £ figures: they are cash, where the review's sit in 2026-27 prices. */
export const CASH_TERMS_NOTE = "Cash terms; the review’s figures are in 2026-27 prices.";

/** Where a box shows counts of people: how they are rounded. */
export const ROUNDING_NOTE = "Counts rounded to the nearest thousand; figures may not sum due to rounding.";

/**
 * The range strip's short names for its runs, by position in RANGE_IDS: what
 * each run does, never "central", which would read as a best estimate.
 */
const RANGE_NAMES = ["Full removal", "Partial removal", "Phased"];

/**
 * The packages' range, whatever run is selected: each package's saving and
 * the people moved into absolute poverty before housing costs, from
 * milburn_summary.json. A package the file does not list is left out.
 * Public finances draws the savings, Poverty the people.
 */
export function packageRange(summary) {
  // Before April 2029 the report's runs have not started, while the partial
  // removal (a pre-report run from April 2027) has: the three would not be
  // like for like, so the range is shown from 2029-30 only.
  if (Number(summary?.year) < REPORT_START_YEAR) return [];
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

/** In the notes of a box that draws the package range: the one run the report has no counterpart for. */
export const PARTIAL_REMOVAL_NOTE =
  "Package range: our designs. Partial removal (severe cases kept, PIP at half rate) is a pre-report run from April 2027: the report has no such run.";

/**
 * Whether a run removes the UC health element or PIP (alone, together or
 * in a package): the runs the upper-bound and left-out replacement notes
 * are about. Youth Allowance and employer NI runs have no replacements.
 */
export const removesHealthOrPip = (id) => /uc_health|pip|package/.test(String(id ?? ""));

/** Every tile keyFigureTiles can make, in order. */
export const ALL_TILE_KEYS = ["saving", "young", "loss", "poverty-abs"];

/**
 * Young people's tiles: the 16 to 24s affected and their average change.
 * The saving is on Public finances and the poverty count on Poverty.
 */
export const YOUNG_TILE_KEYS = ["young", "loss"];

/**
 * The tiles for one run of milburn_summary.json, in its year: each a
 * figure, a short label and a one-line definition. A figure the file does
 * not carry is left out, never shown as zero.
 */
export function keyFigureTiles(run, year, { keys = YOUNG_TILE_KEYS } = {}) {
  const yearLabel = fiscalYearTick(year);
  // A gain run's "losing" fields hold the gaining households (summary.js)
  const gain = run.direction === "gain";
  const tiles = [];
  const saving = savingInYear(run, year);
  // Before the run starts (a report run, from April 2029): its zeros say when it starts
  const notStarted = notYetStarted(run, year);
  if (notStarted) {
    tiles.push({ key: "saving", icon: "landmark", value: STARTS_TEXT, label: `No change in ${yearLabel}`, definition: "The measures start in April 2029." });
    tiles.push({ key: "young", icon: "usersRound", value: STARTS_TEXT, label: `No 16–24s affected in ${yearLabel}`, definition: "The measures start in April 2029." });
  }
  if (!notStarted && saving !== null) {
    tiles.push({
      key: "saving",
      icon: "landmark",
      value: formatBn(Math.abs(saving)),
      label: `${saving >= 0 ? "Exchequer saving" : "Exchequer cost"}, ${yearLabel}`,
      definition: CASH_TERMS_NOTE,
    });
  }
  if (!notStarted && run.youngPeopleLosing !== null) {
    tiles.push({
      key: "young",
      icon: "usersRound",
      value: formatPeople(run.youngPeopleLosing),
      extra: run.youngShareLosingPct !== null ? `${formatPct(run.youngShareLosingPct)} of 16–24s` : null,
      label: `16–24s in households that ${gain ? "gain" : "lose"}`,
      definition: "Includes siblings, partners.",
    });
  }
  if (notStarted) {
    // Nothing to average before the start: no tile, not a withheld one
  } else if (run.averageLossYoung !== null) {
    tiles.push({
      key: "loss",
      icon: "wallet",
      value: formatPounds(Math.abs(run.averageLossYoung)),
      extra: "a year",
      label: `Their average household ${gain ? "gain" : "loss"}`,
      definition: `Annual change in household income, averaged over 16–24s in households that ${gain ? "gain" : "lose"}.`,
    });
  } else if (isWithheld(run, "average_loss_young_person_in_losing_household")) {
    // Withheld by the disclosure floor: said so, never left out silently
    tiles.push({
      key: "loss",
      icon: "wallet",
      value: "Withheld",
      withheld: true,
      label: `Their average household ${gain ? "gain" : "loss"}`,
      definition: `${WITHHELD_LABEL}.`,
      detail: WITHHELD_DETAIL,
    });
  }
  // Absolute poverty first: its line is fixed in real terms, while the
  // relative line moves with the measures' effect on the median
  const povertyTile = (key, count, pp, basis, definition) => {
    // Before the run starts: its zeros say when it starts
    if (notYetStarted(run, year)) {
      tiles.push({ key, icon: "percent", value: STARTS_TEXT, label: `People into or out of ${basis} poverty`, definition });
      return;
    }
    if (count === null) {
      if (isWithheld(run, "people_into_poverty_abs_bhc")) {
        tiles.push({ key, icon: "percent", value: "Withheld", withheld: true, label: `People into or out of ${basis} poverty`, definition: `${WITHHELD_LABEL}.`, detail: WITHHELD_DETAIL });
      }
      return;
    }
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
  return tiles.filter((tile) => keys.includes(tile.key));
}

/** The numbers behind each tile keyFigureTiles makes, by key: the figure, its unit and the extra figure. */
function tileNumbers(run, year) {
  const saving = savingInYear(run, year);
  return {
    saving: { value: saving === null ? null : Math.abs(saving), unit: "£bn a year, cash terms", decimals: 3 },
    young: { value: run.youngPeopleLosing, unit: "people", decimals: 0, extra: run.youngShareLosingPct, extraUnit: "% of 16–24s" },
    loss: { value: run.averageLossYoung === null ? null : Math.abs(run.averageLossYoung), unit: "£ a year, per household", decimals: 0, extra: null },
    "poverty-abs": { value: run.peopleIntoPovertyAbs, unit: "people", decimals: 0, extra: run.povertyPp.abs_bhc, extraUnit: "pp change in the rate" },
  };
}

/** The Key figures box's CSV: one row a tile, its figure unrounded beside the text the tile shows. */
export function keyFiguresCsv(run, year, name, { keys = YOUNG_TILE_KEYS } = {}) {
  const numbers = tileNumbers(run, year);
  const rows = keyFigureTiles(run, year, { keys }).map((tile) => {
    const number = numbers[tile.key];
    return {
      figure: tile.label,
      value: number.value,
      unit: number.unit,
      extra: number.extra ?? null,
      extraUnit: number.extra === null || number.extra === undefined ? "" : number.extraUnit,
      shown: [tile.value, tile.extra].filter(Boolean).join(" "),
      note: tile.definition ?? "",
    };
  });
  return buildChartCsv({
    title: `Key figures, ${name}, ${fiscalYearTick(year)}`,
    units: `As each row says; values as milburn_summary.json gives them (the page rounds counts to the nearest thousand); static${removesHealthOrPip(run.id) ? ", with no replacement payments modelled" : ""}; an empty value is withheld to protect survey households`,
    columns: [
      { key: "figure", label: "Figure" },
      { key: "value", label: "Value", decimals: 3 },
      { key: "unit", label: "Unit" },
      { key: "extra", label: "Also shown", decimals: 3 },
      { key: "extraUnit", label: "Its unit" },
      { key: "shown", label: "As shown" },
      { key: "note", label: "Note" },
    ],
    rows,
  });
}

/**
 * Key figures at the top of the Young people sub-tab, for the selected run
 * (the report's package, named on the card, unless one policy is chosen), from public/data/milburn_summary.json.
 * A run the file does not list says it has not yet run. Only on the local
 * build route.
 */
export default function KeyFigures({ runId, selectedYear }) {
  const catalogue = useMeasureCatalogue();
  const id = runId || HEADLINE_RUN;
  const measure = catalogue.byId?.get(id);
  const name = measure ? shortNameOf(measure) : id;
  // The tiles, for the box's image download
  const tilesRef = useRef(null);
  // Read afresh whenever the runs the page read change
  // The chosen year's figures (milburn_summary.json's by_year)
  const { status, summary } = useMilburnSummary(catalogue.manifest?.snapshotSha256 ?? null, { year: selectedYear });
  if (!catalogue.localBuild) return null;

  const run = status === "ready" ? summaryRun(summary, id) : null;
  const tiles = run ? keyFigureTiles(run, summary.year) : [];
  // The file's subtitle names the header's selection; the fallback run is named in the title
  const title = `Key figures${runId ? "" : `, ${name}`}${status === "ready" ? `, ${fiscalYearTick(summary.year)}` : ""}`;
  const heading = (
    <div className="milburn-key-heading">
      <h3>
        <TitleIcon name="sparkle" />
        Key figures
      </h3>
      {/* One selected policy: the header's button names it (screen readers only here); otherwise the fallback is named on the card */}
      {runId ? <p className="visually-hidden">{name}</p> : <p data-fallback-run="">{fallbackRunLine(name)}</p>}
      {tiles.length > 0 && (
        <BoxDownload title={title} name="key-figures" targetRef={tilesRef} csv={() => keyFiguresCsv(run, summary.year, name)} />
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
    body = !run ? (
      <p className="milburn-key-missing" role="status">
        Not yet run: the key figures for {name} appear here once its national run has finished.
      </p>
    ) : !tiles.length ? (
      <p className="milburn-key-missing" role="status">The summary file carries no key figures for {name}.</p>
    ) : (
      <ul ref={tilesRef} className="milburn-key-tiles" aria-label="Figures">
        {tiles.map((tile) => (
          <li key={tile.key} className="milburn-key-tile" data-key={tile.key} data-withheld={tile.withheld ? "" : undefined} title={tile.detail}>
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
      <details className="milburn-details">
        <summary>
          <TitleIcon name="alert" bare size={14} />
          Notes and caveats
        </summary>
        <ul className="milburn-points">
          {/* The saving and the poverty count have their own sub-tabs: linked, not repeated */}
          {run && (
            <li data-see-also="">
              <TitleIcon name="arrowRight" bare size={14} />
              <span>
                {run.direction === "gain" ? "Exchequer cost" : "Exchequer saving"}: <SubTabLink sub="finances">Public finances</SubTabLink>
                {POVERTY_FIGURES_SHOWN && (
                  <>
                    {" · "}Poverty: <SubTabLink sub="poverty">Poverty</SubTabLink>
                  </>
                )}
              </span>
            </li>
          )}
          {/* The health element and PIP runs only: the upper bound and the
              replacements left out (none applies to the other runs) */}
          {removesHealthOrPip(id) && (
            <>
              <li data-replacement-note="">
                <TitleIcon name="alert" bare size={14} />
                <span>{REPLACEMENT_NOT_MODELLED_NOTE}</span>
              </li>
              <li>
                <TitleIcon name="lifebuoy" bare size={14} />
                <span>{REPLACEMENT_PARTS_NOTE}</span>
              </li>
              <li data-overlap-note="">
                <TitleIcon name="usersRound" bare size={14} />
                <span>{HEALTH_PIP_OVERLAP_NOTE}</span>
              </li>
            </>
          )}
          <li>
            <TitleIcon name="calendar" bare size={14} />
            <span>{ROUNDING_NOTE}</span>
          </li>
        </ul>
      </details>
      {/* Published figures: a link to Benchmarks, once the run has figures to set them beside */}
      {run && <BenchmarkCallout place="young" />}
    </section>
  );
}
