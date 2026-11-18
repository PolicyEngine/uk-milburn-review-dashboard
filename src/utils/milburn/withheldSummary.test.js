import { describe, expect, it } from "vitest";
import { keyFigureTiles } from "../../components/milburn/KeyFigures";
import { notYetStarted, parseSummaryRun } from "./summary";

// The disclosure floor's nulls in milburn_summary.json are withheld, never
// left out silently; a report run's zeros before April 2029 say it starts then
describe("withheld and not-yet-started figures", () => {
  it("shows a withheld average and poverty count as withheld", () => {
    const run = parseSummaryRun({
      id: "milburn_report_uc_health",
      saving_bn: { 2029: 1.128 },
      young_people_in_losing_households: 403968,
      average_loss_young_person_in_losing_household: null,
      average_loss_basis: "not available: withheld under the disclosure floor",
      people_into_poverty_abs_bhc: null,
      poverty_change_pp: { abs_bhc: null },
    });
    const tiles = keyFigureTiles(run, 2029, { keys: ["loss", "poverty-abs"] });
    expect(tiles.map((tile) => [tile.key, tile.value])).toEqual([["loss", "Withheld"], ["poverty-abs", "Withheld"]]);
    expect(tiles[0].definition).toBe("Withheld to protect survey households.");
  });

  it("says a report run starts in April 2029 before then, and never calls its missing average withheld", () => {
    const run = parseSummaryRun({
      id: "milburn_report_uc_health",
      saving_bn: { 2027: 0 },
      young_people_in_losing_households: 0,
      average_loss_young_person_in_losing_household: null,
      average_loss_basis: "not available: too few survey records in losing households",
      people_into_poverty_abs_bhc: 0,
    });
    expect(notYetStarted(run, 2027)).toBe(true);
    expect(keyFigureTiles(run, 2027, { keys: ["loss", "poverty-abs"] }).map((tile) => [tile.key, tile.value])).toEqual([["poverty-abs", "Starts April 2029"]]);
  });
});
