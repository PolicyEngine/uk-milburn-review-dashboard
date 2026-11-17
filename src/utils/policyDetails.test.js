import { expect, it } from "vitest";
import fc from "fast-check";
import { measureSummary, MILBURN_POLICY_DETAILS, POLICY_DETAILS, policyDetailsFor, withPolicyDetails } from "./policyDetails";

// The catalogue decides which measures exist, their names, descriptions,
// order and colours (#104); a details entry only adds a card's text, and
// only to the measure as described when the entry was written (writtenFor):
// one changed since shows as published. These hold for any catalogue
// measure, published under a known id or not, described as written or not.
const KNOWN_IDS = POLICY_DETAILS.map((entry) => entry.id);
const writtenFor = Object.fromEntries(POLICY_DETAILS.map((entry) => [entry.id, entry.writtenFor]));
const catalogueMeasure = fc
  .record({
    id: fc.oneof(fc.constantFrom(...KNOWN_IDS), fc.string()),
    name: fc.string(),
    description: fc.string(),
    asWritten: fc.boolean(),
    color: fc.string(),
    order: fc.integer(),
    displayable: fc.boolean(),
  })
  .map(({ asWritten, ...measure }) => (asWritten && Object.hasOwn(writtenFor, measure.id) ? { ...measure, description: writtenFor[measure.id] } : measure));

it("keeps every field the catalogue publishes, whatever details exist for the id", () => {
  fc.assert(
    fc.property(catalogueMeasure, (measure) => {
      const shown = withPolicyDetails(measure);
      for (const [field, value] of Object.entries(measure)) expect(shown[field]).toEqual(value);
    }),
  );
});

it("adds nothing unless the measure is described exactly as its entry was written for", () => {
  fc.assert(
    fc.property(catalogueMeasure, (measure) => {
      fc.pre(measure.description !== writtenFor[measure.id]);
      expect(policyDetailsFor(measure)).toBeNull();
      expect(withPolicyDetails(measure)).toEqual(measure);
    }),
  );
});

it("adds its entry's card text to a measure described as written", () => {
  for (const { id, name: _name, description: _description, writtenFor: description, ...fields } of POLICY_DETAILS) {
    expect(withPolicyDetails({ id, name: "Published name", description })).toEqual({ ...fields, id, name: "Published name", description });
  }
});

it("records for each entry the description it was written for, and carries no revenue figures", () => {
  for (const entry of POLICY_DETAILS) {
    expect(typeof entry.writtenFor, entry.id).toBe("string");
    expect(entry.writtenFor.length, entry.id).toBeGreaterThan(0);
    for (const field of ["cost", "revenue", "budgetaryImpact", "impact", "values"]) expect(entry).not.toHaveProperty(field);
  }
});

it("gives every measure with a description a summary: its entry's while it holds, else the description's first sentence", () => {
  fc.assert(
    fc.property(catalogueMeasure, (measure) => {
      const summary = measureSummary(measure);
      const details = policyDetailsFor(measure);
      if (details?.summary) expect(summary).toBe(details.summary);
      else if (measure.description.trim().replace(/^Candidate measure\.\s*/i, "").trim()) {
        expect(summary).toBeTruthy();
        expect(summary).not.toMatch(/…$/);
      } else expect(summary).toBeNull();
    }),
  );
});

it("falls back to the whole first published sentence, without its Candidate measure label, never cut short", () => {
  expect(measureSummary({ id: "x", description: "Candidate measure. Rates rise by 2p. Then more." })).toBe("Rates rise by 2p.");
  const sentence = `${"word ".repeat(60)}end.`;
  expect(measureSummary({ id: "x", description: `Candidate measure. ${sentence} Next sentence.` })).toBe(sentence);
  expect(measureSummary({ id: "x", description: "Rates rise by 2.5% from April" })).toBe("Rates rise by 2.5% from April");
  expect(measureSummary({ id: "x", description: "" })).toBeNull();
});

it("gives every measure policyDetails was written for a tip as described now, or as published if changed", () => {
  for (const entry of POLICY_DETAILS) {
    expect(measureSummary({ id: entry.id, description: entry.writtenFor })).toBe(entry.summary);
    expect(measureSummary({ id: entry.id, description: `Candidate measure. Changed ${entry.id}.` })).toBe(`Changed ${entry.id}.`);
  }
});

const words = (text) => text.trim().split(/\s+/).length;

