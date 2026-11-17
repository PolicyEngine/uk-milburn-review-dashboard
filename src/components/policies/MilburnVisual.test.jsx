import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { policyVisual } from "./PolicyVisual";
import { PolicyCard } from "../PolicyCards";
import { MILBURN_POLICY_DETAILS } from "../../utils/policyDetails";
import { MILBURN_GROUPS } from "../../utils/milburn/measureGroups";
import { MILBURN_PHASING, MILBURN_RATES, milburnVisualView, phasedSavingShares, weeklyToMonthly } from "../../utils/milburn/measureVisuals";
import { parseSummary } from "../../utils/milburn/summary";

const PUBLISHED_SUMMARY = readFileSync(join(__dirname, "..", "..", "..", "public", "data", "milburn_summary.json"), "utf8");

afterEach(() => {
  vi.unstubAllGlobals();
});

const details = Object.fromEntries(MILBURN_POLICY_DETAILS.map((entry) => [entry.id, entry]));
const policy = (id) => ({ ...details[id], id, name: "The measure", direction: "raise" });
// No policy_parameters.json entry: the Milburn runs publish none
const show = (id) => render(policyVisual(policy(id), null));
const image = () => screen.getByRole("img");

describe("MilburnVisual", () => {
  it("gives every measure shown on the Measures tab a visual, drawn without a published entry", () => {
    const shown = MILBURN_GROUPS.filter((group) => !group.hidden).flatMap((group) => group.ids);
    for (const id of shown) {
      expect(details[id]?.visual?.place, id).toBe("change");
      expect(milburnVisualView(details[id].visual, "The measure")?.alt, id).toMatch(/^The measure: .*\.$/);
    }
  });

  it("says whose rates a report card's chart shows: 2027-28's, on a measure that starts in April 2029", () => {
    for (const id of ["milburn_report_package", "milburn_report_uc_health", "milburn_report_pip"]) {
      expect(details[id].starts, id).toBe("Apr 2029");
      const view = milburnVisualView(details[id].visual, "The measure");
      expect(view.caption, id).toMatch(/, at 2027-28 rates$/);
      expect(view.alt, id).toContain("at 2027-28 rates");
      // The details date the rates as the caption does, and nothing says they are 2029-30's
      expect(details[id].details.join(" "), id).toContain("The chart shows 2027-28 rates");
      expect(details[id].details.join(" "), id).not.toMatch(/2029-30 rates/);
    }
    // The pre-report cards, which start with their rates' year, keep the plain year
    expect(milburnVisualView(details.pip_halved_under_25.visual, "The measure").caption).toMatch(/, 2027-28$/);
  });

  it("employer threshold: the rate stays, the earnings it starts from move at 21 to 24, and no zero rate is drawn there", () => {
    const view = milburnVisualView(details.milburn_report_employer_nics_threshold.visual, "The measure");
    expect(view.caption).toBe("Earnings from which employers pay National Insurance, by the employee's age");
    expect(view.bands.map((band) => [band.title, band.text])).toEqual([
      ["Under 21", "0% already"],
      ["21 to 24", "From £10,000, was £5,000"],
      ["25 and over", "From £5,000"],
    ]);
    expect(view.chips[0]).toMatchObject({ when: "Rate above the threshold", value: "15%, unchanged" });
    // The rate is not cut at 21 to 24: same height before and after, marked as changed
    expect(view.ages.filter((cell) => cell.age >= 21 && cell.age <= 24).every((cell) => cell.before === 1 && cell.after === 1 && cell.some)).toBe(true);
    expect(JSON.stringify(view)).not.toMatch(/0%, was|Zero rate on earnings/);
    // The comparator still draws its zero rate
    expect(JSON.stringify(milburnVisualView(details.employer_nics_zero_under_25.visual, "The measure"))).toContain("0%, was 15%");
  });

  it("health element: nil under the age limit, both rates named", () => {
    const { container } = show("uc_health_element_removed_under_25");
    expect(image()).toHaveAccessibleName(/Under 25: £0 under the measure, instead of about £442 a month for claims before April 2026 or £217\.26 for claims from April 2026/);
    expect(container.querySelectorAll(".mviz-age")).toHaveLength(12);
    expect(container.querySelectorAll(".mviz-age-bar.is-nil")).toHaveLength(7);
  });

  it("health element under 22: four ages lose it", () => {
    const { container } = show("uc_health_element_removed_under_22");
    expect(image()).toHaveAccessibleName(/Under 22: £0/);
    expect(container.querySelectorAll(".mviz-age-bar.is-nil")).toHaveLength(4);
  });

  it("health element, severe cases kept: under-25s hatched, 24 or more points keep it", () => {
    const { container } = show("uc_health_element_removed_under_25_severe_kept");
    expect(image()).toHaveAccessibleName(/A claimant under 25 with 24 or more PIP daily living points keeps it/);
    expect(container.querySelectorAll(".mviz-age-bar.is-some")).toHaveLength(7);
  });

  it("PIP: removed for 18 to 24, or from 16, or halved", () => {
    const removed = show("pip_removed_under_25");
    expect(image()).toHaveAccessibleName(/Ages 18 to 24: no PIP.*daily living about £79 \(standard\) or £119 \(enhanced\); mobility about £31 or £83/);
    expect(removed.container.querySelectorAll(".mviz-age-bar.is-nil")).toHaveLength(7);
    removed.unmount();
    const from16 = show("pip_removed_16_to_24");
    expect(image()).toHaveAccessibleName(/Ages 16 to 24: no PIP/);
    expect(from16.container.querySelectorAll(".mviz-age-bar.is-nil")).toHaveLength(9);
    from16.unmount();
    const halved = show("pip_halved_under_25");
    expect(image()).toHaveAccessibleName(/Ages 18 to 24: half the award/);
    expect(halved.container.querySelectorAll(".mviz-age-bar.is-nil")).toHaveLength(0);
    expect(halved.container.querySelectorAll(".mviz-age-ghost")).toHaveLength(7);
  });

  it("packages: the illustrative claimant's month, element plus PIP", () => {
    const full = show("milburn_package");
    expect(image()).toHaveAccessibleName(/Current law: about £786, of which £442 health element and £344 PIP.*Under the package: £0, £786 a month less/);
    full.unmount();
    show("milburn_package_central");
    expect(image()).toHaveAccessibleName(/Under the package: £172 \(half the PIP\), £614 a month less\. A claimant with 24 or more PIP daily living points keeps the health element/);
    expect(Math.round(weeklyToMonthly(MILBURN_RATES.pip.dailyLiving.standard))).toBe(344);
  });

  it("phased package: the rule in words, and its saving as a share of full abolition's from the results", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(PUBLISHED_SUMMARY, { status: 200 })));
    const { container } = show("milburn_package_phased");
    // The rule, said at once; no share is typed
    expect(image()).toHaveAccessibleName(/People who turned 18 since April 2026 are reached at once; existing claimants as they are reassessed, at 25% of the remaining caseload a year\./);
    expect(MILBURN_PHASING.reassessedEachYear).toBe(0.25);
    // Then the run's own saving over full abolition's, a year each
    await screen.findByRole("img", { name: /Exchequer saving as a share of full abolition's, from the results: 45% in 2027-28, 72% in 2028-29, 81% in 2029-30, 90% in 2030-31, 97% in 2031-32\./ });
    expect(container.querySelectorAll(".mviz-column")).toHaveLength(5);
    expect(image()).not.toHaveAccessibleName(/36%/);
    const shares = phasedSavingShares(parseSummary(JSON.parse(PUBLISHED_SUMMARY)), "milburn_package_phased");
    expect(shares).toHaveLength(5);
    expect(shares[0]).toEqual({ year: 2027, share: 2.009 / 4.486 });
  });

  it("the report's runs with stated assumptions: each card's visual says its own rule, and shares come from the results", async () => {
    // Higher Youth Allowance: the 25-and-over rate, for claims with a housing costs element only
    const allowance = milburnVisualView(details.milburn_report_youth_allowance_independent.visual, "The measure");
    expect(allowance.caption).toBe("Standard allowance for a claim with a housing costs element, a month, at 2027-28 rates");
    expect(allowance.alt).toMatch(/Claims without a housing costs element keep the under-25 rate\.$/);
    expect(details.milburn_report_youth_allowance_independent.starts).toBe("Apr 2029");
    // Glide path: the end state's chart, with its steps; a path that does not end at the threshold draws nothing
    const glide = details.milburn_report_employer_nics_threshold_glide_path.visual;
    const path = milburnVisualView(glide, "The measure");
    expect(path.bands[1]).toMatchObject({ title: "21 to 24", text: "From £10,000 by 2031-32, was £5,000" });
    expect(path.chips[0]).toEqual({ icon: "file-clock", when: "2027-28 to 2031-32", value: "£6,000, rising £1,000 a year" });
    expect(path.alt).toContain("in steps: £6,000 in 2027-28, rising £1,000 a year.");
    expect(milburnVisualView({ ...glide, glide: { ...glide.glide, from: 7000 } }, "The measure")).toBeNull();
    // Phased: 45% a year from the April 2028 cohort, as a share of the report's package from 2029-30
    vi.stubGlobal("fetch", vi.fn(async () => new Response(PUBLISHED_SUMMARY, { status: 200 })));
    show("milburn_report_package_phased");
    expect(image()).toHaveAccessibleName(/People who turned 18 since April 2028 are reached at once; existing claimants as they are reassessed, at 45% of the remaining caseload a year\./);
    await screen.findByRole("img", { name: /Exchequer saving as a share of the unphased package's, from the results: 59% in 2029-30, 84% in 2030-31, 93% in 2031-32\.$/ });
    const shares = phasedSavingShares(parseSummary(JSON.parse(PUBLISHED_SUMMARY)), "milburn_report_package_phased", "milburn_report_package");
    expect(shares[0]).toEqual({ year: 2029, share: 2.766 / 4.666 });
  });

  it("phased package: the rule alone when the summary is missing, never a typed share", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    const { container } = show("milburn_package_phased");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(image()).toHaveAccessibleName("The measure: People who turned 18 since April 2026 are reached at once; existing claimants as they are reassessed, at 25% of the remaining caseload a year.");
    expect(container.querySelectorAll(".mviz-column")).toHaveLength(0);
    expect(container).toHaveTextContent("25% of those remaining, each year");
    expect(phasedSavingShares(null, "milburn_package_phased")).toEqual([]);
  });

  it("standard allowance: the under-25 rate beside the 25-and-over rate", () => {
    const { container } = show("youth_allowance_at_25_plus_rate");
    expect(image()).toHaveAccessibleName(/single claimant under 25: £443 instead of £353, £90 more; For a couple both under 25: £696 instead of £551, £145 more/);
    expect(container).toHaveTextContent("+£90 a month");
  });

  it("employer National Insurance: 0% under 21 already, 21 to 24 under the measure", () => {
    const { container } = show("employer_nics_zero_under_25");
    expect(image()).toHaveAccessibleName(/Under 21: 0% already\. Ages 21 to 24: 0% under the measure, instead of 15%.*earnings up to £50,270 a year/);
    expect(container.querySelectorAll(".mviz-age-ghost")).toHaveLength(4);
  });

  it("draws nothing for a spec that does not hold", () => {
    expect(policyVisual({ name: "x", visual: { kind: "milburn-pip", place: "change", from: 18, share: 0.3 } }, null)).toBeNull();
    expect(policyVisual({ name: "x", visual: { kind: "milburn-health-element", place: "change" } }, null)).toBeNull();
  });

  it("sits in the card's What changes block, with no published parameters", () => {
    render(
      <ul>
        <PolicyCard policy={{ ...policy("pip_removed_under_25"), label: "PIP removed for 18 to 24-year-olds" }} />
      </ul>,
    );
    const block = screen.getByRole("region", { name: "What changes: PIP removed for 18 to 24-year-olds" });
    expect(block.querySelector(".mviz[role=img]")).not.toBeNull();
    expect(block.closest(".policy-card").querySelector(".policy-card-point-icon")).not.toBeNull();
  });
});

