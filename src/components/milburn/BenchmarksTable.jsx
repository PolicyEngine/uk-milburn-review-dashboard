import { useEffect, useState } from "react";
import SectionHeading from "../SectionHeading";
import { useMeasureCatalogue } from "../../utils/measureCatalogue";
import { fiscalYearTick } from "../../utils/chartTheme";
import { useAgeImpactRows } from "../YoungPeopleSection";
import { BENCHMARKS_FILE, estimateFor, parseBenchmarks } from "../../utils/milburn/benchmarks";
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
    body = (
      <section className="report-section">
        {data.note && <p className="milburn-label">{data.note}</p>}
        <div className="milburn-table-wrap">
          <table className="milburn-table">
            <thead>
              <tr>
                <th scope="col">Figure</th>
                <th scope="col">Value</th>
                <th scope="col">Basis</th>
                <th scope="col">Source</th>
                <th scope="col">Date</th>
                <th scope="col">PolicyEngine estimate</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => {
                const estimate = estimateFor(row, { ageRows: age.rows, packageRows: packageAge.rows, packageKey: packageAge.key, year: data.year });
                return (
                  <tr key={row.id}>
                    <th scope="row">{row.figure}</th>
                    <td>{row.value || "—"}</td>
                    <td>{row.basis}</td>
                    <td>
                      {row.url ? (
                        <a href={row.url} target="_blank" rel="noopener noreferrer">
                          {row.source}
                          <span className="visually-hidden"> (opens in a new tab)</span>
                        </a>
                      ) : (
                        row.source
                      )}
                      {row.pressReport && <span className="milburn-tag">Press report</span>}
                    </td>
                    <td>{row.date}</td>
                    <td>
                      {row.estimate?.fixed ? (
                        <>
                          <span className="milburn-estimate">{row.estimate.fixed}</span>
                          {row.estimate.basis && <span className="milburn-estimate-label">{row.estimate.basis}</span>}
                          {row.estimate.label && <span className="milburn-estimate-label">{row.estimate.label}</span>}
                        </>
                      ) : estimate === null ? (
                        ""
                      ) : (
                        <>
                          <span className="milburn-estimate">{thousands(estimate)}</span>
                          {row.estimate.label && <span className="milburn-estimate-label">{row.estimate.label}</span>}
                          {yearLabel && <span className="milburn-estimate-label">{yearLabel}</span>}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="milburn-control-note">
          PolicyEngine estimates are static, and each names its build and year. They can count a different group or
          area from the published figure beside them, so they are context, not a check on it. The package row counts
          people aged 16 to 24 in households whose net income falls under the modelled package, from its{" "}
          {catalogue.localBuild ? "local build" : "verified"} run. Rows with no comparable estimate are left blank.
        </p>
      </section>
    );
  }

  return (
    <div className="results-container milburn-benchmarks">
      <SectionHeading
        icon="scale"
        title="Benchmarks"
        subtitle="Published figures on young people, work and health-related benefits, with their sources."
      />
      {body}
    </div>
  );
}
