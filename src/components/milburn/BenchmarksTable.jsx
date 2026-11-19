import { useCallback, useEffect, useMemo, useState } from "react";
import SectionHeading from "../SectionHeading";
import TitleIcon from "../TitleIcon";
import ChartDownloadMenu from "../ChartDownloadMenu";
import { useMeasureCatalogue } from "../../utils/measureCatalogue";
import { DownloadContext } from "../../utils/downloadContext";
import { fiscalYearTick } from "../../utils/chartTheme";
import { buildChartCsv } from "../../utils/chartCsv";
import { downloadFile } from "../../utils/downloadFile";
import { htmlImageFormats } from "../../utils/chartDownloads";
import { frameCsv, frameFileName } from "../../utils/exportFrame";
import { useAgeImpactRows } from "../YoungPeopleSection";
import {
  BENCHMARKS_FILE,
  BENCHMARK_SHORT,
  BENCHMARK_TOPICS,
  OURS_TOPIC,
  groupsForTopic,
  benchmarkGroups,
  comparisonFor,
  toleranceFor,
  toleranceWords,
  differentBasis,
  estimateFor,
  INDICATIVE_GAP_NOTE,
  parseBenchmarks,
  TOLERANCE_RULE,
  topicFromSearch,
} from "../../utils/milburn/benchmarks";
import { usePackageTable } from "../../utils/milburn/packageRun";
import { ComparePanel, StatTile, thousands } from "./BenchmarkCards";
import "./milburn.css";
import "./BenchmarksTable.css";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** The tiles a section shows before "Show all". */
export const TILES_SHOWN = 8;

const NO_SELECTION = Object.freeze({ policies: null, provisional: null });

/** The address's topic parameter. */
const TOPIC_PARAM = "bm";

function useBenchmarksFile() {
  const [state, setState] = useState({ status: "loading", data: null });
  useEffect(() => {
    let cancelled = false;
    fetch(`${BASE}/data/${BENCHMARKS_FILE}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        const data = parseBenchmarks(json);
        if (!cancelled)
          setState({ status: data ? "ready" : "unavailable", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "unavailable", data: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

/** Put the topic in the address (?bm=), or take it out for "all"; replaceState, so history is not filled. */
function writeTopic(topic) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (topic === "all") params.delete(TOPIC_PARAM);
  else params.set(TOPIC_PARAM, topic);
  const search = params.toString();
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`,
  );
}

/**
 * The topic shown, read from the address once and kept there. Read on the
 * first render: the topic only shows once the file has loaded, so the
 * server's page (loading) and the first render agree.
 */
function useTopic() {
  const [topic, setTopicState] = useState(() => (typeof window === "undefined" ? "all" : topicFromSearch(window.location.search)));
  useEffect(() => {
    // The topic is this sub-tab's own: out of the address when the panel unmounts with
    // another sub-tab open (checked a moment later, so a remount in place keeps it). A panel
    // kept mounted but hidden leaves ?bm= in place; other sub-tabs ignore it, and Benchmarks
    // reopens on that topic.
    return () => {
      window.setTimeout(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("sub") !== "benchmarks") writeTopic("all");
      }, 0);
    };
  }, []);
  const setTopic = useCallback((next) => {
    setTopicState(next);
    writeTopic(next);
  }, []);
  return [topic, setTopic];
}

/** Every row as one CSV line: both figures as worded, bases, sources and dates, the gap where there is one. */
export function benchmarksCsv(groups, estimates) {
  const rows = groups.flatMap((group) =>
    group.rows.map((row) => {
      const comparison = comparisonFor(row);
      const basis = differentBasis(row.id);
      const estimate =
        row.estimate?.fixed ||
        (estimates.get(row.id) != null ? thousands(estimates.get(row.id)) : "");
      return {
        section: group.chip,
        figure: BENCHMARK_SHORT[row.id]?.label ?? row.figure,
        published: row.value,
        basis: row.basis,
        source: row.source,
        date: row.date,
        url: row.url ?? "",
        estimate,
        estimateBasis: row.estimate?.fixed
          ? row.estimate.basis
          : (row.estimate?.label ?? ""),
        build: row.estimate?.fixed ? row.estimate.label : "",
        gap: comparison && !basis && comparison.gapPp == null ? Math.round(comparison.gapPct) : null,
        gapPp: comparison && !basis && comparison.gapPp != null ? Math.round(comparison.gapPp * 10) / 10 : null,
        likeForLike: comparison ? (basis ? `No: ${basis}` : "Yes") : "",
        tolerance: (() => {
          const verdict = toleranceFor(row);
          if (!verdict) return "";
          return verdict.tested ? toleranceWords(verdict) : `Not tested: ${verdict.reason}`;
        })(),
        why: row.estimate?.note ?? "",
        saving: row.saving ? `${row.saving.label}: ${row.saving.value}` : "",
      };
    }),
  );
  return buildChartCsv({
    title: "Benchmarks: published figures beside PolicyEngine estimates",
    units: "As worded in each source; gap in % of the published figure",
    source: "Each row's own source; PolicyEngine UK estimates",
    columns: [
      { key: "section", label: "Topic" },
      { key: "figure", label: "Figure" },
      { key: "published", label: "Published" },
      { key: "basis", label: "Published basis" },
      { key: "source", label: "Source" },
      { key: "date", label: "Date" },
      { key: "url", label: "Link" },
      { key: "estimate", label: "PolicyEngine" },
      { key: "estimateBasis", label: "PolicyEngine basis" },
      { key: "build", label: "PolicyEngine build" },
      { key: "gap", label: "Gap (%)", decimals: 0 },
      { key: "gapPp", label: "Gap (pp), for shares", decimals: 1 },
      { key: "likeForLike", label: "Like for like" },
      { key: "tolerance", label: "15% tolerance" },
      { key: "why", label: "Why they differ" },
      { key: "saving", label: "Our saving or net cost, apart" },
    ],
    rows,
  });
}

