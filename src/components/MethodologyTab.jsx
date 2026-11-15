import { useEffect } from "react";
import GeographyMethodology from "./GeographyMethodology";
import FactList from "./methodology/FactList";
import MethodGlossary from "./methodology/MethodGlossary";
import SectionHeading from "./SectionHeading";
import { HIGHEST_PERCENTILE, LOWEST_PERCENTILE, ordinal } from "../utils/incomePosition";
import { METHOD_ANCHORS } from "./methodology/anchors";
import { SINGLE_YEAR_METHOD } from "../utils/singleYear";
import MethodContents, { revealAnchor } from "./methodology/MethodContents";
import { unavailableMeasures } from "./methodology/measures";
import { AGE_BANDS, MIN_SAMPLE_SIZE } from "../utils/ageImpact";
import { useMeasureCatalogue } from "../utils/measureCatalogue";
import { OPEN_VIEW_EVENT } from "../utils/methodLink";
import { AnchorLink, ExternalLink, ReasonList, SourceLink, Topic } from "./methodology/MethodUi";
import { glossaryAnchor } from "./methodology/glossary";
import { Calculator, ChartColumn, Compass, Database, House, Info, SlidersHorizontal } from "lucide-react";
import "./methodology/Methodology.css";
import { scrollBelowBars, smoothUnlessReduced } from "../utils/pageScroll";
import { POVERTY_FIGURES_SHOWN, WITHHELD_SENTENCE } from "../utils/povertyFigures";
import { MICROCOSM_BUILD, POLICYENGINE_UK_VERSION, REPLICATION_LINE } from "./ReplicationLine";
import { NOT_COMPUTABLE_MEASURES } from "../utils/milburn/notComputable";

/** The policyengine-core version this build runs, beside policyengine-uk. */
export const POLICYENGINE_CORE_VERSION = "3.34.10";
/** The Microcosm UK build's full name. */
export const MICROCOSM_BUILD_NAME = `uk-frs-calibration-attempt-20261112T133744Z-${MICROCOSM_BUILD}`;

/**
 * The ids of the Methodology view's sections and of the topics other
 * views link to (the map to `geography`, the age cards to `young`), so a
 * key's id must not change.
 */
export const METHOD_SECTIONS = {
  overview: "method-overview",
  data: "method-data",
  model: "method-model",
  population: "method-population",
  geography: "method-area",
  young: "method-young",
  scenarios: "method-scenarios",
  personal: "method-personal",
  singleYear: "method-single-year",
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
  { id: METHOD_SECTIONS.population, title: "Population impact", icon: ChartColumn, titleIcon: "bars" },
  { id: METHOD_SECTIONS.scenarios, title: "Scenarios and benchmarks", icon: SlidersHorizontal, titleIcon: "sliders" },
  { id: METHOD_SECTIONS.personal, title: "Household calculator", icon: House, titleIcon: "house" },
  { id: METHOD_SECTIONS.limitations, title: "Limitations", icon: Info, titleIcon: "book" },
];

const SECTION_ICONS = Object.fromEntries(METHOD_CONTENTS.map(({ id, titleIcon }) => [id, titleIcon]));

/**
 * The limits of the figures, said once: the model is static, and the data
 * have gaps that bear on young people.
 */
