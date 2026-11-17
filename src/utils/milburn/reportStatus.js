/**
 * The report-status switch: one line that changes the page's wording from
 * "candidates modelled before the review's final report" to "measures in
 * the final report" (docs/report-day/02-trim-list.md, section 2;
 * 04-publication-readiness.md, section 3.1).
 *
 * Every passage that says the report is still to come reads its words from
 * reportCopy(): the landing intro and box, the page's meta description,
 * Methodology ("At a glance", "The review and these measures" and two
 * limits; its account of the report itself is its own), the provisional label, the Measures tab's subtitle, its
 * placeholder and empty line, the not-computable headings and reason, and
 * the comparators' group heading.
 *
 * It changes wording only. Which measures are shown, and their names and
 * descriptions, come from the pipeline (milburn_measures.json); which
 * sub-tabs are shown is the other switch (reportDay.js).
 *
 * Kept free of React and of other imports, so the layout (server), the
 * placeholders and the plain utils can all read it. No measure is named
 * here: the measures' words are the pipeline's.
 */

// Flip this one line: true once the final report is published
export const REPORT_PUBLISHED = true;

const PUBLICATION_URL =
  "https://www.gov.uk/government/publications/from-a-welfare-state-to-a-working-state-a-new-settlement-for-the-next-generation";

/**
 * The final report as published: its title, publisher, date and addresses
 * (GOV.UK, Department for Work and Pensions, 17 November 2026). The
 * passages that link to it (the landing intro, Methodology) read these.
 */
export const FINAL_REPORT = Object.freeze({
  title: "From a Welfare State to a Working State: a new settlement for the next generation",
  shortTitle: "From a Welfare State to a Working State",
  publisher: "Department for Work and Pensions",
  date: "17 November 2026",
  url: PUBLICATION_URL,
  reportUrl: `${PUBLICATION_URL}/from-a-welfare-state-to-a-working-state-a-new-settlement-for-the-next-generation`,
  annexUrl: `${PUBLICATION_URL}/from-a-welfare-state-to-a-working-state-analytical-annex`,
});

