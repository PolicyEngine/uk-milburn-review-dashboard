/**
 * Candidate measures the dashboard lists but cannot compute, each with the
 * reason, as the pipeline's registry states them
 * (uk_budget_data.reforms.NOT_COMPUTABLE_MEASURES). They have no figures
 * anywhere on the page: never £0, which would read as an estimate of no
 * effect.
 */
export const NOT_COMPUTABLE_MEASURES = [
  {
    id: "severe_conditions_higher_rate",
    name: "Higher health element for severe conditions",
    summary: "A higher Universal Credit health element for claimants who meet the severe conditions criteria.",
    affects: "UC claimants who meet the severe conditions criteria",
    category: { label: "Benefits", icon: "piggy" },
    notModelled: "The data hold no severe conditions flag, so the claimants it would reach cannot be identified.",
  },
  {
    id: "additional_cost_allowance",
    name: "Additional cost allowance",
    summary: "A new allowance towards the extra costs of disability, replacing PIP for young people.",
    affects: "Young disabled people",
    category: { label: "Benefits", icon: "piggy" },
    notModelled: "Its rules (eligibility, rates) have not been set out.",
  },
  {
    id: "youth_conditionality",
    name: "Conditionality for young people",
    summary: "Work-related requirements and sanctions for young Universal Credit claimants.",
    affects: "Young people claiming Universal Credit",
    category: { label: "Benefits", icon: "piggy" },
    notModelled: "Its effect works through behaviour (job search, sanctions), which a static model does not capture.",
  },
  {
    id: "youth_guarantee_expansion",
    name: "Youth Guarantee expansion",
    summary: "More training, job and work experience places for young people under the Youth Guarantee.",
    affects: "Young people not in work or education",
    category: { label: "Employment support", icon: "briefcase" },
    notModelled: "It is a spending programme, not a tax or benefit rule the model applies to households.",
  },
];
