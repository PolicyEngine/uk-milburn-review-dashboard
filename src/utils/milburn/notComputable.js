/**
 * Candidate measures the dashboard lists but cannot compute, each with the
 * reason, as the pipeline's registry states them
 * (uk_budget_data.reforms.NOT_COMPUTABLE_MEASURES). They have no figures
 * anywhere on the page: never £0, which would read as an estimate of no
 * effect. `kind` says in a line what sort of measure it is. Each `visual` is its card's "What changes" picture, in
 * UnmodelledVisual's shapes (components/policies/UnmodelledVisual.jsx):
 * words only, as no figure is shown for these measures.
 */
export const NOT_COMPUTABLE_MEASURES = [
  {
    id: "severe_conditions_higher_rate",
    name: "Higher health element for severe conditions",
    summary: "A higher Universal Credit health element for claimants who meet the severe conditions criteria.",
    affects: "UC claimants who meet the severe conditions criteria",
    category: { label: "Benefits", icon: "piggy" },
    kind: "A higher rate of an existing benefit.",
    notModelled: "The data hold no severe conditions flag, so the claimants it would reach cannot be identified.",
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
    summary: "A new allowance towards the extra costs of disability, replacing PIP for young people.",
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
    summary: "Work-related requirements and sanctions for young Universal Credit claimants.",
    affects: "Young people claiming Universal Credit",
    category: { label: "Benefits", icon: "piggy" },
    kind: "Rules on what claimants must do.",
    notModelled: "Its effect works through behaviour (job search, sanctions), which a static model does not capture.",
    visual: {
      kind: "flow",
      caption: "How conditionality works",
      lanes: [{ label: "A young claimant", steps: ["Work-related requirements", "Not met", "Sanction"] }],
      alt: "A young Universal Credit claimant has work-related requirements; where they are not met, a sanction reduces the award.",
    },
  },
  {
    id: "youth_guarantee_expansion",
    name: "Youth Guarantee expansion",
    summary: "More training, job and work experience places for young people under the Youth Guarantee.",
    affects: "Young people not in work or education",
    category: { label: "Employment support", icon: "briefcase" },
    kind: "A spending programme, not a tax or benefit rule.",
    notModelled: "It is a spending programme, not a tax or benefit rule the model applies to households.",
    visual: {
      kind: "highest",
      caption: "What the Youth Guarantee offers",
      inputs: [{ label: "Training" }, { label: "A job" }, { label: "Work experience" }],
      result: "More places for young people",
      alt: "The Youth Guarantee offers training, a job or work experience; the expansion adds places for young people.",
    },
  },
];
