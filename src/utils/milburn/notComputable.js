import { reportCopy } from "./reportStatus";

// What is said of rules not yet set out: the report-status switch's words
const COPY = reportCopy();

/**
 * The final report's measures the dashboard lists but cannot compute, each
 * with the reason ("From a Welfare State to a Working State", 17 November
 * 2026; the section each comes from is cited on its entry). They replace
 * the pre-report list, and are the page's list on every data route: the
 * pipeline's registry (uk_budget_data.reforms.NOT_COMPUTABLE_MEASURES)
 * still holds the pre-report four until it is brought into line. Not
 * listed: the Youth Allowance's independent rate and work allowance (the
 * latter at an assumed amount, illustratively), child DLA to 18 and the
 * higher employer National Insurance threshold at 21 to 24, which the
 * pipeline models with stated assumptions.
 *
 * They have no estimate anywhere on the page: never £0, which would read
 * as an estimate of no effect. A `summary` may state the report's own
 * amount or target (a rule, not an estimate); `kind` says in a line what
 * sort of measure it is. Each `visual` is its card's "What changes"
 * diagram, in NotComputableVisual's shapes (components/policies/
 * MilburnVisual.jsx): a decision split, a swap of one rule for another, or
 * offers with more places. Icons are TitleIcon names. The diagrams are
 * words only: no figure, no digit.
 */
const BENEFITS = { label: "Benefits", icon: "piggy" };
const EMPLOYMENT = { label: "Employment support", icon: "briefcase" };
const EDUCATION = { label: "Education and skills", icon: "cap" };

