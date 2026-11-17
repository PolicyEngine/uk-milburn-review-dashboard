import { reportCopy } from "./reportStatus";

// What is said of rules not yet set out: the report-status switch's words
const COPY = reportCopy();

/**
 * Candidate measures the dashboard lists but cannot compute, each with the
 * reason: the pipeline's registry
 * (uk_budget_data.reforms.NOT_COMPUTABLE_MEASURES), each line shortened to
 * fit one line of a card. They have no figures
 * anywhere on the page: never £0, which would read as an estimate of no
 * effect. `kind` says in a line what sort of measure it is. Each `visual` is its card's "What changes" diagram, in
 * NotComputableVisual's shapes (components/policies/MilburnVisual.jsx): a
 * decision split, a swap of one benefit for another, or offers with more
 * places. Icons are TitleIcon names. Words only, as no figure is shown
 * for these measures.
 */
export const NOT_COMPUTABLE_MEASURES = [
  {
    id: "severe_conditions_higher_rate",
    name: "Higher health element for severe conditions",
    summary: "A higher UC health element for the most severe conditions.",
    affects: "Claimants meeting the severe conditions criteria",
    category: { label: "Benefits", icon: "piggy" },
    kind: "A higher rate of an existing benefit.",
    notModelled: "The data hold no severe conditions flag.",
    visual: {
      kind: "split",
      caption: "Which health element a claimant gets",
      root: [{ icon: "user", label: "A claimant" }],
      test: { icon: "clipboard", label: "Severe conditions criteria", unknown: "No flag in the data" },
      branches: [
        { answer: "Not met", icon: "heartPulse", label: "Health element" },
        { answer: "Met", icon: "heartPulse", label: "Higher health element", tone: "gain", plus: true },
      ],
      alt: `A claimant who meets the severe conditions criteria would get a higher health element; other claimants the health element.${COPY.higherAmountAltTail}`,
    },
  },
  {
    id: "additional_cost_allowance",
    name: "Additional cost allowance",
    summary: "A new allowance for disability costs, replacing PIP.",
    affects: "Young disabled people",
    category: { label: "Benefits", icon: "piggy" },
    kind: "A new benefit in place of PIP.",
    notModelled: COPY.rulesNotSetOut,
    visual: {
      kind: "swap",
      caption: "Help with the extra costs of disability for young people",
      before: { when: "Today", icon: "wallet", label: "PIP", facts: ["Eligibility", "Rates"] },
      after: { when: "Proposed", icon: "sparkle", label: "Additional cost allowance", unknowns: ["Eligibility", "Rates"] },
      alt: `Today young disabled people can get PIP; the proposal replaces it with an additional cost allowance${COPY.newBenefitAltTail}`,
    },
  },
  {
    id: "youth_conditionality",
    name: "Conditionality for young people",
    summary: "Work requirements and sanctions for young UC claimants.",
    affects: "Young Universal Credit claimants",
    category: { label: "Benefits", icon: "piggy" },
    kind: "Rules on what claimants must do.",
    notModelled: "It works through behaviour, which a static model omits.",
    visual: {
      kind: "split",
      caption: "How conditionality works",
      root: [{ icon: "user", label: "A claimant" }],
      test: { icon: "clipboard", label: "Requirements" },
      branches: [
        { answer: "Met", icon: "check", label: "Award continues" },
        { answer: "Not met", icon: "alert", label: "Sanction", tone: "loss" },
      ],
      marker: "Behavioural, not modelled",
      alt: "A young Universal Credit claimant has work-related requirements; where they are met the award continues, and where they are not met a sanction reduces the award. How claimants respond is behavioural and not modelled.",
    },
  },
  {
    id: "youth_guarantee_expansion",
    name: "Youth Guarantee expansion",
    summary: "More training, job and work experience places.",
    affects: "Young people not in work or education",
    category: { label: "Employment support", icon: "briefcase" },
    kind: "A spending programme.",
    notModelled: "A spending programme, not a tax or benefit rule.",
    visual: {
      kind: "offers",
      caption: "What the Youth Guarantee offers",
      offers: [
        { icon: "cap", label: "Training" },
        { icon: "briefcase", label: "A job" },
        { icon: "compass", label: "Work experience" },
      ],
      today: "Places today",
      more: "More places",
      scale: "Not to scale",
      alt: "The Youth Guarantee offers training, a job or work experience; the expansion adds places for young people.",
    },
  },
];