/** The topic filter: one pressed button a topic, each with how many figures it holds. */
function TopicFilter({ topic, onChange, counts }) {
  return (
    <div className="bm-filter" role="group" aria-label="Show figures on">
      {BENCHMARK_TOPICS.filter(
        (each) => each.key === "all" || counts[each.key] > 0,
      ).map((each) => (
        <button
          key={each.key}
          type="button"
          className="bm-filter-chip"
          aria-pressed={topic === each.key}
          data-topic={each.key}
          onClick={() => onChange(each.key)}
        >
          {each.chip}
          <span className="bm-filter-count">
            {each.key === "all" ? counts.all : counts[each.key]}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * Population impact's Benchmarks sub-tab: a topic filter (kept in the
 * address as ?bm=) over the sections, each a grid of equal-sized cards.
 * Comparable pairs are compact cards (both figures large, the gap as a
 * badge, two thin bars, the source chip); every other figure is a stat
 * tile with a small graphic where its wording is a series. Each card's
 * long wording (why the two differ, both bases, our build, our saving)
 * is in its "More info". A CSV of every figure beside the filter.
 */
export default function BenchmarksTable() {
  const catalogue = useMeasureCatalogue();
  const file = useBenchmarksFile();
  const age = useAgeImpactRows(catalogue);
  const packageAge = usePackageTable(catalogue, "age_impact");
  const [topic, setTopic] = useTopic();
  const [expanded, setExpanded] = useState({});
  // The figures shown (the topic chosen), drawn as the image downloads
  const [cards, setCards] = useState(null);

  const ready = file.status === "ready" ? file.data : null;
  const groups = useMemo(
    () => (ready ? benchmarkGroups(ready.rows) : []),
    [ready],
  );
  const estimates = new Map(
    (ready?.rows ?? []).map((row) => [
      row.id,
      ready
        ? estimateFor(row, {
            ageRows: age.rows,
            packageRows: packageAge.rows,
            packageKey: packageAge.key,
            year: ready.year,
          })
        : null,
    ]),
  );

  let body;
  if (file.status === "loading") {
    body = (
      <p className="view-status" role="status">
        Loading benchmarks…
      </p>
    );
  } else if (!ready) {
    body = (
      <div className="milburn-unavailable" role="status">
        <p>The benchmarks are not available.</p>
      </div>
    );
  } else {
    const yearLabel = ready.year === null ? "" : fiscalYearTick(ready.year);
    // The estimate's year only: which route built the run is no reader's concern
    const runLabel = yearLabel;
    // Only the rows the sections show: the file holds figures no section draws
    const shownRows = groups.flatMap((group) => group.rows);
    const counts = Object.fromEntries([
      ["all", shownRows.length],
      [OURS_TOPIC, shownRows.filter((row) => row.estimate).length],
      ...groups.map((group) => [group.key, group.rows.length]),
    ]);
    const shown = groupsForTopic(groups, topic);
    // The builds our fixed figures come from, once, in the folded notes
    const builds = [
      ...new Set(
        shownRows
          .map((row) => (row.estimate?.fixed ? row.estimate.label : ""))
          .filter(Boolean),
      ),
    ];
    body = (
      <section className="report-section bm" aria-label="Benchmarks">
        <div className="bm-toolbar">
          <TopicFilter topic={topic} onChange={setTopic} counts={counts} />
          <div className="bm-toolbar-download">
            <span className="bm-toolbar-label">All figures</span>
            <ChartDownloadMenu
              chartTitle="Benchmarks"
              ariaLabel="Download the benchmarks: every figure (CSV), or an image of the topic shown (PNG, SVG)"
              formats={{
                csv: (frame) =>
                  downloadFile(
                    frameCsv(benchmarksCsv(groups, estimates), frame),
                    `${frameFileName(frame, "benchmarks")}.csv`,
                    "text/csv;charset=utf-8",
                  ),
                // Images: the cards of the topic shown
                ...htmlImageFormats(
                  () => cards,
                  topic === "all" ? "benchmarks" : `benchmarks-${topic}`,
                ),
              }}
            />
          </div>
        </div>
        <div ref={setCards} className="bm-sections">
          {shown.map((group) => {
            const pairs = group.rows.filter((row) => comparisonFor(row));
            const tiles = group.rows.filter((row) => !comparisonFor(row));
            const open = expanded[group.key] || tiles.length <= TILES_SHOWN + 1;
            const visible = open ? tiles : tiles.slice(0, TILES_SHOWN);
            return (
              <div
                key={group.key}
                className="bm-group"
                data-section={group.key}
              >
                <div className="bm-group-head">
                  <h3>
                    <TitleIcon name={group.icon} />
                    <span className="title-text">{group.title}</span>
                  </h3>
                  <p>{group.intro}</p>
                </div>
                {/* Pairs first, then the section's other figures, in one grid so rows fill */}
                <ul
                  className={`bm-cards${group.key === "context" ? " is-dense" : ""}`}
                  id={`bm-cards-${group.key}`}
                >
                  {pairs.map((row) => (
                    <ComparePanel
                      key={row.id}
                      row={row}
                      comparison={comparisonFor(row)}
                    />
                  ))}
                  {visible.map((row) => (
                    <StatTile
                      key={row.id}
                      row={row}
                      yearLabel={yearLabel}
                      runLabel={runLabel}
                      estimate={estimates.get(row.id)}
                    />
                  ))}
                </ul>
                {tiles.length > visible.length ||
                (open && tiles.length > TILES_SHOWN + 1) ? (
                  <button
                    type="button"
                    className="bm-show-all"
                    aria-expanded={open}
                    aria-controls={`bm-cards-${group.key}`}
                    onClick={() =>
                      setExpanded((was) => ({ ...was, [group.key]: !open }))
                    }
                  >
                    {open ? "Show fewer" : `Show all ${tiles.length} figures`}
                    <TitleIcon
                      name={open ? "arrowUp" : "arrowDown"}
                      bare
                      size={14}
                    />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        <details className="milburn-details bm-about">
          <summary>
            <TitleIcon name="info" bare size={14} />
            About these figures
          </summary>
          <ul className="milburn-points">
            <li>
              <TitleIcon name="calculator" bare size={14} />
              <span>
                PolicyEngine estimates are static.
                {builds.length > 0 ? ` Builds: ${builds.join("; ")}.` : ""}
              </span>
            </li>
            <li>
              <TitleIcon name="percent" bare size={14} />
              <span>
                Gap: the PolicyEngine estimate less the published figure, as a %
                of the published figure, to the nearest whole per cent; given
                only where the two count the same ages, area, year and measure,
                as far as the published figure states them. {INDICATIVE_GAP_NOTE}
              </span>
            </li>
            <li data-tolerance-rule="">
              <TitleIcon name="scale" bare size={14} />
              <span>{TOLERANCE_RULE}</span>
            </li>
            <li>
              <TitleIcon name="scale" bare size={14} />
              <span>
                Where a pair still differs in date or area, it says so and gives
                no gap. Our savings from the measures are in each card's More
                info, never set against spending.
              </span>
            </li>
            <li>
              <TitleIcon name="book" bare size={14} />
              <span>
                The review's own estimates include replacement awards, a Youth
                Allowance, a work allowance and more young people in work, in
                2026-27 prices; our static runs include none of them, so no
                PolicyEngine figure is set beside them.
              </span>
            </li>
            <li>
              <TitleIcon name="hbars" bare size={14} />
              <span>Each card's two bars are on its own scale, from zero.</span>
            </li>
            <li>
              <TitleIcon name="usersRound" bare size={14} />
              <span>
                Package figure: people aged 16 to 24 in households whose income
                falls.
              </span>
            </li>
          </ul>
        </details>
      </section>
    );
  }

  // Published figures do not follow the policies chosen in the header: no policy line in the downloads
  return (
    <DownloadContext.Provider value={NO_SELECTION}>
      <div className="results-container milburn-benchmarks">
        <SectionHeading
          icon="scale"
          title="Benchmarks"
          subtitle="Published figures beside PolicyEngine estimates, with sources."
        />
        {body}
      </div>
    </DownloadContext.Provider>
  );
}
