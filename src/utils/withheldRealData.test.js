import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFlatTable } from "./publication/csv";
import { metricByYear, SUMMARY_METRICS } from "../components/SummaryMetricChart";
import { sharesByGroup } from "./ageImpact";

// The published files as the local build route parses them
// (localBuild.js: metrics and age_impact through parseFlatTable), so an
// empty cell reaches the page as withheld, not as missing or zero
const read = (run, file) => parseFlatTable(file, readFileSync(join(process.cwd(), "public/data/milburn", run, `${file}.csv`), "utf8"));

describe("withheld cells in the published files", () => {
  it("reads the higher Youth Allowance run's withheld poverty years as withheld", () => {
    const run = "milburn_report_youth_allowance_independent";
    const points = metricByYear(read(run, "metrics"), run, SUMMARY_METRICS.poverty, [2027, 2028, 2029, 2030, 2031]);
    expect(points.filter((point) => point.withheld).map((point) => point.year)).toEqual([2029, 2030, 2031]);
    expect(points.filter((point) => !point.withheld).every((point) => point.value === 0)).toBe(true);
  });

  it("marks an age group whose shares the floor blanks as withheld", () => {
    const run = "milburn_report_uc_health";
    const policies = [{ id: run, displayable: true }];
    const shares = sharesByGroup(read(run, "age_impact"), policies, [run], 2029);
    expect(shares.groups.some((group) => group.withheld)).toBe(true);
  });
});
