import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { policyVisual } from "./PolicyVisual";
import { PolicyCard } from "../PolicyCards";
import { MILBURN_POLICY_DETAILS } from "../../utils/policyDetails";
import { MILBURN_GROUPS } from "../../utils/milburn/measureGroups";
import { MILBURN_PHASING, MILBURN_RATES, milburnVisualView, phasedShare, weeklyToMonthly } from "../../utils/milburn/measureVisuals";

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

  it("phased package: the published 36%, 60% and 93%, from the pipeline's rule", () => {
    show("milburn_package_phased");
    expect(image()).toHaveAccessibleName(/about 36% in 2027-28, about 60% in 2028-29, about 76% in 2029-30, about 86% in 2030-31, about 93% in 2031-32/);
    expect(MILBURN_PHASING.reassessedEachYear).toBe(0.25);
    expect(phasedShare(2026).total).toBe(0);
    expect(phasedShare(2033).total).toBe(1);
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

it("the measures we cannot compute: a picture in words, never a figure", async () => {
  const { NOT_COMPUTABLE_MEASURES } = await import("../../utils/milburn/notComputable");
  const { UNMODELLED_VISUAL_KINDS } = await import("./UnmodelledVisual");
  for (const measure of NOT_COMPUTABLE_MEASURES) {
    expect(Object.keys(UNMODELLED_VISUAL_KINDS), measure.id).toContain(measure.visual.kind);
    expect(JSON.stringify(measure.visual), measure.id).not.toMatch(/[£%\d]/);
  }
});
