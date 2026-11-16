import { useEffect, useState } from "react";
import SectionHeading from "../SectionHeading";
import TitleIcon from "../TitleIcon";
import { useMeasureCatalogue } from "../../utils/measureCatalogue";
import { fiscalYearTick } from "../../utils/chartTheme";
import { useAgeImpactRows } from "../YoungPeopleSection";
import { BENCHMARKS_FILE, BENCHMARK_SHORT, benchmarkGroups, estimateFor, parseBenchmarks, splitValue } from "../../utils/milburn/benchmarks";
import { usePackageTable } from "../../utils/milburn/packageRun";
import "./milburn.css";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Rounded to the nearest thousand: survey estimates carry no finer precision. */
const thousands = (value) =>
  (Math.round(value / 1000) * 1000).toLocaleString("en-GB", { maximumFractionDigits: 0 });

function useBenchmarksFile() {
  const [state, setState] = useState({ status: "loading", data: null });
  useEffect(() => {
    let cancelled = false;
    fetch(`${BASE}/data/${BENCHMARKS_FILE}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        const data = parseBenchmarks(json);
        if (!cancelled) setState({ status: data ? "ready" : "unavailable", data });
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

/**
 * Population impact's Benchmarks sub-tab: published figures on young
 * people and work, with their basis, source and date, and a PolicyEngine
 * estimate beside a figure the verified results can be compared with
 * (blank otherwise, and blank while the results lack it).
 */
export default function BenchmarksTable() {
  const catalogue = useMeasureCatalogue();
  const file = useBenchmarksFile();
  const age = useAgeImpactRows(catalogue);
  const packageAge = usePackageTable(catalogue, "age_impact");

  let body;
  if (file.status === "loading") {
    body = (
      <p className="view-status" role="status">
        Loading benchmarks…
      </p>
    );
  } else if (file.status !== "ready") {
    body = (
      <div className="milburn-unavailable" role="status">
        <p>The benchmarks are not available.</p>
      </div>
    );
  } else {
    const { data } = file;
    const yearLabel = data.year === null ? "" : fiscalYearTick(data.year);
    const card = (row) => {
      const estimate = estimateFor(row, { ageRows: age.rows, packageRows: packageAge.rows, packageKey: packageAge.key, year: data.year });
      const hasEstimate = Boolean(row.estimate?.fixed) || estimate !== null;
      const short = BENCHMARK_SHORT[row.id] ?? {};
      const published = splitValue(row.value);
      const basis = short.basis ?? row.basis;
      return (
        <li key={row.id} className="milburn-bench-card" data-benchmark={row.id}>
          <h4 title={row.figure}>{short.label ?? row.figure}</h4>
          <div className="milburn-bench-figures">
            {published.value && (
              <div className="milburn-bench-figure">
                <span className="milburn-bench-kicker">
                  <TitleIcon name="fileText" bare size={12} /> Published
                </span>
                <span className="milburn-bench-value">{published.value}</span>
              </div>
            )}
            {hasEstimate && (
              <div className="milburn-bench-figure is-estimate">
                <span className="milburn-bench-kicker">
                  <TitleIcon name="calculator" bare size={12} />{" "}
                  {row.estimate.fixed ? row.estimate.label || "PolicyEngine" : `PolicyEngine${yearLabel ? `, ${yearLabel}` : ""}`}
                </span>
                <span className="milburn-bench-value milburn-estimate">{row.estimate.fixed || thousands(estimate)}</span>
              </div>
            )}
          </div>
          <ul className="milburn-bench-notes">
            {published.note && (
              <li title={published.note}>
                <TitleIcon name="pin" bare size={12} />
                <span>{published.note}</span>
              </li>
            )}
            {basis && (
              <li title={row.basis}>
                <TitleIcon name="book" bare size={12} />
                <span>{basis}</span>
              </li>
            )}
            {hasEstimate && (row.estimate.basis || row.estimate.label) && (
              <li title={[row.estimate.basis, row.estimate.label].filter(Boolean).join(". ")}>
                <TitleIcon name="calculator" bare size={12} />
                <span>{row.estimate.basis || row.estimate.label}</span>
              </li>
            )}
          </ul>
          <p className="milburn-bench-meta">
            {row.source &&
              (row.url ? (
                <a className="milburn-source-chip" href={row.url} target="_blank" rel="noopener noreferrer" title={row.source}>
                  <TitleIcon name="link" bare size={12} />
                  <span>{row.source}</span>
                  <span className="visually-hidden"> (opens in a new tab)</span>
                </a>
              ) : (
                <span className="milburn-source-chip">
                  <span>{row.source}</span>
                </span>
              ))}
            {row.date && (
              <span className="milburn-bench-date">
                <TitleIcon name="calendar" bare size={12} />
                {row.date}
              </span>
            )}
            {row.pressReport && <span className="milburn-tag">Press report</span>}
          </p>
        </li>
      );
    };
    body = (
      <section className="report-section" aria-label="Benchmarks">
        <p className="milburn-label" role="note">
          <TitleIcon name="alert" bare size={14} />
          <span>Published figures, each with its own definition and date. PolicyEngine estimates are context, not a check.</span>
        </p>
        {benchmarkGroups(data.rows).map((group) => (
          <div key={group.key} className="milburn-bench-group" data-theme={group.key}>
            <h3>
              <TitleIcon name={group.icon} />
              {group.title}
            </h3>
            <ul className="milburn-bench-grid cols-2">{group.rows.map(card)}</ul>
          </div>
        ))}
        <ul className="milburn-points">
          <li>
            <TitleIcon name="calculator" bare size={14} />
            <span>PolicyEngine estimates are static; each names its build and year.</span>
          </li>
          <li>
            <TitleIcon name="scale" bare size={14} />
            <span>They can count a different group or area from the published figure beside them.</span>
          </li>
          <li>
            <TitleIcon name="usersRound" bare size={14} />
            <span>
              Package figure: people aged 16 to 24 in households whose income falls (
              {catalogue.localBuild ? "local build" : "verified"} run).
            </span>
          </li>
        </ul>
      </section>
    );
  }

  return (
    <div className="results-container milburn-benchmarks">
      <SectionHeading
        icon="scale"
        title="Benchmarks"
        subtitle="Published figures beside PolicyEngine estimates, with sources."
      />
      {body}
    </div>
  );
}
