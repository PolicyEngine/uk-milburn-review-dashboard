import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SourceChip, { AGE_HOUSEHOLD_NOTE, SourceLinkChip, chipSource, distinctSources, shortDate, shortSource } from "./SourceChip";

describe("SourceChip", () => {
  it("marks a PolicyEngine estimate with an icon", () => {
    const { container } = render(<SourceChip />);
    expect(container.textContent).toBe("PolicyEngine estimate");
    expect(container.querySelector(".source-chip.is-estimate svg")).not.toBeNull();
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

  it("shortens a source and its date for a chip", () => {
    expect(chipSource("From a Welfare State to a Working State: analytical annex")).toBe("Review, annex");
    expect(chipSource("From a Welfare State to a Working State: data tables")).toBe("Review, data tables");
    expect(chipSource("From a Welfare State to a Working State")).toBe("Review");
    expect(chipSource("Office for National Statistics")).toBe("ONS");
    expect(shortDate("17 November 2026")).toBe("17 Nov 2026");
    expect(shortDate("April to June 2026")).toBe("April to June 2026");
    expect(shortDate("")).toBe("");
  });

  it("gives a published figure's source as one chip-link with its date, the full title as the tooltip", () => {
    const source = "From a Welfare State to a Working State: analytical annex";
    const { rerender, container } = render(<SourceLinkChip source={source} url="https://example.org/annex" date="17 November 2026" />);
    const link = screen.getByRole("link", { name: /^Review, annex · 17 Nov 2026/ });
    expect(link).toHaveAttribute("href", "https://example.org/annex");
    expect(link).toHaveAttribute("title", source);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    // No link without a URL; nothing with neither source nor date
    rerender(<SourceLinkChip source="Resolution Foundation" date="13 November 2026" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.textContent).toBe("Resolution Foundation · 13 Nov 2026");
    rerender(<SourceLinkChip />);
    expect(container).toBeEmptyDOMElement();
  });

  it("says why ages no measure targets change (for Methodology)", () => {
    expect(AGE_HOUSEHOLD_NOTE).toBe("Other ages change only because they share a household with someone in the targeted ages.");
  });
});
