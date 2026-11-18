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
import { FINAL_REPORT, REPORT_COPY, REPORT_PUBLISHED, reportCopy } from "./reportStatus";
import LandingPage, { LandingIntro, landingBoxes } from "../../components/LandingPage";
import MethodologyTab, { MILBURN_LIMITATIONS, milburnLimitations, REPORT_MODELLED, REPORT_PROPOSALS } from "../../components/MethodologyTab";
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
      landingIntroTail: "",
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
    expect(REPORT_COPY.after.comparatorsLabel).toBe("Comparators (from April 2027)");
    expect(REPORT_COPY.after.policyLimit).toContain("not government policy unless the government adopts them");
    // The method line, short: the survey basis and that the figures are static (Vahid, 18 Nov)
    expect(REPORT_COPY.after.methodSummary).toBe("on a weighted survey of UK households, with and without each measure from the review’s final report. The figures are static.");
  });

  it("names the report as published: its title, date and GOV.UK addresses", () => {
    expect(FINAL_REPORT.title).toBe("From a Welfare State to a Working State: a new settlement for the next generation");
    expect(FINAL_REPORT.date).toBe("17 November 2026");
    expect(FINAL_REPORT.url).toBe("https://www.gov.uk/government/publications/from-a-welfare-state-to-a-working-state-a-new-settlement-for-the-next-generation");
    expect(FINAL_REPORT.reportUrl).toBe(`${FINAL_REPORT.url}/from-a-welfare-state-to-a-working-state-a-new-settlement-for-the-next-generation`);
    expect(FINAL_REPORT.annexUrl).toBe(`${FINAL_REPORT.url}/from-a-welfare-state-to-a-working-state-analytical-annex`);
  });
});

