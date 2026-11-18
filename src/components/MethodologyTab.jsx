import { useEffect } from "react";
import { AGE_HOUSEHOLD_NOTE } from "./milburn/SourceChip";
import FactList from "./methodology/FactList";
import MethodGlossary from "./methodology/MethodGlossary";
import SectionHeading from "./SectionHeading";
import { METHOD_ANCHORS } from "./methodology/anchors";
import MethodContents, { revealAnchor } from "./methodology/MethodContents";
import { unavailableMeasures } from "./methodology/measures";
import { AGE_BANDS, MIN_SAMPLE_SIZE } from "../utils/ageImpact";
import { useMeasureCatalogue } from "../utils/measureCatalogue";
import { OPEN_VIEW_EVENT } from "../utils/methodLink";
import { AnchorLink, ExternalLink, ReasonList, SourceLink, Topic } from "./methodology/MethodUi";
import { glossaryAnchor } from "./methodology/glossary";
import { Calculator, ChartColumn, Compass, Database, Info, SlidersHorizontal } from "lucide-react";
import "./methodology/Methodology.css";
import { scrollBelowBars, smoothUnlessReduced } from "../utils/pageScroll";
import { POVERTY_FIGURES_SHOWN, WITHHELD_SENTENCE } from "../utils/povertyFigures";
import { MICROCOSM_BUILD, POLICYENGINE_UK_VERSION, POLICYENGINE_VERSION, REPLICATION_LINE } from "./ReplicationLine";
import { groupMilburnMeasures } from "../utils/milburn/measureGroups";
import { NOT_COMPUTABLE_MEASURES } from "../utils/milburn/notComputable";
import { FINAL_REPORT, REPORT_PUBLISHED, reportCopy } from "../utils/milburn/reportStatus";
import { WITHHELD_LABEL, WITHHELD_METHOD } from "../utils/withheld";
import { INDICATIVE_GAP_NOTE, TOLERANCE_RULE } from "../utils/milburn/benchmarks";

/** The policyengine-core version this build runs, beside policyengine-uk. */
export const POLICYENGINE_CORE_VERSION = "3.34.10";
/** The Microcosm UK build's full name. */
export const MICROCOSM_BUILD_NAME = `uk-frs-calibration-attempt-20261115T104657Z-${MICROCOSM_BUILD}`;

/**
 * The ids of the Methodology view's sections and of the topics other
 * views link to (the age cards to `young`), so a
 * key's id must not change.
 */
export const METHOD_SECTIONS = {
  overview: "method-overview",
  data: "method-data",
  model: "method-model",
  population: "method-population",
  young: "method-young",
  scenarios: "method-scenarios",
  limitations: "method-limitations",
};

/**
 * The sections in the contents, in page order: `icon` for the contents
 * list, `titleIcon` (TitleIcon) for the section's heading.
 */
export const METHOD_CONTENTS = [
  { id: METHOD_SECTIONS.overview, title: "At a glance", icon: Compass, titleIcon: "compass" },
  { id: METHOD_SECTIONS.data, title: "Data", icon: Database, titleIcon: "database" },
  { id: METHOD_SECTIONS.model, title: "Model and measures", icon: Calculator, titleIcon: "calculator" },
  { id: METHOD_SECTIONS.population, title: "Impact", icon: ChartColumn, titleIcon: "bars" },
  { id: METHOD_SECTIONS.scenarios, title: "Moves into work and benchmarks", icon: SlidersHorizontal, titleIcon: "sliders" },
  { id: METHOD_SECTIONS.limitations, title: "Limitations", icon: Info, titleIcon: "book" },
];

const SECTION_ICONS = Object.fromEntries(METHOD_CONTENTS.map(({ id, titleIcon }) => [id, titleIcon]));

/** The final report and its analytical annex, cited by paragraph or section. */
const ReportLink = ({ children = "report" }) => <ExternalLink href={FINAL_REPORT.reportUrl}>{children}</ExternalLink>;
const AnnexLink = ({ children = "analytical annex" }) => <ExternalLink href={FINAL_REPORT.annexUrl}>{children}</ExternalLink>;

