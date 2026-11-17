/**
 * The report-status switch turned on (reportStatus.js, REPORT_PUBLISHED
 * true), for the passages that read it when their module loads: the
 * provisional label, the Measures tab's headings and placeholder, the
 * not-computable reason, the comparators' group heading and the limits.
 * The switch is mocked on for this whole file; the wording itself is the
 * real module's.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("./reportStatus", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, REPORT_PUBLISHED: true, reportCopy: (published = true) => actual.reportCopy(published) };
});

import { REPORT_COPY } from "./reportStatus";
import { COMPARATORS_GROUP, MILBURN_GROUPS } from "./measureGroups";
import { NOT_COMPUTABLE_MEASURES } from "./notComputable";
import NotComputableMeasures, { NOT_COMPUTABLE_TITLE, NOT_YET_RUN_TITLE } from "../../components/milburn/NotComputableMeasures";
import ViewSkeleton from "../../components/publication/ViewSkeleton";
import LandingPage from "../../components/LandingPage";
import MethodologyTab, { MILBURN_LIMITATIONS } from "../../components/MethodologyTab";
import { buildMeasureCatalogue, MeasureCatalogueProvider } from "../measureCatalogue";
import { measureCatalogueFixture } from "../../test/measureCatalogueFixture";

/** Wording that is false once the final report is out (as reportStatus.test.jsx). */
const STALE = /candidate|not announced|before (the|it|its) (final )?(report|review)|is published|expected on|briefing|may recommend|not review proposals|have not been set out|not set out/i;

const catalogue = buildMeasureCatalogue(measureCatalogueFixture());
const within = (node) => <MeasureCatalogueProvider catalogue={catalogue}>{node}</MeasureCatalogueProvider>;

afterEach(cleanup);

describe("with the final report published", () => {
  it("labels provisional figures as the report's measures, not as candidates", async () => {
    // The test setup has already loaded the manifest module: load it afresh, under the mock
    vi.resetModules();
    const { CANDIDATE_PROVISIONAL_LABEL, PROVISIONAL_LABEL, provisionalLabel, provisionalNotice } = await import("../publication/manifest");
    const candidate = { updated_at: "2026-10-01T00:00:00Z", budget: { date: "2026-10-28" } };
    expect(provisionalNotice(candidate)).toBe(CANDIDATE_PROVISIONAL_LABEL);
    expect(provisionalLabel(candidate)).toBe(CANDIDATE_PROVISIONAL_LABEL);
    expect(CANDIDATE_PROVISIONAL_LABEL).toBe(REPORT_COPY.after.provisionalLabel);
    expect(CANDIDATE_PROVISIONAL_LABEL).toBe("Provisional: estimates of measures drawn from the review’s final report");
    expect(CANDIDATE_PROVISIONAL_LABEL).not.toBe(PROVISIONAL_LABEL);
  });

  it("labels the comparators by their start, and keeps the other groups as they were", () => {
    const labels = MILBURN_GROUPS.filter((group) => !group.hidden).map((group) => group.label);
    expect(labels).toEqual(["The report's measures", "Comparators (from April 2027)"]);
    expect(MILBURN_GROUPS.find((group) => group.id === COMPARATORS_GROUP).label).toBe(REPORT_COPY.after.comparatorsLabel);
  });

  it("gives no reason that says what the report does or does not set out", () => {
    const words = NOT_COMPUTABLE_MEASURES.flatMap((measure) => [measure.notModelled, measure.visual?.alt, measure.summary, measure.kind]).join("\n");
    expect(words).not.toMatch(STALE);
    expect(NOT_COMPUTABLE_MEASURES.map((measure) => measure.notModelled)).toContain("Its eligibility and rates are not in the model.");
    for (const measure of NOT_COMPUTABLE_MEASURES) expect(measure.visual.alt, measure.id).toMatch(/[a-z]\.$/);
  });

  it("heads the measures without figures as measures, and lists each with its reason", () => {
    expect(NOT_COMPUTABLE_TITLE).toBe("Measures we cannot compute");
    expect(NOT_YET_RUN_TITLE).toBe("Measures not yet run");
    const { container } = render(within(<NotComputableMeasures />));
    const region = screen.getByRole("region", { name: "Measures we cannot compute" });
    for (const measure of NOT_COMPUTABLE_MEASURES) expect(region.textContent).toContain(measure.notModelled);
    expect(container.textContent).not.toMatch(STALE);
  });

  it("words the Measures tab's placeholder without candidates", () => {
    const { container } = render(<ViewSkeleton view="policies" />);
    expect(container.textContent).toContain("What each measure changes, and how we model it.");
    expect(container.textContent).not.toMatch(STALE);
  });

  it("leaves nothing on the landing page or in Methodology that says the report is still to come", () => {
    expect(MILBURN_LIMITATIONS.at(-1)[0]).toBe("Not government policy");
    const landing = render(<LandingPage onOpen={() => {}} />);
    expect(landing.container.textContent).toContain("From a Welfare State to a Working State");
    expect(landing.container.textContent).toContain("(17 November 2026)");
    expect(landing.container.textContent).not.toMatch(STALE);
    landing.unmount();
    const methodology = render(within(<MethodologyTab onShowTab={() => {}} />));
    expect(methodology.container.textContent).toContain("not government policy unless the government adopts them");
    expect(methodology.container.textContent).not.toMatch(STALE);
  });
});
