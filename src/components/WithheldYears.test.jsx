import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { WithheldYears } from "./SummaryMetricChart";
import { CHART_COLOURS } from "../utils/chartTheme";

// jsdom gives ResponsiveContainer no size, so the plot's marks are tested
// with a band scale of their own
const scale = (year) => ({ 2027: 0, 2028: 100, 2029: 200 })[year];
scale.bandwidth = () => 80;
const axes = { xAxisMap: { 0: { scale } }, yAxisMap: { 0: { y: 10, height: 200 } } };

describe("WithheldYears", () => {
  it("marks each withheld year's slot with a muted band and Withheld, in the colour tokens", () => {
    const { container } = render(<svg><WithheldYears {...axes} years={[2028, 2029]} /></svg>);
    const rects = [...container.querySelectorAll("rect")];
    expect(rects.map((rect) => rect.getAttribute("x"))).toEqual(["100", "200"]);
    expect(rects.every((rect) => rect.getAttribute("fill") === CHART_COLOURS.mutedFill)).toBe(true);
    expect([...container.querySelectorAll("text")].map((text) => text.textContent)).toEqual(["Withheld", "Withheld"]);
  });

  it("draws nothing without withheld years", () => {
    const { container } = render(<svg><WithheldYears {...axes} years={[]} /></svg>);
    expect(container.querySelector("rect")).toBeNull();
  });
});
