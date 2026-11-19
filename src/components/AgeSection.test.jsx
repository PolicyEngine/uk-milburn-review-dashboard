import { describe, expect, it } from "vitest";
import { ageGroupFrom, ageWindow, groupAges, groupSubject, AGE_GROUP_OPTIONS } from "../utils/ageGroups";
import { oldAgeSubGroup } from "../App";

describe("By age's age groups", () => {
  it("offers 16 to 24, 25 to 34 and all ages, and reads ?age= with 16 to 24 as the default", () => {
    expect(AGE_GROUP_OPTIONS.map((group) => group.key)).toEqual(["16-24", "25-34", "all"]);
    // Pensioners and the other bands are no longer offered: their links open the default
    expect(ageGroupFrom("pensioners")).toBe("16-24");
    expect(ageGroupFrom("50-64")).toBe("16-24");
    expect(ageGroupFrom("nonsense")).toBe("16-24");
    expect(ageGroupFrom(null)).toBe("16-24");
  });

  it("names each group as a sentence's subject", () => {
    expect(groupSubject("16-24")).toBe("16 to 24-year-olds");
    expect(groupSubject("0-15")).toBe("Under-16s");
    expect(groupSubject("65+")).toBe("People aged 65 and over");
    expect(groupSubject("pensioners")).toBe("Pensioners");
  });

  it("gives each group its ages, and the single-year chart only those ages", () => {
    expect(groupAges("16-24", 2027)).toEqual([16, 24]);
    expect(groupAges("pensioners", 2026)).toEqual([66, 90]);
    expect(groupAges("pensioners", 2027)).toEqual([67, 90]);
    expect(ageWindow("16-24", 2027)).toEqual([16, 24]);
    expect(ageWindow("pensioners", 2027)).toEqual([67, 90]);
    expect(ageWindow("65+", 2027)).toEqual([65, 90]);
    expect(ageWindow("all", 2027)).toEqual([0, 90]);
  });

  it("turns the old Young people and Pensioners sub-tab links into By age with the group chosen", () => {
    expect(oldAgeSubGroup({ search: "?sub=young" })).toBe("16-24");
    expect(oldAgeSubGroup({ search: "?tab=dashboard&sub=pensioners" })).toBe("pensioners");
    expect(oldAgeSubGroup({ search: "?sub=age" })).toBeNull();
  });
});

describe("Young people has no age group choice (Vahid, 18 Nov)", async () => {
  const { vi } = await import("vitest");
  const { fireEvent, render, screen, within } = await import("@testing-library/react");
  vi.mock("./YoungPeopleSection", async (original) => ({
    ...(await original()),
    useAgeImpactRows: () => ({ status: "ready", rows: [] }),
  }));
  vi.mock("recharts", async () => {
    const actual = await vi.importActual("recharts");
    return { ...actual, ResponsiveContainer: ({ children }) => <div style={{ width: 800, height: 400 }}>{children}</div> };
  });

  it("offers no age group in any card's Options, and leaves an old ?age= unread", async () => {
    const { default: AgeSection } = await import("./AgeSection");
    window.history.replaceState({}, "", "/?sub=age&age=25-34");
    render(<AgeSection selectedPolicies={[]} selectedYear={2027} policies={[]} />);
    expect(screen.getByRole("heading", { name: "How 16 to 24-year-olds' incomes change" })).toBeInTheDocument();
    for (const pill of screen.queryAllByRole("button", { name: /^Options:/ })) {
      // The view "16 to 24 and all ages" names what is shown, not a choice of group
      expect(pill.getAttribute("aria-label").replace("16 to 24 and all ages", "")).not.toMatch(/16 to 24|25 to 34|All ages/);
      fireEvent.click(pill);
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).queryByRole("radio", { name: /^(16 to 24|25 to 34|50 to 64|All ages|Pensioners|Every age group|Age groups)$/ })).toBeNull();
      fireEvent.keyDown(dialog, { key: "Escape" });
    }
    expect(document.body.textContent).not.toMatch(/25 to 34/);
    expect(new URLSearchParams(window.location.search).get("age")).toBe("25-34");
  });
});