export const MILBURN_LIMITATIONS = [
  ["Static", "The main figures hold behaviour fixed: nobody changes their work, hours, claims or education because of a measure. The Behavioural scenarios tab shows illustrative second-round effects separately."],
  ["No NEET variable", "The data have no variable for being not in education, employment or training (NEET), so no figure here is for NEETs as such."],
  ["PIP in Scotland", "Adult Disability Payment records in Scotland are held as PIP in the data, so PIP figures for Scotland use ADP records."],
  ["New-claimant health element rate", "Which Universal Credit health element rate a new claimant receives is assigned by a random draw that does not depend on age."],
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
  const modelled = (catalogue.measures ?? []).map((measure) => ({ id: measure.id, name: measure.name }));
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
          title="Population impact"
          summary="How the national results are calculated: the public finances, incomes, poverty, area and age."
        >
          <Topic id={METHOD_ANCHORS.publicFinances} title="Public finances" preview="Net effect on revenue and spending, by year">
            <p className="method-more">
              The change in government revenue less the change in spending on benefits, from the static model, by
              fiscal year. A positive figure is a gain to the Exchequer. There is no official costing to compare
              with.
            </p>
          </Topic>
          <Topic id={METHOD_ANCHORS.byIncome} title="By income decile" preview="Deciles · Average change">
            <p className="method-more">
              Households are ranked by baseline <Term id="equivalised">equivalised</Term> household net income{" "}
              <Term id="housingCosts">before housing costs</Term> (the <SourceLink id="dwp_hbai">HBAI</SourceLink>{" "}
              measure) and split into ten groups of equal population.
            </p>
          </Topic>
          <Topic id={METHOD_ANCHORS.poverty} title="Poverty and inequality" preview="Absolute and relative poverty · Gini">
            {POVERTY_FIGURES_SHOWN ? (
              <p className="method-more">
                The change in the share of people in <Term id="absolutePoverty">absolute poverty</Term>, before and
                after housing costs, on the HBAI measure, and the change in the{" "}
                <Term id="gini">Gini coefficient</Term> of equivalised household net income.
              </p>
            ) : (
              <p className="method-more">{WITHHELD_SENTENCE}</p>
            )}
          </Topic>
          <Topic id={METHOD_ANCHORS.scatter} title="Household scatter" preview="Groups of households by income and change">
            <p className="method-more">
              Each dot is a group of survey households with similar incomes and changes, never a single household.
            </p>
          </Topic>
          <Topic id={METHOD_SECTIONS.geography} title="Figures by area" preview="Disclosure checks · 90% intervals · Map colours">
            <p className="method-more">
              Constituency figures come from the same survey as the national ones. We publish each only after
              disclosure checks, with a 90% interval.
            </p>
            <GeographyMethodology />
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
          title="Scenarios and benchmarks"
          summary="Illustrative second-round effects, and published figures to set the results beside. Neither is a PolicyEngine estimate."
        >
          <Topic id="method-behavioural-scenarios" title="Behavioural scenarios" preview="Illustrative · Share moving into work · Entry cases">
            <FactList
              items={[
                ["Illustrative", "Illustrative scenarios, not a PolicyEngine estimate. The main figures are static."],
                [
                  "Young people affected",
                  "People aged 16 to 24 in households whose net income falls under the package, from the verified static results for the scenarios' year.",
                ],
                [
                  "Moving into work",
                  "An assumed share of them, from 0% to 50%, moves into work, each like one entry case: 16 or 25 hours a week at a given wage.",
                ],
                [
                  "Exchequer offset",
                  "Their number times the entry case's gain to the Exchequer under the package, from household calculations; it is added to the static figure.",
                ],
              ]}
            />
          </Topic>
          <Topic id="method-benchmarks" title="Benchmarks" preview="Published figures · Sources · PolicyEngine estimates beside them">
            <p className="method-more">
              Published figures from the ONS, DWP, the Resolution Foundation and the IFS, each with its basis, source
              and date. Where the verified results hold a comparable figure, a PolicyEngine estimate sits beside it;
              the two count different groups, so the estimate is context, not a check.
            </p>
          </Topic>
        </MethodSection>

        <MethodSection
          id={METHOD_SECTIONS.personal}
          title="Household calculator"
          summary={
            <span id={METHOD_SECTIONS.singleYear} className="method-anchor">
              We apply the same model and measures to one household&apos;s answers on the{" "}
              <ViewLink tab="household" onShowTab={onShowTab}>
                Household calculator tab
              </ViewLink>
              .
            </span>
          }
        >
          <Topic id={METHOD_ANCHORS.householdPolicies} title="Measures in the calculator" preview={`${modelled.length} measures`}>
            <ul className="method-list">
              {modelled.map((measure) => (
                <li key={measure.id}>{measure.name}</li>
              ))}
            </ul>
          </Topic>
          <Topic
            id={METHOD_ANCHORS.householdCalc}
            title="How the household calculation works"
            preview={SINGLE_YEAR_METHOD.map(([term]) => term).join(" · ")}
          >
            <FactList items={SINGLE_YEAR_METHOD.map(([term, text]) => [term, text])} />
          </Topic>
          <Topic id={METHOD_ANCHORS.incomePosition} title="Where your income sits" preview="Income · Distribution">
            <FactList
              items={[
                [
                  "Income",
                  "Household net income after taxes and with benefits, divided by your household's size on the HBAI scale.",
                ],
                [
                  "Distribution",
                  `We publish it from the ${ordinal(LOWEST_PERCENTILE)} to the ${ordinal(HIGHEST_PERCENTILE)} percentile, as averages over bands one percentile wide.`,
                ],
              ]}
            />
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