describe("the measures we cannot compute (NotComputableVisual)", () => {
  const load = async () => {
    const { NOT_COMPUTABLE_MEASURES } = await import("../../utils/milburn/notComputable");
    const { NotComputableVisual, NOT_COMPUTABLE_KINDS } = await import("./MilburnVisual");
    const byId = Object.fromEntries(NOT_COMPUTABLE_MEASURES.map((measure) => [measure.id, measure]));
    return { NOT_COMPUTABLE_MEASURES, NotComputableVisual, NOT_COMPUTABLE_KINDS, byId };
  };

  it("gives each a diagram of a known kind, in words and icons, never a figure", async () => {
    const { NOT_COMPUTABLE_MEASURES, NotComputableVisual, NOT_COMPUTABLE_KINDS } = await load();
    expect(NOT_COMPUTABLE_MEASURES.map((measure) => measure.visual.kind)).toEqual(["split", "swap", "split", "split", "split", "split", "offers", "split", "offers", "offers"]);
    for (const measure of NOT_COMPUTABLE_MEASURES) {
      expect(Object.keys(NOT_COMPUTABLE_KINDS), measure.id).toContain(measure.visual.kind);
      expect(JSON.stringify(measure.visual), measure.id).not.toMatch(/[£%\d]/);
      const { unmount } = render(<NotComputableVisual measure={measure} />);
      const block = screen.getByRole("region", { name: `What changes: ${measure.name}` });
      // One image, named by the measure's sentence; its drawing hidden from screen readers
      const figure = screen.getByRole("img");
      expect(block).toContainElement(figure);
      expect(figure).toHaveAccessibleName(measure.visual.alt);
      expect(figure.querySelector(".mnc-body")).toHaveAttribute("aria-hidden", "true");
      expect(figure.textContent, measure.id).not.toMatch(/[£%\d]/);
      // Icons drawn, each with a label beside it
      expect(figure.querySelectorAll(".mnc-icon svg").length, measure.id).toBeGreaterThanOrEqual(2);
      unmount();
    }
  });

  it("draws nothing for a measure with no diagram, or one of an unknown kind", async () => {
    const { NotComputableVisual } = await load();
    const { container } = render(
      <>
        <NotComputableVisual measure={{ id: "a", name: "A" }} />
        <NotComputableVisual measure={{ id: "b", name: "B", visual: { kind: "toString", alt: "B." } }} />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("Severe and Complex Needs Insurance: a split on whether paid work is possible, the missing flag dashed", async () => {
    const { NotComputableVisual, byId } = await load();
    const { container } = render(<NotComputableVisual measure={byId.severe_complex_needs_insurance} />);
    expect(container.querySelector(".mnc-trunk").textContent).toBe("A young personPaid work realistically possibleNo flag in the data");
    expect(container.querySelector(".mnc-trunk .mnc-node.is-unknown .mnc-chip.is-unknown")).toHaveTextContent("No flag in the data");
    const branches = [...container.querySelectorAll(".mnc-branch")];
    expect(branches.map((branch) => branch.textContent)).toEqual(["YesYouth Allowance and support", "NoSevere and Complex Needs Insurance"]);
    expect(branches[1]).toHaveClass("is-gain");
    expect(branches[1].querySelector(".mnc-icon-plus")).not.toBeNull();
    expect(container.querySelector(".mnc-marker")).toBeNull();
  });

  it("Additional Cost Allowance: PIP swapped for the allowance, its eligibility and rates unknown", async () => {
    const { NotComputableVisual, byId } = await load();
    const { container } = render(<NotComputableVisual measure={byId.additional_cost_allowance} />);
    const [today, proposed] = container.querySelectorAll(".mnc-card");
    expect(today).toHaveTextContent("TodayPIPEligibilityRates");
    expect(today.querySelectorAll(".mnc-chip.is-unknown")).toHaveLength(0);
    expect(proposed).toHaveClass("is-unknown");
    expect(proposed).toHaveTextContent("ProposedAdditional Cost AllowanceNot means-tested");
    expect([...proposed.querySelectorAll(".mnc-chip.is-unknown")].map((chip) => chip.textContent)).toEqual(["Eligibility", "Rates"]);
    expect(container.querySelector(".mnc-swap > .mnc-arrow")).not.toBeNull();
  });

  it("duty to engage: met or refused, the lost allowance in the loss colour, marked behavioural", async () => {
    const { NotComputableVisual, byId } = await load();
    const { container } = render(<NotComputableVisual measure={byId.youth_conditionality} />);
    expect(container.querySelector(".mnc-trunk").textContent).toBe("A claimantDuty to engage");
    const branches = [...container.querySelectorAll(".mnc-branch")];
    expect(branches.map((branch) => branch.textContent)).toEqual(["MetAllowance continues", "RefusedAllowance lost"]);
    expect(branches[1]).toHaveClass("is-loss");
    expect(container.querySelector(".mnc-marker")).toHaveTextContent("Behavioural, not modelled");
    expect(screen.getByRole("img")).toHaveAccessibleName(/not modelled\.$/);
  });

  it("hiring payments: a split on six months out of work or study, the hiring response not modelled", async () => {
    const { NotComputableVisual, byId } = await load();
    const { container } = render(<NotComputableVisual measure={byId.employer_hiring_payments} />);
    expect(container.querySelector(".mnc-trunk").textContent).toBe("An employer hires a young personSix months out of work or study");
    const branches = [...container.querySelectorAll(".mnc-branch")];
    expect(branches.map((branch) => branch.textContent)).toEqual(["NoNo payment", "YesHiring payment"]);
    expect(branches[1]).toHaveClass("is-gain");
    expect(container.querySelector(".mnc-marker")).toHaveTextContent("Hiring response, not modelled");
  });

  it("Opportunity Guarantee: three offers, then today's guarantee and the wider one, not to scale", async () => {
    const { NotComputableVisual, byId } = await load();
    const { container } = render(<NotComputableVisual measure={byId.opportunity_guarantee} />);
    expect([...container.querySelectorAll(".mnc-tiles .mnc-node")].map((tile) => tile.textContent)).toEqual([
      "A job",
      "Education or training",
      "A placement or civic service",
    ]);
    expect(container.querySelector(".mnc-places").textContent).toBe("Youth Guarantee todayWider, and in law");
    expect(container.querySelector(".mnc-scale")).toHaveTextContent("Not to scale");
  });

  it("apprenticeships and further education: what each adds, over today's and more, not to scale", async () => {
    const { NotComputableVisual, byId } = await load();
    const { container, unmount } = render(<NotComputableVisual measure={byId.apprenticeship_target} />);
    expect([...container.querySelectorAll(".mnc-tiles .mnc-node")].map((tile) => tile.textContent)).toEqual(["Pre-apprenticeships", "Apprenticeships"]);
    expect(container.querySelector(".mnc-places").textContent).toBe("Starts todayMore starts");
    unmount();
    const further = render(<NotComputableVisual measure={byId.further_education_places} />);
    expect(further.container.querySelector(".mnc-places").textContent).toBe("Learners todayMore learners");
  });

  it("each card keeps its Who and Kind facts, and badges why it is not modelled", async () => {
    const { NOT_COMPUTABLE_MEASURES } = await load();
    const { default: NotComputableMeasures } = await import("../milburn/NotComputableMeasures");
    const { WHY_NOT_MODELLED } = await import("../PolicyCards");
    const { container } = render(<NotComputableMeasures measures={NOT_COMPUTABLE_MEASURES} />);
    const cards = [...container.querySelectorAll(".policy-card")];
    expect(cards).toHaveLength(NOT_COMPUTABLE_MEASURES.length);
    cards.forEach((card, index) => {
      const measure = NOT_COMPUTABLE_MEASURES[index];
      expect(card.querySelector(".mnc[role=img]"), measure.id).not.toBeNull();
      expect(card.querySelector(".policy-card-points").textContent, measure.id).toBe(`Who${measure.affects}Kind${measure.kind}`);
      const why = card.querySelector(".policy-card-why");
      expect(why.querySelector(".policy-card-example-title svg"), measure.id).not.toBeNull();
      expect(why.textContent, measure.id).toBe(`${WHY_NOT_MODELLED}${measure.notModelled}`);
    });
  });
});