it("keeps every entry's card text short: summary in 15 words, 2 to 4 points of 12, details as bullets of 20", () => {
  for (const entry of POLICY_DETAILS) {
    expect(words(entry.summary), entry.id).toBeLessThanOrEqual(15);
    expect(entry.points.length, entry.id).toBeGreaterThanOrEqual(2);
    expect(entry.points.length, entry.id).toBeLessThanOrEqual(4);
    for (const point of entry.points) {
      const text = typeof point === "string" ? point : point.text;
      expect(words(text), `${entry.id}: ${text}`).toBeLessThanOrEqual(12);
      if (typeof point !== "string") expect(words(point.label), `${entry.id}: ${point.label}`).toBeLessThanOrEqual(3);
    }
    expect(Array.isArray(entry.details), entry.id).toBe(true);
    for (const detail of entry.details) expect(words(detail), `${entry.id}: ${detail}`).toBeLessThanOrEqual(20);
    // The old paragraph fields are gone: their facts are in points and details
    expect(entry.howCalculated, entry.id).toBeUndefined();
    expect(entry.caveats, entry.id).toBeUndefined();
  }
});

it("repeats no At a glance fact in a card's points", () => {
  for (const entry of POLICY_DETAILS) {
    const glance = [entry.starts, entry.ends, entry.affects].filter(Boolean).map((text) => text.toLowerCase());
    for (const point of entry.points) {
      const text = (typeof point === "string" ? point : `${point.label} ${point.text}`).toLowerCase();
      for (const fact of glance) expect(text.includes(fact), `${entry.id}: ${text} repeats ${fact}`).toBe(false);
    }
  }
});

describe("nounOf: a measure as a noun after 'the'", () => {
  it("reads as a noun for every measure with a card, never a short name such as 'Fuel duty cut extended'", async () => {
    const { POLICY_DETAILS, nounOf } = await import("./policyDetails");
    const fuel = POLICY_DETAILS.find((entry) => entry.id === "fuel_duty_rise_deferral");
    expect(nounOf({ id: fuel.id, description: fuel.writtenFor })).toBe("fuel duty cut");
    const pta = POLICY_DETAILS.find((entry) => entry.id === "state_pension_income_tax_protection");
    // A proper name keeps its capitals ("the Pension Tax Allowance", not "the pension Tax Allowance")
    expect(nounOf({ id: pta.id, description: pta.writtenFor })).toBe("Pension Tax Allowance");
  });
  it("falls back to the short name with its first capital lowered", async () => {
    const { nounOf } = await import("./policyDetails");
    expect(nounOf({ id: "x", name: "Threshold freeze" })).toBe("threshold freeze");
    expect(nounOf({ id: "y", name: "BADR cut" })).toBe("BADR cut");
    // A proper name keeps its capitals when its entry no longer matches the publication
    expect(nounOf({ id: "warm_home_discount_top_up", name: "Warm Home Discount top-up" })).toBe("Warm Home Discount top-up");
    expect(nounOf({ id: "carers_allowance_earnings_taper", name: "Carer's Allowance earnings taper", description: "changed" })).toBe("Carer's Allowance earnings taper");
  });
  it("gives the savings income measure a noun, never 'the savings income tax up'", async () => {
    const { POLICY_DETAILS, nounOf } = await import("./policyDetails");
    const savings = POLICY_DETAILS.find((entry) => entry.id === "savings_income_rates_up");
    expect(nounOf({ id: savings.id, description: savings.writtenFor })).toBe("savings income tax rise");
  });
});

it("describes each Milburn candidate measure in one neutral line, applied whatever its published description", () => {
  const ids = [
    "uc_health_element_removed_under_25",
    "uc_health_element_removed_under_25_new_claims",
    "pip_removed_under_25",
    "youth_allowance_at_25_plus_rate",
    "employer_nics_zero_under_25",
    "milburn_package",
    "milburn_package_central",
    "milburn_package_phased",
    "uc_health_element_removed_under_22",
    "uc_health_element_removed_under_25_severe_kept",
    "pip_halved_under_25",
    "pip_removed_16_to_24",
    // The final report's employer NI threshold, then its benefit runs
    "milburn_report_employer_nics_threshold",
    "milburn_report_package",
    "milburn_report_uc_health",
    "milburn_report_pip",
  ];
  expect(MILBURN_POLICY_DETAILS.map((entry) => entry.id)).toEqual(ids);
  for (const entry of MILBURN_POLICY_DETAILS) {
    expect(words(entry.summary), entry.id).toBeLessThanOrEqual(15);
    expect(entry.summary, entry.id).toMatch(/^[A-Z].*\.$/);
    expect(entry.points.length, entry.id).toBeGreaterThanOrEqual(2);
    for (const point of entry.points) expect(words(typeof point === "string" ? point : point.text), entry.id).toBeLessThanOrEqual(12);
    for (const detail of entry.details) expect(words(detail), entry.id).toBeLessThanOrEqual(20);
    expect(policyDetailsFor({ id: entry.id, description: "Anything the backend writes." })?.summary).toBe(entry.summary);
  }
});
