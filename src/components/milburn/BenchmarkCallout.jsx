import { useEffect, useState } from "react";
import TitleIcon from "../TitleIcon";
import { BENCHMARKS_FILE, BENCHMARK_ICON, BENCHMARK_SHORT, parseBenchmarks, splitValue } from "../../utils/milburn/benchmarks";
import { openPopulationSub, populationSubHref } from "../../utils/populationSub";
import { REPORT_DAY, subShownOnReportDay } from "../../utils/milburn/reportDay";
import "./BenchmarkCallout.css";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

/**
 * The published figures shown beside our own, by place: rows of
 * public/data/milburn_benchmarks.json by id, each with one line saying how
 * the published figure differs from the PolicyEngine figure it sits beside
 * (year, prices, design or employment effects). The figure, source, link
 * and date come from the file; only this line (and one shorter label) is
 * written here, and it holds whichever measure or package is selected.
 */
export const BENCHMARK_PLACES = {
  finances: [
    {
      id: "review_welfare_saving_2036",
      differs: "In 2026-27 prices, with replacement awards and an employment effect; ours is static, for earlier years.",
    },
    {
      id: "milburn_welfare_saving_10y",
      // The figure already names the year the card's title ends on
      label: "Cumulative welfare savings the review estimates",
      differs: "Eight years summed, 2029-30 to 2036-37, in 2026-27 prices; ours are single-year figures.",
    },
    {
      id: "pip_spend_16_24",
      differs: "Spending in 2025-26: a baseline for an earlier year, not a saving from a measure.",
    },
    {
      id: "uc_health_spend_16_24",
      differs: "Spending in 2025-26: a baseline for an earlier year, not a saving from a measure.",
    },
  ],
  poverty: [
    {
      id: "relative_poverty_review",
      differs: "Fully rolled out, with replacement awards and 440,000 more in work; our relative figure is static.",
    },
    {
      id: "kept_out_of_poverty",
      differs: "A count of young people, not a change from a measure; ours counts people a measure moves across a line.",
    },
  ],
  young: [
    {
      id: "uc_health_element_16_24",
      differs: "People receiving it now; ours counts 16–24s in households a measure affects, not claimants.",
    },
    {
      id: "young_pip_recipients",
      differs: "People receiving it now; ours counts 16–24s in households a measure affects, not recipients.",
    },
    {
      id: "neet_16_24",
      differs: "Labour Force Survey, April to June 2026, UK: not a benefit caseload or a modelled figure.",
    },
  ],
};

/** The benchmarks file, checked (parseBenchmarks); null while loading or when it cannot be read. */
function useBenchmarks() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => fetch(`${BASE}/data/${BENCHMARKS_FILE}`))
      .then((response) => (response?.ok ? response.json() : null))
      .then((json) => {
        if (!cancelled) setData(parseBenchmarks(json));
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return data;
}

/** A place's items with their rows from the file; an id the file lacks, or a row with no figure or link, is left out. */
export function calloutItems(place, rows) {
  return (BENCHMARK_PLACES[place] ?? [])
    .map((item) => {
      const row = rows?.find((entry) => entry.id === item.id);
      const value = row ? splitValue(row.value).value : "";
      if (!row || !value || !row.url) return null;
      const short = BENCHMARK_SHORT[row.id] ?? {};
      return { ...item, row, value, label: item.label ?? short.label ?? row.figure, icon: short.icon ?? BENCHMARK_ICON };
    })
    .filter(Boolean);
}

/**
 * A quiet "Published figures" strip inside a headline box: for one place
 * (`finances`, `poverty` or `young`), each published figure with its icon,
 * one line on how it differs from ours, and its source and date, then a
 * link to the Benchmarks sub-tab. Nothing while the file is loading or
 * missing, or while the report-day switch takes Benchmarks down.
 */
export default function BenchmarkCallout({ place, reportDay = REPORT_DAY }) {
  const data = useBenchmarks();
  if (!subShownOnReportDay("benchmarks", reportDay)) return null;
  const items = calloutItems(place, data?.rows);
  if (!items.length) return null;
  return (
    <aside className="bm-callout" aria-label="Published figures" data-place={place}>
      {/* Folded at first (Vahid, 17 Nov): one line with the count; open for
          the figures, their basis and sources */}
      <details className="bm-callout-details">
        <summary className="bm-callout-summary">
          <TitleIcon name="fileText" bare size={14} />
          <span className="bm-callout-title">Published figures</span>
          <span className="bm-callout-count">{items.length}</span>
          <span className="bm-callout-hint">As published, for comparison; not PolicyEngine estimates</span>
        </summary>
        <ul className="bm-callout-items" aria-label="Published figures, with sources">
          {items.map(({ id, row, value, label, icon, differs }) => (
            <li key={id} data-benchmark={id}>
              <TitleIcon name={icon} bare size={15} />
              <div>
                <p className="bm-callout-figure">
                  <strong>{value}</strong> <span>{label}</span>
                </p>
                <p className="bm-callout-basis" title={row.basis || undefined}>
                  {differs}
                </p>
                <p className="bm-callout-source">
                  <a href={row.url} target="_blank" rel="noopener noreferrer">
                    {row.source}
                  </a>
                  {row.date && <span>, {row.date}</span>}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <a
          className="bm-callout-more"
          href={populationSubHref("benchmarks")}
          onClick={(event) => {
            event.preventDefault();
            openPopulationSub("benchmarks");
          }}
        >
          All benchmarks
          <TitleIcon name="arrowRight" bare size={13} />
        </a>
      </details>
    </aside>
  );
}
