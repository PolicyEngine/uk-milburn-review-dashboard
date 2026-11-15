/**
 * Measures the Household calculator always adds to a household's request
 * that are not in the national results: not in the manifest, the page
 * header's policy selector, the charts, the maps or the combined package.
 * The household API still knows them (its reform registry), so one
 * household can be calculated with them.
 *
 * The savings income tax rise is held back from the national results while
 * the savings data are corrected (María, #290, 28 October 2026); Vahid and
 * María agreed it goes in the calculator only, and it is always included
 * there (Vahid, 28 October). The cash ISA limit kept at £20,000 joined it
 * on 29 October (María): its effect rests on what a household pays into
 * cash ISAs, which our survey data do not hold yet. The Machine Games
 * Duty rise joined them on 2 November: our survey data hold no gambling
 * yet, and the model cannot tell higher-stake machines from the rest. On
 * the next certified national (policyengine.py#731) both have data, but
 * stay here: the cash ISA figure rests on where savers would have put the
 * excess, and the duty's on machines the Budget leaves at 20%. To publish
 * one, take it out of this list and add it to the package
 * (AUTUMN_BUDGET_2026_COMBINED_COMPONENTS in reforms.py). This is the one
 * place the page names them outside the measure catalogue.
 *
 * The Milburn review has none: the helpers below are built from an empty
 * list (calculatorOnlyHelpers), so the calculator adds nothing to a
 * request. Tests build them from the Autumn Budget's list
 * (test/calculatorOnlyFixture.js) to keep the mechanism covered.
 */
export const SAVINGS_INCOME_RATES_ID = "savings_income_rates_up";

/**
 * The helpers for a list of calculator-only measures (id to { id, name,
 * phrase }).
 */
export function calculatorOnlyHelpers(measures) {
  const ids = Object.keys(measures);
  const isCalculatorOnly = (id) => Object.hasOwn(measures, id);

  /**
   * A household request's measures: the header's selection, then every
   * calculator-only measure not already in it. With nothing selected,
   * nothing (no request is made then).
   */
  const withCalculatorOnly = (policies) =>
    policies.length === 0 ? [] : [...policies, ...ids.filter((id) => !policies.includes(id))];

  /** The measures without the calculator-only ones (for the national figures). */
  const withoutCalculatorOnly = (policies) => policies.filter((id) => !isCalculatorOnly(id));

  /**
   * Whether taking `ids` out of the selection (`selected`) can lift a
   * refusal of them: only when each one is selected and none is
   * calculator-only, which every household request carries, selected or
   * not (withCalculatorOnly), so a Remove would change nothing.
   */
  const removableFromSelection = (refused, selected) =>
    refused.every((id) => selected.includes(id) && !isCalculatorOnly(id));

  /**
   * The measures of a household request for `policies` (withCalculatorOnly)
   * that must be checked against their published figures: every selected
   * one, and each calculator-only measure the request adds once the
   * publication names it (`isPublished`); until then it has no receipt to
   * check it against.
   */
  const publishedRequest = (policies, isPublished) =>
    withCalculatorOnly(policies).filter((id) => policies.includes(id) || isPublished(id));

  /**
   * The measures among `policies` whose answers are checked against an
   * approved definition (`definitions`): every one but a calculator-only
   * measure with none.
   */
  const definitionChecked = (policies, definitions) =>
    policies.filter((id) => !isCalculatorOnly(id) || Object.hasOwn(definitions ?? {}, id));

  /**
   * The measures a household's result covers, in words: the selected ones
   * by number, then each calculator-only one by name ("7 policies and the
   * savings income tax rise"). `count` and `named` say the same as `text`.
   */
  function resultPolicies(policies) {
    const distinct = [...new Set(policies)];
    const count = withoutCalculatorOnly(distinct).length;
    const named = distinct.filter(isCalculatorOnly).map((id) => measures[id].phrase);
    const parts = [...(count > 0 || named.length === 0 ? [`${count} ${count === 1 ? "policy" : "policies"}`] : []), ...named];
    const text = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
    return { count, named, text };
  }

  return {
    CALCULATOR_ONLY_MEASURES: measures,
    isCalculatorOnly,
    withCalculatorOnly,
    withoutCalculatorOnly,
    removableFromSelection,
    publishedRequest,
    definitionChecked,
    resultPolicies,
  };
}

// None for the Milburn review: the Autumn Budget's calculator-only measures
// (the savings income tax rise, the cash ISA limit, Machine Games Duty) are
// not part of it, so the household calculator adds nothing to a request
export const {
  CALCULATOR_ONLY_MEASURES,
  isCalculatorOnly,
  withCalculatorOnly,
  withoutCalculatorOnly,
  removableFromSelection,
  publishedRequest,
  definitionChecked,
  resultPolicies,
} = calculatorOnlyHelpers({});