/**
 * What the final report proposes on benefits and employer costs, one line
 * each, in its own terms (executive summary, paragraphs 50, 51, 101, 102
 * and 107; chapter 6, paragraphs 745 to 760).
 */
export const REPORT_PROPOSALS = [
  "A single Youth Allowance at the under-25 rate of Universal Credit, higher for young people living independently.",
  "The Universal Credit health element and the Work Capability Assessment abolished for under-25s.",
  "An Additional Cost Allowance in place of PIP, for extra costs that are significant, established and ongoing.",
  "A local Health and Disability Fund for extra costs that are immediate, one-off or may change.",
  "Severe and Complex Needs Insurance, paid above today’s maximum benefit rates, for the few unlikely ever to work.",
  "A work allowance for everyone on the Youth Allowance who works, and a duty to engage, with loss of the allowance as a last resort.",
  "Child Disability Living Allowance extended from age 16 to 18.",
  "The employer National Insurance threshold raised from £5,000 to £10,000 for 21 to 24-year-olds in retail and hospitality, over five years, when fiscal conditions allow.",
  "Opportunity and Support Guarantees through a Youth Opportunity Service, including a £3,000 payment to employers who hire a young person out of work and education for six months.",
];

/**
 * Which of those the page models, and how closely. Worded by kind, not by
 * run: the runs published are listed under "Measures modelled".
 */
export const REPORT_MODELLED = [
  "Modelled: the health element removed for under-25s and PIP removed for 18 to 24-year-olds, each alone and together, from April 2029; and the £10,000 employer National Insurance threshold for 21 to 24-year-olds in retail and hospitality, at its end state.",
  "Modelled with stated assumptions: the higher Youth Allowance for young people living independently, at the 25-and-over rate for under-25 claims with a housing costs element (the review’s own proxy, analytical annex, section 8); the benefit changes phased in, with people turning 18 moved at once and an assumed 45% of the remaining claimants each year; the threshold raised in assumed equal steps from £6,000 in 2027-28 to £10,000 in 2031-32; and the Youth Allowance’s work allowance, for which the report gives no amount, at the current Universal Credit work allowance.",
  "Illustrative runs: the £10,000 employer National Insurance threshold for 21 to 24-year-olds in every sector, the widest reading of the report’s suggestion to consider extending it to other sectors, “focusing on those with the biggest potential” (paragraph 270), £0.91bn in 2029-30; and the Youth Allowance’s work allowance at 15 hours a week at the minimum wage (paragraph 749, “10 or 15 hours”), £0.88bn, which also raises existing statutory work allowances, so it is not a pure sensitivity on the amount.",
  "Comparators, from April 2027: PIP at half rate, a stand-in for the Additional Cost Allowance, for which the report gives no rates; and no employer National Insurance for any under-25, an option the report considers and does not propose (paragraph 268).",
  "Not modelled: the Additional Cost Allowance itself, the Health and Disability Fund, Severe and Complex Needs Insurance, the duty to engage and the Guarantees. Not computable: child Disability Living Allowance kept to 18, since DLA and PIP pay the same amounts, but some who lose an award at sixteen would keep DLA longer and the data cannot identify them (paragraph 759); income protection during serious illness (paragraphs 716, 746 and 782); civic service (paragraph 684); the Flexible Jobs Scheme and supported paid jobs (paragraphs 689, 690 and 780); and start-up support (chapter 6.4).",
];

/**
 * The limits of the figures against the report's design, once it is
 * published: its replacements, its Youth Allowance and employer relief,
 * its timing and where it applies.
 */
