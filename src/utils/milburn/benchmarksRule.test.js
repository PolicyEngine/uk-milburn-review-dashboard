import { describe, expect, it } from "vitest";
import { TOLERANCE, TOLERANCE_RULE, moreInfo } from "./benchmarks";

describe("the 15% tolerance rule and unpaired figures", () => {
  it("names the rule as official counts with the same ages, area and period", () => {
    expect(TOLERANCE_RULE).toMatch(/official count with the same ages, area and period/);
    // Another model's estimate stays untested under it
    expect(TOLERANCE.employer_nics_under_25.untested).toMatch(/not an official count/);
  });

  it("says in the NEET card's More info why it has no PolicyEngine figure", () => {
    const info = moreInfo({ id: "neet_16_24", value: "13.0%", basis: "Labour Force Survey" });
    expect(info.lead.title).toBe("Why no PolicyEngine figure");
    expect(info.lead.body).toMatch(/income-based/);
  });
});