describe("the landing page", () => {
  it("before, says the measures are candidates modelled before the final report", () => {
    render(<LandingPage onOpen={() => {}} published={false} />);
    expect(screen.queryByRole("link", { name: /From a Welfare State/ })).toBeNull();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Young people and work: candidate measures modelled");
    expect(document.querySelector(".landing-intro")).toHaveTextContent(
      /^Estimates from PolicyEngine UK( \(opens in a new tab\))? of candidate measures for the young people and work review, by age\. Modelled before the final report on 17 November 2026; not announced policy\.$/,
    );
    expect(screen.getByText("Every candidate measure, and how we model it")).toBeInTheDocument();
  });

  it("after, says they are measures drawn from the final report, and links to it in a new tab", () => {
    const { container } = render(<LandingPage onOpen={() => {}} published />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Young people and work: measures from the final report modelled");
    expect(document.querySelector(".landing-intro")).toHaveTextContent(
      /^PolicyEngine UK( \(opens in a new tab\))? estimates, by age, of benefit and employer National Insurance measures drawn from the final report of the independent review of young people and work, From a Welfare State to a Working State( \(opens in a new tab\))? \(17 November 2026\)\. The report’s replacement payments are not modelled\.$/,
    );
    expect(screen.getByRole("link", { name: /PolicyEngine UK/ })).toHaveAttribute("href", "https://policyengine.org/uk/model");
    const report = screen.getByRole("link", { name: /From a Welfare State to a Working State/ });
    expect(report).toHaveAttribute("href", FINAL_REPORT.url);
    expect(report).toHaveAttribute("target", "_blank");
    expect(report).toHaveAttribute("rel", "noopener noreferrer");
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

  it("after, names the report with its links, lists what it proposes and what we model, and says it is not government policy unless adopted", () => {
    const { container } = renderMethodology(true);
    expect(container.textContent).toContain("with and without each measure from the review’s final report. The figures are static.");
    const links = (href) => [...topic().querySelectorAll("a")].filter((link) => link.getAttribute("href") === href);
    const [publication] = links(FINAL_REPORT.url);
    expect(publication).toHaveTextContent(FINAL_REPORT.title);
    expect(publication).toHaveAttribute("target", "_blank");
    expect(publication).toHaveAttribute("rel", "noopener noreferrer");
    expect(links(FINAL_REPORT.reportUrl)).toHaveLength(1);
    expect(topic().textContent).toContain("was published by the Department for Work and Pensions on 17 November 2026. The interim report was published on 28 May 2026.");
    // One line each: the report's proposals, then what the page models
    expect([...topic().querySelectorAll("[data-report-proposals] li")].map((item) => item.textContent)).toEqual(REPORT_PROPOSALS);
    expect([...topic().querySelectorAll("[data-report-modelled] li")].map((item) => item.textContent)).toEqual(REPORT_MODELLED);
    const proposals = REPORT_PROPOSALS.join("\n");
    for (const name of ["Youth Allowance", "Additional Cost Allowance", "Health and Disability Fund", "Severe and Complex Needs Insurance", "21 to 24-year-olds in retail and hospitality"]) expect(proposals, name).toContain(name);
    expect(REPORT_MODELLED.map((line) => line.split(":")[0])).toEqual(["Modelled", "Modelled with stated assumptions", "Illustrative runs", "Comparators, from April 2027", "Not modelled"]);
    // The runs offered now: no pre-report package or variant is named
    expect(REPORT_MODELLED.join("\n")).not.toMatch(/full abolition|central variant|upper bound/i);
    expect(topic().textContent).toContain("Proposals we do not model are listed with the reason under “Measures we cannot compute”.");
    expect(topic().textContent).toContain("The report’s proposals are not government policy unless the government adopts them.");
    // The list the topic points to is on the same tab
    expect(document.getElementById("method-not-computable")).not.toBeNull();
    // Neutral: the report's proposals are reported, not urged
    expect([...REPORT_PROPOSALS, ...REPORT_MODELLED].join("\n")).not.toMatch(/should|must|government will|will adopt/i);
    expect(topic().textContent).not.toMatch(STALE);
  });

  it("after, sets the limits against the report's design in place of the pre-report limit on replacements", () => {
    const terms = (published) => milburnLimitations(published).map(([term]) => term);
    expect(terms(true).slice(-2)).toEqual(["Not computable", "Not government policy"]);
    expect(terms(false)).toContain("No replacement in the upper bound");
    expect(terms(true)).not.toContain("No replacement in the upper bound");
    const added = terms(true).filter((term) => !terms(false).includes(term));
    expect(added).toEqual(["Replacements not modelled", "Youth Allowance", "Employer National Insurance", "Timing", "Geography", "Not government policy"]);
    // Every other limit is the same in both states
    const shared = (published) => milburnLimitations(published).filter(([term]) => terms(!published).includes(term) && term !== "Not computable");
    expect(shared(true)).toEqual(shared(false));
    const text = Object.fromEntries(milburnLimitations(true));
    expect(text["Replacements not modelled"]).toContain("Additional Cost Allowance for ongoing costs and a local Health and Disability Fund for one-off or changing costs");
    expect(text.Geography).toContain("Northern Ireland");
    // The runs as they stand: the benefit changes from April 2029, the comparators from April 2027, the phased run's assumption
    expect(text.Timing).toContain("The report’s benefit changes apply from April 2029");
    expect(text.Timing).toContain("the comparators apply from April 2027");
    expect(text.Timing).toContain("an assumed 45% of the remaining claimants each year");
    expect(text["Youth Allowance"]).toContain("the review’s own proxy for living independently (analytical annex, section 8)");
    expect(text["Employer National Insurance"]).toContain("One run shows the £10,000 end state in every year");
    // The report proposes; no limit says a change is happening, or names a run no longer offered
    expect(Object.values(text).join(" ")).not.toMatch(/The report (replaces|raises|moves|sets|adds|doubles)\b|full abolition package|central variant/);
    expect(milburnLimitations(true).flat().join(" ")).not.toMatch(STALE);
  });

  it("after, states the report's own employment assumption beside ours, with its sources; before, does not", () => {
    renderMethodology(true);
    const scenarios = () => document.getElementById("method-behavioural-scenarios");
    expect(scenarios().textContent).toContain("Why this path");
    expect(scenarios().textContent).toContain("Who moves");
    expect(scenarios().textContent).toContain("around 440,000 more young people in sustained work by 2036");
    expect(scenarios().querySelector(`a[href="${FINAL_REPORT.annexUrl}"]`)).not.toBeNull();
    expect(scenarios().querySelector(`a[href="${FINAL_REPORT.reportUrl}"]`)).not.toBeNull();
    cleanup();
    renderMethodology(false);
    expect(scenarios().textContent).toContain("Why this path");
    expect(scenarios().textContent).not.toContain("440,000");
    expect(document.getElementById("method-about-review").querySelector("[data-report-proposals]")).toBeNull();
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
