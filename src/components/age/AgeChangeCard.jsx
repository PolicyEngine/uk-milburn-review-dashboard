import { useState } from "react";
import SingleAgeCard, { everySingleAgeWithheld } from "./SingleAgeCard";
import { MeanChangeCard } from "../YoungPeopleSection";
import { YOUNG_BAND, isShownGroup, meanChangeByBand } from "../../utils/ageImpact";
import { selectionPackageKey } from "../../utils/geography/selection";

/**
 * Whether By age falls back to the 16 to 24 band: every single age from 16
 * to 24 is withheld (a package withholds what its members withhold, #347)
 * while the band is published. Where the band is withheld too, the
 * single-age view's own "Not shown" message stays.
 */
export function bandsFallback({ catalogue, rows, policies, selectedPolicies, selectedYear, group = YOUNG_BAND }) {
  // The single ages fall back only when they have nothing to draw: no net
  // and no policy's own part (By policy draws the parts with no net)
  if (!everySingleAgeWithheld({ catalogue, rows, policies, selectedPolicies, selectedYear, group, noParts: true })) return false;
  const packageRun = selectionPackageKey(catalogue?.manifest, selectedPolicies);
  // The band's net, or a selected policy's own published part (drawn with
  // no net where another is withheld: show everything that is published)
  const keys = (policies ?? [])
    .filter((policy) => selectedPolicies.includes(policy.id))
    .map((policy) => policy.seriesKey ?? `measure:${policy.id}`);
  const drawn = (value) => value !== null && value !== undefined;
  return meanChangeByBand(rows, policies, selectedPolicies, selectedYear, packageRun).some(
    (point) =>
      isShownGroup(point.band) &&
      !point.combinationUnavailable &&
      (drawn(point.netChange) || keys.some((key) => Number.isFinite(point[key]))),
  );
}

/**
 * Young people's "Average change by age": 16 to 24-year-olds by single
 * year of age (Vahid, 18 Nov: no other age group is shown), with each
 * measure stacked as an option. When every single age from 16 to 24 is
 * withheld but the band is published, the band's own bar is shown instead,
 * with no note on the card; Policies there opens on By policy.
 */
export default function AgeChangeCard({ extraOptions = [], ...props }) {
  const group = YOUNG_BAND;
  props = { ...props, group };
  // Held here, so the reader's Policies choice survives a switch of view
  const [packageView, setPackageView] = useState("policy");
  return bandsFallback(props) ? (
    <MeanChangeCard {...props} bandsOnly extraOptions={extraOptions} defaultPackageView="policy" packageView={packageView} onPackageViewChange={setPackageView} />
  ) : (
    <SingleAgeCard {...props} title="Average change by age" extraOptions={extraOptions} />
  );
}
