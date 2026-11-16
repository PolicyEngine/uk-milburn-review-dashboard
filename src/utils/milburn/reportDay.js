/**
 * The report-day switch: one line that takes down the parts of the page the
 * review's final report may overtake (docs/report-day/02-trim-list.md,
 * section 5), until they are checked against it.
 *
 * While REPORT_DAY is true the page leaves out:
 * - Impact's Return to work sub-tab (?sub=scenarios) and its landing box;
 * - Impact's Benchmarks sub-tab (?sub=benchmarks).
 * A link to either then opens Impact's default sub-tab, as any unknown
 * ?sub= does. Nothing else changes, and no data file is touched.
 *
 * Read by PopulationImpactView.jsx (the sub-tabs) and LandingPage.jsx (the
 * boxes). Kept free of React and of other imports, so the placeholders'
 * copies of the sub-tab list (utils/bootView.js, publication/ViewSkeleton.jsx)
 * can read it too.
 */

// Flip this one line: true hides Return to work and Benchmarks
export const REPORT_DAY = false;

/** Impact's sub-tabs left out while the switch is on. */
export const REPORT_DAY_HIDDEN_SUBS = Object.freeze(["scenarios", "benchmarks"]);

/** Whether one of Impact's sub-tabs (and a landing box that opens it) is shown. */
export function subShownOnReportDay(sub, reportDay = REPORT_DAY) {
  return !(reportDay && REPORT_DAY_HIDDEN_SUBS.includes(sub));
}
