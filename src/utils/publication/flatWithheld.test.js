import { describe, expect, it } from "vitest";
import { FLAT_WITHHELD_NULLABLE, TABLES, parseFlatTable } from "./csv";


const ageHeader = [...TABLES.age_impact.columns.map(([c]) => c), "mean_change_worse_off", "mean_change_better_off"].join(",");

describe("flat tables' withheld cells (3-survey-household floor)", () => {
  it("reads an empty age cell as null, not zero", () => {
    const text = `${ageHeader}\nr,R,2029,16-24,1000.0,500,,-7.0,,5.0,,0.0,-200.0,\n`;
    const [row] = parseFlatTable("age_impact", text);
    expect(row.mean_change).toBeNull();
    expect(row.pct_better_off).toBeNull();
    expect(row.pct_unchanged).toBeNull();
    expect(row.pct_worse_off).toBe(5);
    expect(row.mean_change_worse_off).toBe(-200);
  });

  it("still refuses an empty identifying or count cell", () => {
    const text = `${ageHeader}\nr,R,2029,16-24,1000.0,,1,-7.0,0,5.0,95,0.0,,\n`;
    expect(() => parseFlatTable("age_impact", text)).toThrow();
  });

  it("lets every poverty change in metrics be withheld", () => {
    expect(FLAT_WITHHELD_NULLABLE.metrics).toEqual(
      expect.arrayContaining(["poverty_change_pp", "poverty_rel_ahc_change_pp", "child_poverty_rel_bhc_change_pct"]),
    );
    expect(FLAT_WITHHELD_NULLABLE.metrics).not.toContain("people_affected");
    expect(FLAT_WITHHELD_NULLABLE.metrics).not.toContain("gini_change");
  });
});
