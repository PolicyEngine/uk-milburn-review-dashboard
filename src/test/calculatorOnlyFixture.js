/**
 * The Autumn Budget's calculator-only measures, for tests that exercise the
 * mechanism (utils/calculatorOnlyMeasures.js builds the page's helpers from
 * an empty list for the Milburn review). Use with
 *
 *   vi.mock("<path>/utils/calculatorOnlyMeasures", async (original) =>
 *     (await import("<path>/test/calculatorOnlyFixture")).mockCalculatorOnly(await original()));
 */
export const AUTUMN_BUDGET_CALCULATOR_ONLY = {
  savings_income_rates_up: {
    id: "savings_income_rates_up",
    name: "Savings income tax up",
    phrase: "the savings income tax rise",
  },
  cash_isa_limit_kept: {
    id: "cash_isa_limit_kept",
    name: "Cash ISA limit kept at £20,000",
    phrase: "the cash ISA limit kept at £20,000",
  },
  machine_games_duty_rise: {
    id: "machine_games_duty_rise",
    name: "Machine Games Duty up to 25% on higher-stake machines",
    phrase: "the rise in Machine Games Duty",
  },
};

/** The module with its helpers built from the Autumn Budget's list. */
export function mockCalculatorOnly(actual) {
  return { ...actual, ...actual.calculatorOnlyHelpers(AUTUMN_BUDGET_CALCULATOR_ONLY) };
}