export const NOT_COMPUTABLE_MEASURES = [
  {
    // Report para 760: 16 and 17-year-olds stay on DLA instead of moving to
    // PIP. The national run (milburn_report_child_dla_to_18) gives exactly
    // £0: the paired DLA and PIP rates are identical, so the switch changes
    // no payment; the aim, sparing a reassessment at 16, is not in the data
    id: "child_dla_to_18",
    name: "Child DLA extended to 18",
    summary: "16 and 17-year-olds stay on Disability Living Allowance instead of moving to PIP.",
    affects: "Disabled 16 and 17-year-olds",
    category: BENEFITS,
    kind: "A change to when a benefit switches.",
    notModelled: "DLA and PIP pay the same amounts, so the switch changes no payment; its effect on reassessment is not in the data.",
    visual: {
      kind: "swap",
      caption: "Disability benefit for older teenagers",
      before: { when: "Today", icon: "wallet", label: "PIP", facts: ["Same rates"] },
      after: { when: "Proposed", icon: "wallet", label: "DLA kept longer", facts: ["Same rates"], unknowns: ["Reassessment"] },
      alt: "Today young people move from DLA to PIP as older teenagers; the proposal keeps them on DLA until adulthood. The two pay the same amounts, so no payment changes.",
    },
  },
  {
    // Report 6.5, paras 750, 751, 754 and 755: replaces PIP under 25;
    // government-run, non-means-tested; the gateway's design is left to
    // further work
    id: "additional_cost_allowance",
    name: "Additional Cost Allowance",
    summary: "A national, non-means-tested allowance for established, ongoing disability costs, replacing PIP.",
    affects: "Disabled people under 25 with ongoing extra costs",
    category: BENEFITS,
    kind: "A new benefit in place of PIP.",
    notModelled: COPY.rulesNotSetOut,
    visual: {
      kind: "swap",
      caption: "Help with the ongoing extra costs of disability for young people",
      before: { when: "Today", icon: "wallet", label: "PIP", facts: ["Eligibility", "Rates"] },
      after: { when: "Proposed", icon: "sparkle", label: "Additional Cost Allowance", facts: ["Not means-tested"], unknowns: ["Eligibility", "Rates"] },
      alt: `Today young disabled people can get PIP; the proposal replaces it with an Additional Cost Allowance${COPY.newBenefitAltTail}`,
    },
  },
  {
    // Report 6.5, paras 756 and 757: a stable long-term income above
    // today's maximum benefit rates, a very high bar, no rate given
    id: "severe_complex_needs_insurance",
    name: "Severe and Complex Needs Insurance",
    summary: "A stable long-term income, above today's maximum benefit rates, where paid work is not realistic.",
    affects: "Young people with the most profound, long-term disabilities",
    category: BENEFITS,
    kind: "A new long-term benefit.",
    notModelled: "The data cannot identify who would qualify, and its rate is not in the model.",
    visual: {
      kind: "split",
      caption: "Who gets Severe and Complex Needs Insurance",
      root: [{ icon: "user", label: "A young person" }],
      test: { icon: "clipboard", label: "Paid work realistically possible", unknown: "No flag in the data" },
      branches: [
        { answer: "Yes", icon: "wallet", label: "Youth Allowance and support" },
        { answer: "No", icon: "shield", label: "Severe and Complex Needs Insurance", tone: "gain", plus: true },
      ],
      alt: "A young person for whom paid work is not realistically possible would get Severe and Complex Needs Insurance; other young people the Youth Allowance and support. The data hold no flag for who would qualify.",
    },
  },
  {
    // Report 6.5, paras 752 and 753: one-off or changing costs, met
    // locally through the Youth Opportunity Service, with local flexibility
    id: "health_and_disability_fund",
    name: "Local Health and Disability Fund",
    summary: "Local payments for one-off or changing disability costs, decided by the Youth Opportunity Service.",
    affects: "Disabled young people being supported into work or study",
    category: BENEFITS,
    kind: "A local discretionary fund.",
    notModelled: "Awards are at local discretion, with no rule to apply to households.",
    visual: {
      kind: "split",
      caption: "How a disabled young person's extra costs are met",
      root: [{ icon: "user", label: "A disabled young person" }],
      test: { icon: "clipboard", label: "Extra costs" },
      branches: [
        { answer: "One-off", icon: "lifebuoy", label: "Local fund", tone: "gain", plus: true },
        { answer: "Ongoing", icon: "sparkle", label: "Additional Cost Allowance" },
      ],
      marker: "Local discretion, not modelled",
      alt: "A disabled young person's one-off or changing extra costs would be met by a local fund, and established, ongoing costs by the Additional Cost Allowance. The fund's awards are at local discretion and not modelled.",
    },
  },
  {
    // Report 6.4, paras 715 to 718: a duty to engage; persistent refusal
    // ultimately loses the Youth Allowance; sanctions rare
    id: "youth_conditionality",
    name: "Duty to engage",
    summary: "Persistent refusal to engage can end in loss of the Youth Allowance.",
    affects: "Young people receiving the Youth Allowance",
    category: BENEFITS,
    kind: "Rules on what claimants must do.",
    notModelled: "It works through behaviour, which a static model omits.",
    visual: {
      kind: "split",
      caption: "How the duty to engage works",
      root: [{ icon: "user", label: "A claimant" }],
      test: { icon: "clipboard", label: "Duty to engage" },
      branches: [
        { answer: "Met", icon: "check", label: "Allowance continues" },
        { answer: "Refused", icon: "alert", label: "Allowance lost", tone: "loss" },
      ],
      marker: "Behavioural, not modelled",
      alt: "A young person receiving the Youth Allowance has a duty to engage; where it is met the allowance continues, and persistent refusal can end in its loss. How claimants respond is behavioural and not modelled.",
    },
  },
  {
    // Report 1.1, para 71 (and 4.5, care-experienced young people): £50 a
    // week for 6 months, conditional on a participation plan
    id: "care_leaver_transition_allowance",
    name: "Care Leaver Transition Allowance",
    summary: "A six-month £50 weekly allowance for care leavers who are NEET or at serious risk.",
    affects: "Care leavers with a participation plan",
    category: BENEFITS,
    kind: "A new time-limited allowance.",
    notModelled: "The model's data do not identify care leavers.",
    visual: {
      kind: "split",
      caption: "Who gets the transition allowance",
      root: [{ icon: "user", label: "A young person" }],
      test: { icon: "clipboard", label: "Care leaver, with a participation plan", unknown: "No flag in the data" },
      branches: [
        { answer: "No", icon: "ban", label: "No allowance" },
        { answer: "Yes", icon: "wallet", label: "Transition allowance", tone: "gain", plus: true },
      ],
      alt: "A care leaver who is out of work and education, or at risk of it, and agrees a participation plan would get a transition allowance for six months. The data hold no flag for care leavers.",
    },
  },
  {
    // Report 6.4, paras 675 to 681: a statutory entitlement at 18 to 24,
    // with a paid 6-month job as backstop after 12 months
    id: "opportunity_guarantee",
    name: "Opportunity Guarantee",
    summary: "A legal right to education, training or work, with a paid six-month job as backstop.",
    affects: "18 to 24-year-olds not in work or education",
    category: EMPLOYMENT,
    kind: "A legal entitlement to a place.",
    notModelled: "An entitlement to places, not a tax or benefit rule.",
    visual: {
      kind: "offers",
      caption: "What the Opportunity Guarantee offers",
      offers: [
        { icon: "briefcase", label: "A job" },
        { icon: "cap", label: "Education or training" },
        { icon: "compass", label: "A placement or civic service" },
      ],
      today: "Youth Guarantee today",
      more: "Wider, and in law",
      scale: "Not to scale",
      alt: "The Opportunity Guarantee offers a job, education or training, or a placement or civic service, as a legal entitlement wider than today's Youth Guarantee, with a paid job as backstop.",
    },
  },
  {
    // Report 1.1, para 51, and 3.5 "Helping employers financially": £3,000
    // for a young person NEET for 6 months; £2,000 premiums for greater
    // barriers and for businesses with fewer than 50 employees
    id: "employer_hiring_payments",
    name: "Hiring payments to employers",
    summary: "£3,000 for hiring a young person six months out of work and education; £2,000 premiums.",
    affects: "Employers, and young people out of work and education",
    category: EMPLOYMENT,
    kind: "A grant to employers.",
    notModelled: "Its effect is on hiring, which a static model omits.",
    visual: {
      kind: "split",
      caption: "When an employer gets a hiring payment",
      root: [{ icon: "building", label: "An employer hires a young person" }],
      test: { icon: "clipboard", label: "Six months out of work or study" },
      branches: [
        { answer: "No", icon: "ban", label: "No payment" },
        { answer: "Yes", icon: "banknote", label: "Hiring payment", tone: "gain", plus: true },
      ],
      marker: "Hiring response, not modelled",
      alt: "An employer who hires a young person out of work and education for six months would get a hiring payment, with premiums for small businesses and for young people facing greater barriers. How hiring responds is not modelled.",
    },
  },
  {
    // Report 1.1, paras 72 and 73, and 4.5 "Apprenticeships": around
    // 270,000 under-25 starts a year by 2036; 25,000 pre-apprenticeship
    // places initially
    id: "apprenticeship_target",
    name: "Apprenticeship target",
    summary: "Towards 270,000 under-25 starts a year by 2036, with 25,000 pre-apprenticeship places.",
    affects: "Young people under 25",
    category: EDUCATION,
    kind: "A target, with funding for places.",
    notModelled: "A target for places, not a tax or benefit rule.",
    visual: {
      kind: "offers",
      caption: "What the apprenticeship target adds",
      offers: [
        { icon: "book", label: "Pre-apprenticeships" },
        { icon: "cap", label: "Apprenticeships" },
      ],
      today: "Starts today",
      more: "More starts",
      scale: "Not to scale",
      alt: "The apprenticeship target adds pre-apprenticeship places and more apprenticeship starts for young people.",
    },
  },
  {
    // Report 1.1, para 67, and 4.5 "Further education": an extra 150,000
    // 18 to 24-year-olds participating a year, over the next decade
    id: "further_education_places",
    name: "Further education places",
    summary: "150,000 more 18 to 24-year-olds in further education a year, over the decade.",
    affects: "18 to 24-year-olds",
    category: EDUCATION,
    kind: "A spending programme.",
    notModelled: "A spending programme, not a tax or benefit rule.",
    visual: {
      kind: "offers",
      caption: "What the further education expansion adds",
      offers: [
        { icon: "cap", label: "College places" },
        { icon: "sliders", label: "Technical learning" },
      ],
      today: "Learners today",
      more: "More learners",
      scale: "Not to scale",
      alt: "The further education expansion adds college places and technical learning for young adults.",
    },
  },
];
