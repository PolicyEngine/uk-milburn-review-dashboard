import { describe, expect, it } from "vitest";
import { REPLICATION_LINE, replicationLinks } from "./ReplicationLine";

describe("Reproduce these results", () => {
  it("names the data build, the model and the policyengine.py release that certifies them", () => {
    expect(REPLICATION_LINE).toBe("Microcosm UK build fcfac709, policyengine-uk 2.177.7, certified in policyengine 6.20.1");
    expect(replicationLinks().map(({ label, href }) => [label, href])).toEqual([
      ["Microcosm UK build fcfac709", null],
      ["policyengine-uk 2.177.7", "https://pypi.org/project/policyengine-uk/2.177.7/"],
      ["policyengine 6.20.1", "https://pypi.org/project/policyengine/6.20.1/"],
    ]);
  });
});

describe("the build's versions, said once", () => {
  it("are in About this dashboard's Built with: no line at the foot of every tab", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const src = join(fileURLToPath(import.meta.url), "..", "..");
    expect(readFileSync(join(src, "App.jsx"), "utf8")).not.toMatch(/<ReplicationLine/);
    expect(readFileSync(join(src, "components", "OverviewDrawer.jsx"), "utf8")).toMatch(/replicationLinks\(/);
  });
});
