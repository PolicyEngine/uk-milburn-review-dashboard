import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ViewSkeleton, { BootSkeleton, SKELETON_SUB_TABS, SKELETON_VIEWS } from "./ViewSkeleton";
import { POPULATION_SUB_TABS } from "../PopulationImpactView";

describe("a view's loading placeholder", () => {
  it("draws the views' sub-tabs as their real rows do", () => {
    expect(SKELETON_SUB_TABS.dashboard).toEqual(POPULATION_SUB_TABS);
    expect(SKELETON_SUB_TABS.outlook).toBeUndefined();
  });

  it("shows the view's heading, its sub-tab chosen and a loading caption, never a number", () => {
    const { container } = render(<ViewSkeleton view="dashboard:all" />);
    expect(screen.getByRole("heading", { name: "By area" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading results…");
    expect(container.querySelector('.sub-tab[aria-selected="true"]')).toHaveTextContent("All households");
    expect(container.textContent).not.toMatch(/£|\d/);
    expect(container.textContent).not.toMatch(/approved for publication/);
  });

  // Population impact, the only view with sub-tabs, is the first tab: its
  // placeholder's sub-tab row starts with About alone, at the left, and the
  // copy of the bar keeps every tab, the later ones in its tail
  it("starts the sub-tab row at the left under the first tab, with the later tabs in a tail", () => {
    const viewTabs = [
      { value: "dashboard", label: "Population impact" },
      { value: "household", label: "Household calculator" },
      { value: "policies", label: "Policies" },
      { value: "methodology", label: "Methodology" },
    ];
    const labels = (node) => [...node.querySelectorAll(".view-tab-label")].map((label) => label.textContent);
    const first = render(<ViewSkeleton view="dashboard:age" viewTabs={viewTabs} />).container;
    expect(labels(first.querySelector(".skeleton-tab-lead"))).toEqual(["About"]);
    const row = first.querySelector(".boot-view-tabs .view-tabs");
    expect(row).toHaveClass("is-at-start");
    expect(labels(row)).toEqual(viewTabs.map(({ label }) => label));
    expect(first.querySelector(".skeleton-sub-tabs")).toHaveClass("has-tab-lead", "is-at-start");
    expect(first.querySelector('.sub-tab[aria-selected="true"]')).toHaveTextContent("Young people");
  });

  it("draws the new sub-tabs' placeholders without a number", () => {
    for (const view of ["dashboard:scenarios", "dashboard:benchmarks"]) {
      const { container, unmount } = render(<ViewSkeleton view={view} />);
      expect(container.textContent).not.toMatch(/£|\d/);
      unmount();
    }
  });

  it("puts every view's placeholder in the server's HTML, one per address", () => {
    const html = renderToString(<BootSkeleton />);
    for (const view of SKELETON_VIEWS) expect(html).toContain(`data-boot-variant="${view}"`);
    expect(html).toContain("Choose a household");
  });
});
