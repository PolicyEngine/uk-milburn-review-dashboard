import TitleIcon from "../TitleIcon";
import { REPORT_DAY, subShownOnReportDay } from "../../utils/milburn/reportDay";
import { SubTabLink } from "./MilburnCharts";
import "./BenchmarkCallout.css";

/** The one line a headline box gives to published figures: they are on Benchmarks, not repeated here. */
export const PUBLISHED_FIGURES_LINE = "Published figures for comparison:";

/**
 * One line at the foot of a headline box (`place`: young, poverty or
 * finances), set like its "Notes and caveats" line: the published figures
 * are on the Benchmarks sub-tab, linked in place. Nothing while the
 * report-day switch takes Benchmarks down.
 */
export default function BenchmarkCallout({ place, reportDay = REPORT_DAY }) {
  if (!subShownOnReportDay("benchmarks", reportDay)) return null;
  return (
    <p className="bm-callout" data-place={place}>
      <TitleIcon name="scale" bare size={14} />
      <span>
        {PUBLISHED_FIGURES_LINE} see <SubTabLink sub="benchmarks">Benchmarks</SubTabLink>
      </span>
    </p>
  );
}