/** The wording in each state, by passage. */
export const REPORT_COPY = Object.freeze({
  // Before the final report: the measures are candidates
  before: Object.freeze({
    // Landing page and About drawer (LandingPage.jsx)
    landingHeading: "Young people and work: candidate measures modelled",
    // The intro is: lead, the PolicyEngine UK link, a space, rest
    landingIntroLead: "Estimates from ",
    landingIntroRest:
      "of candidate measures for the young people and work review, by age. Modelled before the final report on 17 November 2026; not announced policy.",
    // After the report's link, once there is one (the after state)
    landingIntroTail: "",
    measuresBoxLine: "Every candidate measure, and how we model it",
    // The page's meta description (app/layout.tsx)
    metaDescription:
      "PolicyEngine UK estimates of candidate measures for the Milburn review of young people and work, modelled before the review is published: the public finances, households by age, and the package if some young people move into work. These are not announced policy.",
    // Methodology (MethodologyTab.jsx): "At a glance", after the link
    methodSummary:
      "on a survey of UK households with and without each candidate measure for the Milburn review of young people and work; weights scale the survey to the UK. The figures are static.",
    reviewTopicPreview: "Candidates · Not announced policy · Final report 17 November 2026",
    reviewTopicBody: Object.freeze([
      "The independent review of young people and work published an interim report on 28 May 2026; its final report is expected on Tuesday 17 November 2026. The measures here are candidates drawn from public discussion of the review, modelled before it is published. They are not announced policy, and the review may recommend something different.",
    ]),
    notComputableLimit: "Some candidate measures cannot be computed with these data and this model; they are listed with the reason, and never shown as £0.",
    policyLimitTerm: "Not announced policy",
    policyLimit: "The measures are candidates modelled before the review's final report. They may differ from anything the review recommends or the government adopts.",
    // The provisional label (publication/manifest.js)
    provisionalLabel: "Provisional: candidate measures modelled before the review is published, not announced policy",
    // The Measures tab (App.jsx, publication/ViewSkeleton.jsx)
    measuresSubtitle: "Candidate measures for the Milburn review: what each changes, and how we model it.",
    measuresPlaceholderSubtitle: "What each candidate measure changes, and how we model it.",
    measuresEmptyLine: "Figures appear here once the candidate measures’ results are published.",
    // Measures the page lists without figures (NotComputableMeasures.jsx, notComputable.js)
    notComputableTitle: "Candidate measures we cannot compute",
    notYetRunTitle: "Candidate measures not yet run",
    rulesNotSetOut: "Its rules (eligibility, rates) have not been set out.",
    higherAmountAltTail: " The higher amount is not set out.",
    newBenefitAltTail: ", whose rules are not set out.",
    // The comparators' group heading (measureGroups.js)
    comparatorsLabel: "Comparators, not review proposals",
  }),
  // Once the final report is published: the measures follow its proposals
  after: Object.freeze({
    landingHeading: "Young people and work: measures from the final report modelled",
    landingIntroLead: "",
    // The intro is: the PolicyEngine UK link, a space, rest, the report's link (FINAL_REPORT), tail
    landingIntroRest:
      "estimates, by age, of benefit measures drawn from the final report of the independent review of young people and work,",
    landingIntroTail: " (17 November 2026). The report’s replacement payments are not modelled.",
    measuresBoxLine: "Every measure, and how we model it",
    metaDescription:
      "PolicyEngine UK estimates of benefit measures drawn from From a Welfare State to a Working State, the final report of the independent review of young people and work (the Milburn review, 17 November 2026): the public finances and households by age. The report’s proposals are not government policy unless the government adopts them.",
    methodSummary:
      "on a survey of UK households with and without each measure drawn from the final report of the Milburn review of young people and work; weights scale the survey to the UK. The figures are static.",
    reviewTopicPreview: "Final report 17 November 2026 · What it proposes · What we model · Not government policy",
    // The closing paragraphs; the report's link, its proposals and what we model are Methodology's own (MethodologyTab.jsx)
    reviewTopicBody: Object.freeze([
      "Proposals we do not model are listed with the reason under “Measures we cannot compute”.",
      "The report’s proposals are not government policy unless the government adopts them.",
    ]),
    notComputableLimit: "Some measures cannot be computed with these data and this model; they are listed with the reason, and never shown as £0.",
    policyLimitTerm: "Not government policy",
    policyLimit: "The measures follow the report’s proposals as far as the model can represent them, without its replacement payments. The report’s proposals are not government policy unless the government adopts them.",
    provisionalLabel: "Provisional: estimates of measures drawn from the review’s final report",
    measuresSubtitle: "Measures drawn from the Milburn review’s final report, and comparators: what each changes, and how we model it.",
    measuresPlaceholderSubtitle: "What each measure changes, and how we model it.",
    measuresEmptyLine: "Figures appear here once the measures’ results are published.",
    notComputableTitle: "Measures we cannot compute",
    notYetRunTitle: "Measures not yet run",
    // Says nothing of what the report sets out: only what the model holds
    rulesNotSetOut: "Its eligibility and rates are not in the model.",
    higherAmountAltTail: "",
    newBenefitAltTail: ".",
    // Both comparators are wider forms of a proposal in the report (a
    // Youth Allowance; an employer NICs relief for 21 to 24-year-olds in
    // retail and hospitality), so neither is "not in the report"
    comparatorsLabel: "Comparators (pre-report runs)",
  }),
});

/**
 * The wording for a state: the switch's own unless one is given (tests
 * render both).
 *
 * @param {boolean} [published] - Whether the final report is published
 * @returns {typeof REPORT_COPY.before}
 */
export function reportCopy(published = REPORT_PUBLISHED) {
  return published ? REPORT_COPY.after : REPORT_COPY.before;
}
