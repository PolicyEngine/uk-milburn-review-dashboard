import SectionHeading from "../SectionHeading";
import { PolicyCard } from "../PolicyCards";
import { NOT_COMPUTABLE_MEASURES } from "../../utils/milburn/notComputable";
import { useMeasureCatalogue } from "../../utils/measureCatalogue";
import { NOT_YET_RUN } from "../../utils/milburn/localBuild";
import { NotComputableVisual } from "../policies/MilburnVisual";
import { reportCopy } from "../../utils/milburn/reportStatus";
import "./milburn.css";

// The headings, in the report-status switch's words (utils/milburn/reportStatus.js)
export const NOT_COMPUTABLE_TITLE = reportCopy().notComputableTitle;
export const NOT_YET_RUN_TITLE = reportCopy().notYetRunTitle;

/**
 * On the local build route, the computable measures whose national run has
 * not finished (no folder under public/data/milburn/) or could not be read:
 * named with the reason, no figure.
 */
function PendingMeasures() {
  const catalogue = useMeasureCatalogue();
  if (!catalogue.localBuild) return null;
  const pending = catalogue.measures.filter((measure) => !measure.displayable);
  if (!pending.length) return null;
  return (
    <section id="measures-not-yet-run" aria-label={NOT_YET_RUN_TITLE}>
      <SectionHeading
        icon="list"
        title={NOT_YET_RUN_TITLE}
        subtitle="Computable, but their national results are not on this build yet; no figure is shown for them until they are."
      />
      <ul className="milburn-pending report-section">
        {pending.map((measure) => (
          <li key={measure.id}>
            <strong>{measure.name}</strong>{" "}
            <span className="milburn-pending-status">({measure.availability?.reason || NOT_YET_RUN})</span>
            {measure.description && <p>{measure.description}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The report's measures the dashboard lists but cannot compute, as cards
 * of the modelled cards' kind, each with the reason. No estimate is shown
 * for any of them; a summary may state the report's own amount.
 */
export default function NotComputableMeasures({ measures: given }) {
  // The final report's list (utils/milburn/notComputable.js) on every data
  // route: milburn_measures.json still lists the pre-report four
  const measures = given ?? NOT_COMPUTABLE_MEASURES;
  return (
    <>
    <PendingMeasures />
    {measures.length > 0 && <section id="measures-not-computable" aria-label={NOT_COMPUTABLE_TITLE}>
      <SectionHeading
        icon="list"
        title={NOT_COMPUTABLE_TITLE}
        subtitle="Listed with the reason; no estimate is shown for them anywhere on this dashboard."
      />
      {/* Folded by default (Vahid, 17 Nov): one line with the count */}
      <details className="report-section policy-details-content not-computable-details">
        <summary className="not-computable-summary">
          <span className="not-computable-chevron" aria-hidden="true">▸</span>
          Show the {measures.length} proposals we cannot compute
        </summary>
        <ul className="policy-cards">
          {measures.map((measure) => (
            <PolicyCard
              key={measure.id}
              policy={{
                id: measure.id,
                anchorId: `not-computable-${measure.id}`,
                name: measure.name,
                label: measure.name,
                summary: measure.summary,
                affects: measure.affects,
                // Itemised, each with its icon: who it would reach, what sort of measure it is
                points: [
                  measure.affects && { label: "Who", icon: "users", text: measure.affects },
                  measure.kind && { label: "Kind", icon: "shapes", text: measure.kind },
                ].filter(Boolean),
                category: measure.category,
                notModelled: measure.notModelled,
                // A diagram (no figure), where the measure has one
                visual: measure.visual ? <NotComputableVisual measure={measure} /> : undefined,
                timeline: false,
                direction: "neutral",
              }}
            />
          ))}
        </ul>
      </details>
    </section>}
    </>
  );
}