const REPORT_DESIGN_LIMITATIONS = [
  ["Replacements not modelled", "The report proposes replacing PIP for young people with an Additional Cost Allowance for ongoing costs and a local Health and Disability Fund for one-off or changing costs, and adding Severe and Complex Needs Insurance. Our runs of the report’s benefit changes include none of them, so their losses are an upper bound. The comparator with PIP at half rate stands in for the Additional Cost Allowance."],
  ["Youth Allowance", "The report proposes a Youth Allowance at the under-25 rate, higher for those living independently, and a work allowance. It gives no amount for the higher rate or the work allowance. The base rate leaves awards unchanged. Our run of the higher rate pays the 25-and-over rate to claims in which every adult is under 25 and that include a housing costs element, the review’s own proxy for living independently (analytical annex, section 8). An illustrative run gives every under-25 claim the current Universal Credit work allowance, the lower rate with a housing costs element and the higher without: our assumption. Two combined runs, our designs, simulate the higher rate and the work allowance together, and both with the health element and PIP removal. A sensitivity sets the work allowance at 15 hours a week at the minimum wage, the upper end of paragraph 749’s “10 or 15 hours”; it also raises existing statutory work allowances."],
  ["Employer National Insurance", "The report proposes raising the employer threshold from £5,000 to £10,000 for 21 to 24-year-olds in retail and hospitality over five years, when fiscal conditions allow. It gives no start date, yearly steps or costing. One run shows the £10,000 end state in every year; another assumes equal steps from £6,000 in 2027-28 to £10,000 in 2031-32. An illustrative run applies the £10,000 threshold to 21 to 24-year-olds in every sector, an upper bound on extending it (paragraph 270). The comparator removes employer National Insurance for all under-25s on earnings up to £50,270, which is wider."],
  ["Timing", "The report’s benefit changes apply from April 2029, the first year of the report’s welfare savings; the comparators apply from April 2027. The report proposes moving new claims first and existing claimants at their scheduled reassessment, within five years (paragraph 773). Our main runs apply each change to everyone at once; the phased run moves people turning 18 at once and an assumed 45% of the remaining claimants each year, about 95% within five years."],
  ["Geography", "Unless a measure says otherwise, our figures apply it across the UK, including Scotland, where Adult Disability Payment has replaced PIP, and Northern Ireland, which runs its own social security system. The report’s welfare estimates also cover PIP and Universal Credit across the UK, but its support costs cover Great Britain and its delivery proposals are most specific to England."],
];

/**
 * The limits of the figures, said once: the model is static, and the data
 * have gaps that bear on young people. The last two are the report-status
 * switch's words (utils/milburn/reportStatus.js). Once the report is
 * published, the limit on replacements gives way to the limits against
 * the report's design.
 */
