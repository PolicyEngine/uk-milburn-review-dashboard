import { useEffect, useMemo, useRef } from "react";
import SectionHeading from "./SectionHeading";
import { MeasureKeyProvider } from "./MeasureKey";
import TrendCard from "./youngPeople/TrendCard";
import MeasuresCard from "./youngPeople/MeasuresCard";
import AgeChangeCard from "./age/AgeChangeCard";
import NeetBreakdown from "./milburn/NeetBreakdown";
import { SharesCard, YOUNG_PEOPLE_ANCHOR, useAgeImpactRows } from "./YoungPeopleSection";
import { useNarrowViewport } from "../utils/chartTheme";
import { isCatalogueRowDisplayable, useMeasureCatalogue } from "../utils/measureCatalogue";
import { groupSubject } from "../utils/ageGroups";
import { YOUNG_BAND } from "../utils/ageImpact";
import "./YoungPeopleSection.css";
import { scrollBelowBars } from "../utils/pageScroll";
import { POVERTY_FIGURES_SHOWN } from "../utils/povertyFigures";

/**
 * Impact's Young people sub-tab (?sub=age): every card is about 16 to
 * 24-year-olds, whom the policies target, with all ages as the overall
 * reference where a card has it; no other age group is shown (Vahid, 18
 * Nov: they move only because each person carries their household's
 * change). An old link's ?age= is left in the address and not read. The
 * cards: average change by single year of age (16 to 24), change by year,
 * the effect of each policy against all ages, and the shares who gain and
 * lose (gains and losses).
 * The shares are people affected, so they are left out while those figures
 * are withheld (povertyFigures.js); the effect of each policy stays.
 */
export default function AgeSection({ selectedPolicies, selectedYear, policies }) {
  const narrow = useNarrowViewport();
  const catalogue = useMeasureCatalogue();
  const { status, rows: publishedRows } = useAgeImpactRows(catalogue);
  const { combinedId } = catalogue;
  const rows = useMemo(
    () => publishedRows?.filter((row) => isCatalogueRowDisplayable(catalogue, row.reform_id, row.year)) ?? null,
    [publishedRows, catalogue],
  );
  const group = YOUNG_BAND;

  // A link to #young-people: the section renders after the page's data
  // loads, too late for the browser's own jump
  const scrolled = useRef(false);
  useEffect(() => {
    if (status !== "ready" || scrolled.current || typeof window === "undefined") return;
    scrolled.current = true;
    const hash = window.location.hash.slice(1);
    if (hash === YOUNG_PEOPLE_ANCHOR) scrollBelowBars(document.getElementById(hash));
  }, [status]);

  if (status !== "ready") {
    return (
      <p className="view-status" role="status">
        {status === "loading" ? "Loading results by age…" : "Results by age are not available."}
      </p>
    );
  }
  const props = { rows, policies, selectedPolicies, selectedYear, narrow, combinedId, catalogue, group };
  const subject = groupSubject(group);
  return (
    <>
      {/* The old sub-tabs' anchors, so their links still land here */}
      <span id={YOUNG_PEOPLE_ANCHOR} aria-hidden="true" />
      <MeasureKeyProvider>
        <SectionHeading
          icon="usersRound"
          title="How 16 to 24-year-olds' incomes change"
          subtitle="The average change for 16 to 24-year-olds, this year and over time."
        />
        <section className="report-section young-people-section" aria-label="How 16 to 24-year-olds' incomes change">
          {/* The shared key is in Average change by age's legend row
              (keyInLegend), level with Change by year's line chips */}
          <div className="charts-grid">
            <AgeChangeCard {...props} keyInLegend height={narrow ? 360 : 400} />
            <TrendCard {...props} height={narrow ? 340 : 400} />
          </div>
        </section>
      </MeasureKeyProvider>
      <NeetBreakdown selectedPolicies={selectedPolicies} selectedYear={selectedYear} />
      {POVERTY_FIGURES_SHOWN ? (
        <>
          <SectionHeading
            id="age-who-gains"
            icon="userPlus"
            // One policy at a time, never stacked: no "which policies drive
            // them" (María, #6 item 4)
            title="Gains and losses"
            subtitle={`How much ${subject.toLowerCase()} gain or lose on average, and how many, with the selected policy.`}
          />
          <section className="report-section young-people-section" aria-label="Gains and losses">
            <div className="charts-grid">
              {/* 16 to 24 against all ages */}
              <MeasuresCard {...props} height={narrow ? 460 : 400} />
              <SharesCard {...props} height={narrow ? 340 : 400} />
            </div>
          </section>
        </>
      ) : (
        <>
          <SectionHeading
            id="age-who-gains"
            icon="userPlus"
            title="Effect of the selected policy"
            subtitle={`The average change from the selected policy for ${subject.toLowerCase()}.`}
          />
          <section className="report-section young-people-section" aria-label="Effect of the selected policy">
            <div className="charts-grid">
              {/* 16 to 24 against all ages */}
              <MeasuresCard {...props} height={narrow ? 460 : 400} />
            </div>
          </section>
        </>
      )}
    </>
  );
}
