import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SourceChip, { AGE_HOUSEHOLD_NOTE, AgeHouseholdNote, CHARTS_ARE_ESTIMATES, ChartsSourceNote, distinctSources, shortSource } from "./SourceChip";

describe("SourceChip", () => {
  it("marks a PolicyEngine estimate, one or several, with an icon", () => {
    const { container, rerender } = render(<SourceChip />);
    expect(container.textContent).toBe("PolicyEngine estimate");
    expect(container.querySelector(".source-chip.is-estimate svg")).not.toBeNull();
    rerender(<SourceChip plural />);
    expect(container.textContent).toBe("PolicyEngine estimates");
  });

  it("marks a published figure with its source", () => {
    const { container } = render(<SourceChip kind="published" source="the review" />);
    expect(container.textContent).toBe("Published: the review");
    expect(container.querySelector(".source-chip.is-published svg")).not.toBeNull();
    expect(container.querySelector("[data-source-kind]").dataset.sourceKind).toBe("published");
  });

  it("names publishers briefly, each once, in the order met", () => {
    expect(shortSource("From a Welfare State to a Working State: analytical annex")).toBe("the review");
    expect(shortSource("Office for National Statistics")).toBe("ONS");
    expect(shortSource("Institute for Fiscal Studies")).toBe("IFS");
    expect(shortSource("Resolution Foundation")).toBe("Resolution Foundation");
    expect(
      distinctSources(["From a Welfare State to a Working State", "Resolution Foundation", "From a Welfare State to a Working State: data tables", "", "Office for National Statistics"]),
    ).toEqual(["the review", "Resolution Foundation", "ONS"]);
  });

  it("says in one line that a sub-tab's charts are PolicyEngine estimates", () => {
    render(<ChartsSourceNote />);
    expect(screen.getByRole("note").textContent).toBe(`PolicyEngine estimates${CHARTS_ARE_ESTIMATES}`);
    expect(CHARTS_ARE_ESTIMATES).toBe("Charts show PolicyEngine estimates (static microsimulation, certified data).");
  });

  it("says why ages no measure targets change", () => {
    const { container } = render(<AgeHouseholdNote />);
    expect(container.textContent).toBe(AGE_HOUSEHOLD_NOTE);
    expect(AGE_HOUSEHOLD_NOTE).toBe("Only people in the targeted ages lose the benefit; other ages change because they share a household with someone who does.");
  });
});