export const milburnLimitations = (published = REPORT_PUBLISHED) => [
  ["Static", "The main figures hold behaviour fixed: nobody changes their work, hours, claims or education because of a measure. The Moves into work (illustrative) sub-tab shows the package with a move into work separately."],
  ["No NEET variable", "The data have no variable for being not in education, employment or training (NEET), so no figure here is for NEETs as such."],
  ["PIP in Scotland", "Adult Disability Payment records in Scotland are held as PIP in the data, so PIP figures for Scotland use ADP records."],
  ["New-claimant health element rate", "Which Universal Credit health element rate a new claimant receives is assigned by a random draw that does not depend on age. New claimants since April 2026 receive the lower health element (£217.26 a month, £2,607 a year) rather than £442.10 a month, so removing it takes less from them."],
  ["Few young claimant households", "The results rest on about 130 to 170 survey households with young claimants (the health element and PIP removal changes 658 households in the data, drawn from 171 survey households; the health element removal alone 468 from 127, and the PIP removal alone 629 from 156), so the pattern across individual income deciles and single years of age is noisy; national totals are steadier than any one decile or age."],
  ["Overlapping losses", "In the data 90.6% of 16 to 24-year-olds with limited capability for work and work-related activity (LCWRA) also get PIP, against 62.5% in the Resolution Foundation's figures, so removing both payments concentrates the losses on the same young people. A different overlap would change how many people lose income and how much they lose."],
  ["Carer's Allowance and PIP", "Removing PIP changes, besides PIP itself, chiefly Universal Credit amounts that depend on it in the model, such as the disabled child element, entitlement while in education and the exemption from the shared accommodation rate. For 18 to 24-year-olds in 2029-30 that is about £3.09bn of PIP and about £0.56bn of these knock-on effects. Carer's Allowance and the Universal Credit carer element do not change: in policyengine-uk 2.177.7 a carer's entitlement is not linked to the PIP of the person cared for, whom the model takes to qualify. In reality a carer whose entitlement rests on that person's PIP daily living award could lose it, so carers' losses are not shown and the saving may be understated."],
  ["Caseloads against published counts", "On build fcfac709 the number of Universal Credit households with the LCWRA element, all ages, is a calibration target and sits 1.5% above DWP's figure, but LCWRA by age is not: the data hold about a third more people aged 16 to 24 receiving the health element than the Resolution Foundation counts (233,000 in Great Britain in 2025, against 176,000), as claimants added by the take-up draw carry LCWRA where they receive PIP. PIP at ages 16 to 24 in England and Wales matches DWP's 2025 count (407,000). Within England the model counts too many recipients aged 16 to 19 (17.6% above DWP's count) and too few aged 20 to 24 (15.9% below). The proposal starts at 18. On an uncertified build that corrects this split, the 18 to 24 PIP caseload is about 3.4% higher and the package saving about 2.5% higher (a sensitivity, not our figures). Across ages 16 to 24 the young average award is lower than the published figures (about £8,000 a year, against £8,400), so young PIP spending is about 14% below the review's. The data also hold about 10% fewer payroll employees aged 18 to 24 than HMRC's count. Caseloads in later years grow with population only."],
  ...(published
    ? REPORT_DESIGN_LIMITATIONS
    : [["No replacement in the upper bound", "The full abolition package (upper bound) includes no replacement fund, cost allowance or insurance payment. The central variant stands in for a smaller allowance with PIP at half rate."]]),
  ["Small samples at 16 and 17", "Few survey households include people aged 16 or 17, so figures for those ages rest on small samples."],
  ["Not computable", reportCopy(published).notComputableLimit],
  [reportCopy(published).policyLimitTerm, reportCopy(published).policyLimit],
];

/** The limits in the switch's own state. */
export const MILBURN_LIMITATIONS = milburnLimitations();

/**
 * A section of the view, laid out as the other views' sections are: a
 * heading with its icon and a one-line summary, then its topics, each
 * folded until asked for.
 */
function MethodSection({ id, title, summary, lead = null, children }) {
  return (
    <section id={id} className="method-section" aria-label={title}>
      <SectionHeading id={`${id}-heading`} icon={SECTION_ICONS[id]} title={title} subtitle={summary} />
      {lead}
      {children && <div className="card method-card method-topics">{children}</div>}
    </section>
  );
}

