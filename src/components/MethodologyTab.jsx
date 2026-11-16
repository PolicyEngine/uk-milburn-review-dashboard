import { useEffect } from "react";
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
import { MICROCOSM_BUILD, POLICYENGINE_UK_VERSION, REPLICATION_LINE } from "./ReplicationLine";
import { groupMilburnMeasures } from "../utils/milburn/measureGroups";
import { ENTRY_ASSUMPTION_TEXT } from "../utils/milburn/summary";
import { NOT_COMPUTABLE_MEASURES } from "../utils/milburn/notComputable";

/** The policyengine-core version this build runs, beside policyengine-uk. */
export const POLICYENGINE_CORE_VERSION = "3.34.10";
/** The Microcosm UK build's full name. */
export const MICROCOSM_BUILD_NAME = `uk-frs-calibration-attempt-20261112T133744Z-${MICROCOSM_BUILD}`;

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
  { id: METHOD_SECTIONS.scenarios, title: "Return to work and benchmarks", icon: SlidersHorizontal, titleIcon: "sliders" },
  { id: METHOD_SECTIONS.limitations, title: "Limitations", icon: Info, titleIcon: "book" },
];

const SECTION_ICONS = Object.fromEntries(METHOD_CONTENTS.map(({ id, titleIcon }) => [id, titleIcon]));

/**
 * The limits of the figures, said once: the model is static, and the data
 * have gaps that bear on young people.
 */
export const MILBURN_LIMITATIONS = [
  ["Static", "The main figures hold behaviour fixed: nobody changes their work, hours, claims or education because of a measure. The Return to work sub-tab shows the package with a move into work separately."],
  ["No NEET variable", "The data have no variable for being not in education, employment or training (NEET), so no figure here is for NEETs as such."],
  ["PIP in Scotland", "Adult Disability Payment records in Scotland are held as PIP in the data, so PIP figures for Scotland use ADP records."],
  ["New-claimant health element rate", "Which Universal Credit health element rate a new claimant receives is assigned by a random draw that does not depend on age. New claimants since April 2026 receive the lower health element (£217.26 a month, £2,607 a year) rather than £442.10 a month, so removing it takes less from them."],
  ["Few young claimant records", "The results rest on roughly 500 to 650 survey records of young claimants, so the pattern across individual income deciles and single years of age is noisy; national totals are steadier than any one decile or age."],
  ["Overlapping losses", "About nine in ten young claimants with limited capability for work and work-related activity (LCWRA) in the data also get PIP, so the package stacks both losses on largely the same people. Per-person losses are an upper bound and headcounts a lower bound."],
  ["Caseloads against DWP", "The all-age LCWRA stock in the data is about 23% above DWP's figure. The PIP caseload aged 18 to 24 is low but its award mix is high (more enhanced awards), which roughly offsets in cost."],
  ["No replacement in the upper bound", "The full abolition package (upper bound) includes no replacement fund, cost allowance or insurance payment. The central variant stands in for a smaller allowance with PIP at half rate."],
  ["Small samples at 16 and 17", "Few survey households include people aged 16 or 17, so figures for those ages rest on small samples."],
  ["Not computable", "Some candidate measures cannot be computed with these data and this model; they are listed with the reason, and never shown as £0."],
  ["Not announced policy", "The measures are candidates modelled before the review's final report. They may differ from anything the review recommends or the government adopts."],
];

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
 */
