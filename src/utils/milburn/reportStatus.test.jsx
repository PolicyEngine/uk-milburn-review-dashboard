/**
 * The report-status switch (reportStatus.js), in both states: before the
 * final report the page words the measures as candidates, exactly as it did
 * before the switch existed; after, as measures in the final report, with
 * nothing left that says the report is still to come.
 *
 * The passages take the state as a parameter here. The passages that read
 * the switch when their module loads (labels, headings, the registry's
 * reasons) are in reportStatusPublished.test.jsx, with the switch mocked on.
 *
 * No case pins which state the file is in today, so flipping
 * REPORT_PUBLISHED leaves this file green.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { REPORT_COPY, REPORT_PUBLISHED, reportCopy } from "./reportStatus";
import LandingPage, { LandingIntro, landingBoxes } from "../../components/LandingPage";
import MethodologyTab, { MILBURN_LIMITATIONS, milburnLimitations } from "../../components/MethodologyTab";
import { buildMeasureCatalogue, MeasureCatalogueProvider } from "../measureCatalogue";
import { measureCatalogueFixture } from "../../test/measureCatalogueFixture";

/** Wording that is false once the final report is out. */
const STALE = /candidate|not announced|before (the|it|its) (final )?(report|review)|is published|expected on|briefing|may recommend|not review proposals|have not been set out|not set out/i;

const catalogue = buildMeasureCatalogue(measureCatalogueFixture());
const renderMethodology = (published) =>
  render(<MeasureCatalogueProvider catalogue={catalogue}><MethodologyTab onShowTab={() => {}} published={published} /></MeasureCatalogueProvider>);
const flat = (copy) => Object.values(copy).flat().join("\n");

afterEach(cleanup);

describe("the switch", () => {
  it("is a boolean, and is what the page reads when no state is given", () => {
    expect(typeof REPORT_PUBLISHED).toBe("boolean");
    expect(reportCopy()).toBe(reportCopy(REPORT_PUBLISHED));
    expect(reportCopy(false)).toBe(REPORT_COPY.before);
    expect(reportCopy(true)).toBe(REPORT_COPY.after);
    expect(MILBURN_LIMITATIONS).toEqual(milburnLimitations(REPORT_PUBLISHED));
    expect(landingBoxes()).toEqual(landingBoxes({ published: REPORT_PUBLISHED }));
  });

  it("words the same passages in both states", () => {
    expect(Object.keys(REPORT_COPY.after)).toEqual(Object.keys(REPORT_COPY.before));
    for (const [key, value] of Object.entries(REPORT_COPY.before)) {
      const after = REPORT_COPY.after[key];
      expect(Array.isArray(after), key).toBe(Array.isArray(value));
      for (const text of [value, after].flat()) expect(typeof text, key).toBe("string");
      expect(after, key).not.toEqual(value);
    }
  });

  it("before, keeps the wording the page had", () => {
    expect(REPORT_COPY.before).toEqual({
      landingHeading: "Young people and work: candidate measures modelled",
      landingIntroLead: "Estimates from ",
      landingIntroRest: "of candidate measures for the young people and work review, by age. Modelled before the final report on 17 November 2026; not announced policy.",
      measuresBoxLine: "Every candidate measure, and how we model it",
      metaDescription: "PolicyEngine UK estimates of candidate measures for the Milburn review of young people and work, modelled before the review is published: the public finances, households by age, and the package if some young people move into work. These are not announced policy.",
      methodSummary: "on a survey of UK households with and without each candidate measure for the Milburn review of young people and work; weights scale the survey to the UK. The figures are static.",
      reviewTopicPreview: "Candidates · Not announced policy · Final report 17 November 2026",
      reviewTopicBody: ["The independent review of young people and work published an interim report on 28 May 2026; its final report is expected on Tuesday 17 November 2026. The measures here are candidates drawn from public discussion of the review, modelled before it is published. They are not announced policy, and the review may recommend something different."],
      notComputableLimit: "Some candidate measures cannot be computed with these data and this model; they are listed with the reason, and never shown as £0.",
      policyLimitTerm: "Not announced policy",
      policyLimit: "The measures are candidates modelled before the review's final report. They may differ from anything the review recommends or the government adopts.",
      provisionalLabel: "Provisional: candidate measures modelled before the review is published, not announced policy",
      measuresSubtitle: "Candidate measures for the Milburn review: what each changes, and how we model it.",
      measuresPlaceholderSubtitle: "What each candidate measure changes, and how we model it.",
      measuresEmptyLine: "Figures appear here once the candidate measures’ results are published.",
      notComputableTitle: "Candidate measures we cannot compute",
      notYetRunTitle: "Candidate measures not yet run",
      rulesNotSetOut: "Its rules (eligibility, rates) have not been set out.",
      higherAmountAltTail: " The higher amount is not set out.",
      newBenefitAltTail: ", whose rules are not set out.",
      comparatorsLabel: "Comparators, not review proposals",
    });
  });

  it("after, says nothing that the final report makes false, and makes no claim about the government", () => {
    const text = flat(REPORT_COPY.after);
    expect(text).not.toMatch(STALE);
    expect(text).not.toMatch(/government will|will adopt|should|must/i);
    expect(REPORT_COPY.after.comparatorsLabel).toBe("Comparators, not in the report");
    expect(REPORT_COPY.after.policyLimit).toContain("not government policy unless the government adopts them");
  });
});

