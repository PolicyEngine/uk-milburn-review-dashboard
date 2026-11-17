import { describe, expect, it, vi } from "vitest";
import { checkHouseholdApiEnv, householdApiUrlProblem } from "../../scripts/household-api-env.mjs";

const HOUSEHOLD =
  "https://policyengine--uk-milburn-household-web.us-east.modal.run/api/household-impact";

describe("householdApiUrlProblem", () => {
  it("accepts the service URL followed by /api/household-impact", () => {
    for (const env of [
      { NEXT_PUBLIC_HOUSEHOLD_API_URL: HOUSEHOLD, VERCEL_ENV: "production" },
      { NEXT_PUBLIC_HOUSEHOLD_API_URL: "http://localhost:5001/api/household-impact" },
    ]) {
      expect(householdApiUrlProblem(env)).toBeNull();
    }
  });

  it("refuses any other form in every build", () => {
    for (const url of [
      "https://policyengine--uk-milburn-household-web.us-east.modal.run",
      "https://policyengine--uk-milburn-household-web.us-east.modal.run/api/personal-impact",
      `${HOUSEHOLD}/`,
      `${HOUSEHOLD}?x=1`,
      "uk-milburn-household/api/household-impact",
    ]) {
      for (const extra of [{}, { VERCEL_ENV: "preview" }, { NEXT_PUBLIC_MOCK: "1" }]) {
        const problem = householdApiUrlProblem({ NEXT_PUBLIC_HOUSEHOLD_API_URL: url, ...extra });
        expect(problem?.level, url).toBe("error");
        expect(problem.message).toContain("/api/household-impact");
      }
    }
  });

  it("only warns without it, production included: the tab shows its stored examples", () => {
    expect(
      householdApiUrlProblem({ VERCEL_ENV: "production", NEXT_PUBLIC_HOUSEHOLD_API_URL: " " })?.level,
    ).toBe("warning");
    expect(householdApiUrlProblem({ VERCEL_ENV: "production" }).message).toContain("stored examples only");
    for (const env of [
      {},
      { VERCEL_ENV: "production" },
      { VERCEL_ENV: "preview" },
      { VERCEL_ENV: "development" },
      { VERCEL_ENV: "production", NEXT_PUBLIC_MOCK: "1" },
      { CI: "true" },
    ]) {
      expect(householdApiUrlProblem(env)?.level).toBe("warning");
    }
  });
});

describe("checkHouseholdApiEnv", () => {
  it("throws on an error and warns otherwise; a production build passes without it", () => {
    const log = { warn: vi.fn() };
    expect(() => checkHouseholdApiEnv({ NEXT_PUBLIC_HOUSEHOLD_API_URL: `${HOUSEHOLD}/` }, log)).toThrow(/\/api\/household-impact/);
    expect(() => checkHouseholdApiEnv({ VERCEL_ENV: "production" }, log)).not.toThrow();
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn.mock.calls[0][0]).toMatch(/NEXT_PUBLIC_HOUSEHOLD_API_URL is not set/);
    checkHouseholdApiEnv({ NEXT_PUBLIC_HOUSEHOLD_API_URL: HOUSEHOLD }, log);
    expect(log.warn).toHaveBeenCalledTimes(1);
  });

  it("ignores the retired lifecycle URL", () => {
    const log = { warn: vi.fn() };
    checkHouseholdApiEnv(
      {
        VERCEL_ENV: "production",
        NEXT_PUBLIC_LIFECYCLE_API_URL: "https://example.test/api/lifecycle",
      },
      log,
    );
    expect(log.warn.mock.calls[0][0]).toMatch(/NEXT_PUBLIC_HOUSEHOLD_API_URL is not set/);
  });
});
