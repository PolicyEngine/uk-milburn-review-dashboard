// @vitest-environment node
import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";
import App from "./App";
import { reportCopy } from "./utils/milburn/reportStatus";

it("prerenders the shell without a browser or any Budget figures", () => {
  expect(typeof window).toBe("undefined");
  const html = renderToString(<App />);
  expect(html).toContain("Milburn review: young people and work");
  expect(html).not.toContain("These are not announced policy.");
  for (const label of [">Impact<", ">Measures<", ">Methodology<"]) {
    expect(html).toContain(label);
  }
  expect(html).not.toContain("Household calculator");
  // The landing page, whole, with no view mounted under it
  // The heading in the report-status switch's state (reportStatus.test.jsx pins both)
  expect(html).toContain(reportCopy().landingHeading);
  expect(html).not.toContain("Pre-measures forecast");
  expect(html).toContain('class="landing-backdrop"');
  expect(html).not.toContain('role="tabpanel"');
  expect(html).not.toContain('id="revenue"');
  expect(html).not.toContain('class="chart-plot');
  expect(html).not.toContain("£");
});
