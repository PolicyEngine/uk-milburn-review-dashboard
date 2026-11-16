/**
 * Candidate measures the dashboard lists but cannot compute, each with the
 * reason: the pipeline's registry
 * (uk_budget_data.reforms.NOT_COMPUTABLE_MEASURES), each line shortened to
 * fit one line of a card. They have no figures
 * anywhere on the page: never £0, which would read as an estimate of no
 * effect. `kind` says in a line what sort of measure it is. Each `visual` is its card's "What changes" picture, in
 * UnmodelledVisual's shapes (components/policies/UnmodelledVisual.jsx):
 * words only, as no figure is shown for these measures.
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
      kind: "flow",
      caption: "Which health element a claimant gets",
      lanes: [
        { label: "Other claimants", steps: ["Health element"] },
        { label: "Severe conditions", steps: ["Meets the criteria", "Higher health element"], tone: "gain" },
      ],
      alt: "A claimant who meets the severe conditions criteria would get a higher health element; other claimants the health element. The higher amount is not set out.",
    },
  },
  {
    id: "additional_cost_allowance",
    name: "Additional cost allowance",
    summary: "A new allowance for disability costs, replacing PIP.",
    affects: "Young disabled people",
    category: { label: "Benefits", icon: "piggy" },
    kind: "A new benefit in place of PIP.",
    notModelled: "Its rules (eligibility, rates) have not been set out.",
    visual: {
      kind: "flow",
      caption: "Help with the extra costs of disability for young people",
      lanes: [
        { label: "Today", steps: ["PIP"] },
        { label: "Proposed", steps: ["Additional cost allowance"], tone: "gain" },
      ],
      alt: "Today young disabled people can get PIP; the proposal replaces it with an additional cost allowance, whose rules are not set out.",
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
      kind: "flow",
      caption: "How conditionality works",
      lanes: [{ label: "A claimant", steps: ["Requirements", "Not met", "Sanction"] }],
      alt: "A young Universal Credit claimant has work-related requirements; where they are not met, a sanction reduces the award.",
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
      kind: "highest",
      caption: "What the Youth Guarantee offers",
      inputs: [{ label: "Training" }, { label: "A job" }, { label: "Work experience" }],
      result: "More places",
      alt: "The Youth Guarantee offers training, a job or work experience; the expansion adds places for young people.",
    },
  },
];