function MethodologyTab({ onShowTab }) {
  const catalogue = useMeasureCatalogue();
  const UNAVAILABLE = unavailableMeasures(catalogue);
  // The measures the page offers, as the Measures tab and the selector group
  // them: a hidden run (one that only feeds another tab) is not counted
  const modelled = groupMilburnMeasures(catalogue.measures ?? []).flatMap((group) =>
    group.measures.map((measure) => ({ id: measure.id, name: measure.name })),
  );
  useRevealLinkedAnchor();

  return (
    <div className="methodology-tab">
      <MethodContents sections={METHOD_CONTENTS} />

      <div className="method-body">
        <MethodSection
          id={METHOD_SECTIONS.overview}
          title="At a glance"
          summary={
            <>
              We run <SourceLink id="policyengine_uk_model">PolicyEngine UK</SourceLink>{" "}on a
              survey of UK households with and without each candidate measure for the Milburn review of
              young people and work; weights scale the survey to the UK. The figures are static.
            </>
          }
        >
          <Topic id="method-about-review" title="The review and these measures" preview="Candidates · Not announced policy · Final report 17 November 2026">
            <p className="method-more">
              The independent review of young people and work published an interim report on 28 May 2026; its
              final report is expected on Tuesday 17 November 2026. The measures here are candidates drawn from
              public discussion of the review, modelled before it is published. They are not announced policy,
              and the review may recommend something different.
            </p>
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
                    Microcosm UK 2024-25, build <code>{MICROCOSM_BUILD_NAME}</code>, loaded directly: it is not in
                    a policyengine.py release, so no release certifies it.
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
              ]}
            />
          </Topic>
        </MethodSection>

        <MethodSection
          id={METHOD_SECTIONS.model}
          title="Model and measures"
          summary={
            <>
              policyengine-uk {POLICYENGINE_UK_VERSION} and policyengine-core {POLICYENGINE_CORE_VERSION}, run
              directly on that build: {REPLICATION_LINE}.
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
          <Topic title="Measures modelled" preview={`${modelled.length} published`}>
            {modelled.length ? (
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
              fiscal year. A positive figure is a gain to the Exchequer. There is no official costing to compare
              with.
            </p>
          </Topic>
          <Topic id={METHOD_ANCHORS.poverty} title="Poverty and inequality" preview="Absolute and relative poverty · Gini">
            {POVERTY_FIGURES_SHOWN ? (
              <p className="method-more">
                The change in the share of people in relative poverty (below 60% of median income in the same year) and
                in <Term id="absolutePoverty">absolute poverty</Term>, each before and after housing costs, on the HBAI
                measure, and the change in the <Term id="gini">Gini coefficient</Term>{" "}
                of equivalised household net income. Every poverty figure names its measure; where there is a choice,
                absolute poverty after housing costs is shown first. The relative line is 60% of the median, which
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
                [
                  "Under 25",
                  "Most measures apply to people under 25, and the PIP measure to those aged 18 to 24; the 16 to 24 band covers both.",
                ],
              ]}
            />
          </Topic>
        </MethodSection>

        <MethodSection
          id={METHOD_SECTIONS.scenarios}
          title="Return to work and benchmarks"
          summary="The package with a move into work, microsimulated, and published figures to set the results beside."
        >
          <Topic id="method-behavioural-scenarios" title="Return to work" preview="Microsimulated move into work · Entry cases · Break-even">
            <FactList
              items={[
                [
                  "Microsimulated",
                  `The full abolition package is run again with ${ENTRY_ASSUMPTION_TEXT}, chosen at random, and set beside the static package: the saving, poverty and average loss.`,
                ],
                [
                  "Entry cases",
                  "One young person moving into work for 16 or 25 hours a week at a given wage: their household's gain and the gain to the Exchequer, from household calculations.",
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
              Published figures from the ONS, DWP, the Resolution Foundation and the IFS, each with its basis, source
              and date. Where PolicyEngine has a comparable figure, it sits beside it, labelled with its build and
              year; the two can count different groups or areas, so the estimate is context, not a check.
            </p>
          </Topic>
        </MethodSection>

        <MethodSection
          id={METHOD_SECTIONS.limitations}
          title="Limitations"
          summary="What the figures leave out, and where the data are thin."
        >
          <Topic title="Limits of these figures" preview={MILBURN_LIMITATIONS.map(([term]) => term).join(" · ")}>
            <FactList items={MILBURN_LIMITATIONS} />
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