/** A link to another view (at one of its sub-tabs), switched to in place. */
function ViewLink({ tab, sub, age, hash, onShowTab, className, children }) {
  return (
    <a
      className={className}
      href={`?tab=${tab}${sub ? `&sub=${sub}` : ""}${age ? `&age=${age}` : ""}${hash ? `#${hash}` : ""}`}
      onClick={(event) => {
        event.preventDefault();
        if (sub && age) onShowTab(tab, sub, { age });
        else if (sub) onShowTab(tab, sub);
        else onShowTab(tab);
        if (hash) {
          setTimeout(() => {
            scrollBelowBars(document.getElementById(hash), { behavior: smoothUnlessReduced() });
          }, 50);
        }
      }}
    >
      {children}
    </a>
  );
}

/** A shared term, linked to its definition under "Terms the charts use". */
const Term = ({ id, children }) => <AnchorLink id={glossaryAnchor(id)}>{children}</AnchorLink>;

/**
 * Opened at an anchor (a link from another view, an address with a hash,
 * or a changed hash): open the topic it is folded in and bring it into
 * view. Looks for up to 3 seconds.
 */
function useRevealLinkedAnchor() {
  useEffect(() => {
    let timer = 0;
    const reveal = (id) => {
      clearTimeout(timer);
      let tries = 0;
      const attempt = () => {
        if (revealAnchor(id, { smooth: false })) return;
        if ((tries += 1) < 30) timer = setTimeout(attempt, 100);
      };
      timer = setTimeout(attempt, 150);
    };
    const hash = window.location.hash.slice(1);
    if (hash) reveal(decodeURIComponent(hash));
    const onOpenView = (event) => {
      const { tab, anchor } = event.detail || {};
      if (tab === "methodology" && anchor) reveal(anchor);
    };
    const onHashChange = () => {
      const id = window.location.hash.slice(1);
      if (id) reveal(decodeURIComponent(id));
    };
    window.addEventListener(OPEN_VIEW_EVENT, onOpenView);
    window.addEventListener("hashchange", onHashChange);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(OPEN_VIEW_EVENT, onOpenView);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);
}

/**
 * The Methodology view: how the other views' figures are made, with a
 * contents list beside it. The measure descriptions stay on Policies.
 *
 * @param {Object} props
 * @param {(tab: string, sub?: string) => void} props.onShowTab - Switch to another view (at a sub-tab)
 * @param {boolean} [props.published] - Whether the final report is published (the report-status switch's state unless given)
 */
function MethodologyTab({ onShowTab, published = REPORT_PUBLISHED }) {
  // The words that depend on the final report (utils/milburn/reportStatus.js)
  const copy = reportCopy(published);
  const limitations = milburnLimitations(published);
  const catalogue = useMeasureCatalogue();
  const UNAVAILABLE = unavailableMeasures(catalogue);
  // The measures the page offers, as the Measures tab and the selector group
  // them: a hidden run (one that only feeds another tab) is not counted
  const modelled = groupMilburnMeasures(catalogue.measures ?? []).flatMap((group) =>
    group.measures.map((measure) => ({ id: measure.id, name: measure.name })),
  );
  useRevealLinkedAnchor();
  // No manifest yet: the catalogue is still loading, so no count ("0 published")
  const catalogueLoading = !catalogue.manifest;

  return (
    <div className="methodology-tab">
      <MethodContents sections={METHOD_CONTENTS} />

      <div className="method-body">
        <MethodSection
          id={METHOD_SECTIONS.overview}
          title="At a glance"
          summary={
            <>
              We run <SourceLink id="policyengine_uk_model">PolicyEngine UK</SourceLink>{" "}{copy.methodSummary}
            </>
          }
        >
          <Topic id="method-about-review" title="The review and these measures" preview={copy.reviewTopicPreview}>
            {published && (
              <>
                <p className="method-more">
                  <ExternalLink href={FINAL_REPORT.url}>{FINAL_REPORT.title}</ExternalLink>, the final report of the
                  independent review of young people and work led by Alan Milburn, was published by the{" "}
                  {FINAL_REPORT.publisher} on {FINAL_REPORT.date}. The interim report was published on 28 May 2026.
                </p>
                <p className="method-lead">
                  What the <ReportLink />{" "}
                  proposes on benefits and employer costs (paragraphs 50, 51, 101 to 107, 270 and 745 to 760):
                </p>
                <ul className="method-list" data-report-proposals="">
                  {REPORT_PROPOSALS.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <p className="method-lead">What this page models:</p>
                <ul className="method-list" data-report-modelled="">
                  {REPORT_MODELLED.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </>
            )}
            {copy.reviewTopicBody.map((paragraph) => (
              <p key={paragraph} className="method-more">{paragraph}</p>
            ))}
          </Topic>
          <Topic
            id={METHOD_ANCHORS.glossary}
            title="Terms the charts use"
            preview="Net income, housing costs, deciles, poverty, Gini and other terms, one line each"
          >
            <MethodGlossary />
          </Topic>
        </MethodSection>

        <MethodSection
          id={METHOD_SECTIONS.data}
          title="Data"
          summary={
            <>
              Households from the <SourceLink id="frs_2024_25">Family Resources Survey 2024-25</SourceLink>, in
              Microcosm UK build {MICROCOSM_BUILD}.
            </>
          }
        >
          <Topic title="The dataset" preview="Build · Survey · Weights · Small groups">
            <FactList
              items={[
                [
                  "Build",
                  <>
                    Microcosm UK 2024-25, build <code>{MICROCOSM_BUILD_NAME}</code>, certified in policyengine{" "}
                    {POLICYENGINE_VERSION}, whose bundle pins it with policyengine-uk {POLICYENGINE_UK_VERSION}.
                  </>,
                ],
                [
                  "Survey",
                  <>
                    The <SourceLink id="frs_2024_25">Family Resources Survey 2024-25</SourceLink>, with records
                    built from each survey household (<SourceLink id="microcosm_site">Microcosm</SourceLink>).
                  </>,
                ],
                ["Weights", "Calibrated so the records add up to UK totals of population, incomes and benefit receipt."],
                [
                  "Small groups",
                  `A group with fewer than ${MIN_SAMPLE_SIZE} records is not shown; ages 16 and 17 rest on few survey households.`,
                ],
                ["Withheld figures", `${WITHHELD_METHOD} The page marks each one “${WITHHELD_LABEL}”.`],
              ]}
            />
          </Topic>
        </MethodSection>

        <MethodSection
          id={METHOD_SECTIONS.model}
          title="Model and measures"
          summary={
            <>
              policyengine-uk {POLICYENGINE_UK_VERSION} (certified in policyengine {POLICYENGINE_VERSION}) and policyengine-core{" "}
              {POLICYENGINE_CORE_VERSION}, run directly on that build.
            </>
          }
        >
          <Topic title="How each measure is modelled" preview="Static · Against current law · Each measure and the package">
            <FactList
              items={[
                [
                  "Static",
                  <>
                    Estimates are <Term id="static">static</Term>: no behavioural response in the main figures.
                    Nobody changes their work, hours or claims because of a measure.
                  </>,
                ],
                [
                  "Against current law",
                  <>
                    Each measure changes the model&apos;s rules, and we compare household{" "}
                    <Term id="netIncome">net income</Term> and the public finances with and without it.
                  </>,
                ],
                [
                  "Each measure and the package",
                  "Each measure is run on its own. The package runs two together, removing the UC health element under 25 and PIP for 18 to 24-year-olds, so its figures include their interaction.",
                ],
                [
                  "Cash terms",
                  <>
                    Figures are in <Term id="real">cash terms</Term> for the year shown.
                  </>,
                ],
              ]}
            />
          </Topic>
          <Topic title="Measures modelled" preview={catalogueLoading ? "Loading…" : `${modelled.length} published`}>
            {catalogueLoading ? (
              <p className="method-more" role="status">
                Loading the measures…
              </p>
            ) : modelled.length ? (
              <ul className="method-list">
                {modelled.map((measure) => (
                  <li key={measure.id}>{measure.name}</li>
                ))}
              </ul>
            ) : (
              <p className="method-more">No measure&apos;s results are published yet.</p>
            )}
            {UNAVAILABLE.length > 0 && <ReasonList items={UNAVAILABLE} />}
          </Topic>
          <Topic id="method-not-computable" title="Measures we cannot compute" preview={`${NOT_COMPUTABLE_MEASURES.length} measures, with the reason`}>
            <ReasonList items={NOT_COMPUTABLE_MEASURES.map((measure) => ({ name: measure.name, why: measure.notModelled }))} icon />
          </Topic>
        </MethodSection>

        <MethodSection
          id={METHOD_SECTIONS.population}
          title="Impact"
          summary="How the national results are calculated: the public finances, poverty and age."
        >
          <Topic id={METHOD_ANCHORS.publicFinances} title="Public finances" preview="Net effect on revenue and spending, by year">
            <p className="method-more">
              The change in government revenue less the change in spending on benefits, from the static model, by
              fiscal year. A positive figure is a saving to the Exchequer.{" "}
              {published ? (
                <>
                  The review&apos;s <AnnexLink />{" "}
                  (section 1) estimates welfare savings of £3.6 billion in 2036-37, in 2026-27 prices, for its whole benefit design, with replacements and an employment effect; that is not comparable
                  with these static figures.
                </>
              ) : (
                "There is no official costing to compare with."
              )}
            </p>
          </Topic>
          <Topic id={METHOD_ANCHORS.poverty} title="Poverty and inequality" preview="Absolute and relative poverty · Gini">
            {POVERTY_FIGURES_SHOWN ? (
              <p className="method-more">
                The change in the share of people in relative poverty (below 60% of median income in the same year) and
                in <Term id="absolutePoverty">absolute poverty</Term>, each before and after housing costs, on the HBAI
                measure, and the change in the <Term id="gini">Gini coefficient</Term>{" "}
                of equivalised household net income. Every poverty figure names its measure; where there is a choice,
                absolute poverty before housing costs, for all people, is shown first. The relative line is 60% of the median, which
                itself moves with these measures; the absolute line is fixed in real terms.
              </p>
            ) : (
              <p className="method-more">{WITHHELD_SENTENCE}</p>
            )}
          </Topic>
          <Topic id={METHOD_SECTIONS.young} title="Results by age" preview="Age bands · Who counts · Young people">
            <p className="method-more">
              The{" "}
              <ViewLink tab="dashboard" sub="age" age="16-24" hash="young-people" onShowTab={onShowTab}>
                Young people
              </ViewLink>{" "}
              sub-tab opens on people aged 16 to 24, the ONS definition of young people.
            </p>
            <FactList
              items={[
                [
                  "Age bands",
                  AGE_BANDS.filter((band) => band.label !== "All ages")
                    .map((band) => band.label)
                    .join(", ")
                    .replace(/, ([^,]*)$/, " and $1"),
                ],
                [
                  "Who counts",
                  <>
                    Each person counts their whole household&apos;s change in net income, and averages are{" "}
                    <Term id="perPerson">per person</Term>. A person counts as worse off when their household&apos;s
                    net income falls by more than 0.01%.
                  </>,
                ],
                ["Other ages", AGE_HOUSEHOLD_NOTE],
                [
                  "Under 25",
                  "The health element measure applies to people under 25, the PIP measure to those aged 18 to 24 and the employer National Insurance threshold to those aged 21 to 24; the 16 to 24 band covers all three.",
                ],
              ]}
            />
          </Topic>
        </MethodSection>

        <MethodSection
          id={METHOD_SECTIONS.scenarios}
          title="Moves into work and benchmarks"
          summary="The package with an assumed phased move into work, and published figures to set the results beside."
        >
          <Topic id="method-behavioural-scenarios" title="Moves into work (illustrative)" preview="A phased share moving into work · Entry cases · Break-even">
            <FactList
              items={[
                [
                  "How the figures are made",
                  "The report's two benefit changes from April 2029 (the static package), and the same package with everyone in the group moving into work, are run once each. Each path's figures are the static figure plus the year's share times the difference between the two runs: the expected value over who moves, not a simulation of particular people. That holds for totals and counts (the Exchequer, absolute poverty, people in losing households). A check, a random 25% of the with-PIP group and the other 75% run separately, tests that the parts add up to the whole: they do, to rounding, for the Exchequer, absolute poverty and the losing households. Relative poverty after housing costs missed by up to 9% of the change, as its line moves with the median, so it is not shown. The rollout path, on the phased package, is not checked itself.",
                ],
                [
                  "Who moves",
                  "Non-working 18 to 24-year-olds whose Universal Credit health element the package removes: the assessed claimant with limited capability for work and work-related activity, in a claim where no claimant keeps the element, with no employment or self-employment income. Each moves into 16 hours a week at the minimum wage for their age, our assumption: the review assumes a mix of full-time and part-time work and publishes no hours or wage. 16 and 17-year-olds lose the element too but do not move. The with-PIP path adds non-working 18 to 24-year-olds who lose PIP. Nobody else changes behaviour.",
                ],
                [
                  "Why this path",
                  <>
                    An assumption, not an estimate of how people respond. Its level is the 9% employment effect the <AnnexLink />{" "}
                    assumes for Universal Credit
                    health claimants (section 1), read here as 9 percentage points; the annex does not say whether it is points or per cent, and the figures scale
                    with it. The annex gives the 9% no time path. The phased path takes its timing from the review&apos;s NEET path (data tables, table 3), counted
                    from 2028-29, the year before the benefit changes start: none before April 2029, then 1.3% in 2029-30, 2.8% in 2030-31 and 4.4% in 2031-32,
                    about half way to the 9% it reaches in 2036-37. That pairing is ours: the NEET path reflects the review&apos;s whole package, and the review
                    phases its welfare savings by when claimants are reassessed. Table 3 is rounded to one decimal place, so the 2029-30 share could be between
                    about 0.9% and 1.6%. Not counted from 2028-29, the same timing gives 2.3%, 3.7% and 5.1%. The flat path applies 9% from 2029-30; the rollout
                    path applies 9% to those the phased package has reached (new 18-year-olds at once, existing claimants at an assumed 45% a year). The
                    review&apos;s 9% sits in a scenario with replacement awards, which the package here does not model.
                  </>,
                ],
                ...(published
                  ? [
                      [
                        "The review’s own figure",
                        <>
                          The review&apos;s modelling puts around 440,000 more young people in sustained work by 2036 (<ReportLink />, paragraph 111). In its{" "}
                          <AnnexLink />{" "}
                          that is the employment effect of the whole package of recommendations, including the benefit changes, employment support,
                          the guarantees and education measures, and it counts effects beyond age 24 (section 8); section 2 gives around 400,000 more 16 to
                          24-year-olds in work in 2036. The review gives no figure for the benefit changes on their own, so this scenario does not use it.
                        </>,
                      ],
                    ]
                  : []),
                [
                  "Entry cases",
                  "One young person moving into work for 16 or 25 hours a week at a given wage: their household's gain and the saving to the Exchequer, from household calculations.",
                ],
                [
                  "Break-even",
                  "The entrants whose gains from work would add up to the Exchequer saving (standing for the total income loss), and those entrants as a share of the young people in losing households. One entrant's gain comes from the household entry case, where it is the same under current law and under the package.",
                ],
              ]}
            />
          </Topic>
          <Topic id="method-benchmarks" title="Benchmarks" preview="Published figures · Sources · PolicyEngine estimates beside them">
            <p className="method-more">
              Published figures from the review, the ONS, DWP, HMRC, the Resolution Foundation and the IFS, each with its
              basis, source and date. Where PolicyEngine has a figure for the same ages, area, year and measure, as far
              as the published figure states them (build fcfac709 for 2025, money in cash terms), it sits beside it with the gap to the nearest whole per cent and a
              line on why the two differ; a pair that still differs in date or area says so and gives no gap.{" "}
              {INDICATIVE_GAP_NOTE} {TOLERANCE_RULE} Our savings from the
              measures are shown apart, never against published spending, and the review&rsquo;s own estimates, which
              include replacement awards and employment effects, have no PolicyEngine figure beside them.
            </p>
          </Topic>
        </MethodSection>

        <MethodSection
          id={METHOD_SECTIONS.limitations}
          title="Limitations"
          summary="What the figures leave out, and where the data are thin."
        >
          <Topic title="Limits of these figures" preview={limitations.map(([term]) => term).join(" · ")}>
            <FactList items={limitations} />
          </Topic>
          <Topic id="method-replication" title="Reproducing the figures" preview="Model · Data · Versions">
            <p className="method-more">
              {REPLICATION_LINE}; policyengine-core {POLICYENGINE_CORE_VERSION}. The model is open source:{" "}
              <ExternalLink href={`https://pypi.org/project/policyengine-uk/${POLICYENGINE_UK_VERSION}/`}>
                policyengine-uk {POLICYENGINE_UK_VERSION}
              </ExternalLink>
              .
            </p>
          </Topic>
        </MethodSection>
      </div>
    </div>
  );
}

export default MethodologyTab;