describe("the landing page", () => {
  it("before, says the measures are candidates modelled before the final report", () => {
    render(<LandingPage onOpen={() => {}} published={false} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Young people and work: candidate measures modelled");
    expect(document.querySelector(".landing-intro")).toHaveTextContent(
      /^Estimates from PolicyEngine UK( \(opens in a new tab\))? of candidate measures for the young people and work review, by age\. Modelled before the final report on 17 November 2026; not announced policy\.$/,
    );
    expect(screen.getByText("Every candidate measure, and how we model it")).toBeInTheDocument();
  });

  it("after, says they are measures in the final report, static, with the same link", () => {
    const { container } = render(<LandingPage onOpen={() => {}} published />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Young people and work: the review’s measures modelled");
    expect(document.querySelector(".landing-intro")).toHaveTextContent(
      /^PolicyEngine UK( \(opens in a new tab\))? estimates of measures in the independent review of young people and work \(final report, 17 November 2026\), by age\.$/,
    );
    expect(screen.getByRole("link", { name: /PolicyEngine UK/ })).toHaveAttribute("href", "https://policyengine.org/uk/model");
    expect(screen.getByText("Every measure, and how we model it")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(STALE);
  });

  it("words the About drawer's copy of the intro the same way", () => {
    for (const published of [false, true]) {
      const { container, unmount } = render(<LandingIntro headingId="about" published={published} />);
      expect(container.querySelector("#about")).toHaveTextContent(reportCopy(published).landingHeading);
      expect(container.querySelector(".landing-intro")).toHaveTextContent(reportCopy(published).landingIntroRest);
      unmount();
    }
  });
});

describe("Methodology", () => {
  const topic = () => document.getElementById("method-about-review");

  it("before, says the measures are candidates and not announced policy", () => {
    const { container } = renderMethodology(false);
    expect(container.textContent).toContain("with and without each candidate measure for the Milburn review of young people and work");
    expect(topic().textContent).toContain("Candidates · Not announced policy · Final report 17 November 2026");
    expect(topic().textContent).toContain("its final report is expected on Tuesday 17 November 2026");
    expect(topic().textContent).toContain("They are not announced policy, and the review may recommend something different.");
    expect(container.textContent).toContain("The measures are candidates modelled before the review's final report.");
    expect(milburnLimitations(false).map(([term]) => term).slice(-2)).toEqual(["Not computable", "Not announced policy"]);
  });

  it("after, says the measures follow the report as far as the model can, and are not government policy unless adopted", () => {
    const { container } = renderMethodology(true);
    expect(container.textContent).toContain("with and without each measure modelled from the final report of the Milburn review of young people and work");
    expect(topic().textContent).toContain("published an interim report on 28 May 2026 and its final report on Tuesday 17 November 2026");
    expect(topic().textContent).toContain("The measures here follow the report’s proposals as far as the model can represent them.");
    expect(topic().textContent).toContain("Some proposals cannot be modelled. They are listed with the reason under “Measures we cannot compute”.");
    expect(topic().textContent).toContain("The report’s proposals are not government policy unless the government adopts them. Comparators are labelled as not in the report.");
    // The list the topic points to is on the same tab
    expect(document.getElementById("method-not-computable")).not.toBeNull();
    expect(milburnLimitations(true).map(([term]) => term).slice(-2)).toEqual(["Not computable", "Not government policy"]);
    expect(milburnLimitations(true).slice(0, -2)).toEqual(milburnLimitations(false).slice(0, -2));
    // The passages the switch words; the registry's own reasons are read at
    // load (reportStatusPublished.test.jsx)
    expect(topic().textContent).not.toMatch(STALE);
    expect(milburnLimitations(true).slice(-2).flat().join(" ")).not.toMatch(STALE);
  });

  it("gives the limit an icon in both states", () => {
    for (const published of [false, true]) {
      const { unmount } = renderMethodology(published);
      const term = [...document.querySelectorAll("dt, .fact-term, strong, span")].find((node) => node.textContent === reportCopy(published).policyLimitTerm);
      expect(term, String(published)).toBeTruthy();
      expect(term.closest("div, li, dt")?.querySelector("svg") ?? term.parentElement.querySelector("svg"), String(published)).not.toBeNull();
      unmount();
    }
  });
});
