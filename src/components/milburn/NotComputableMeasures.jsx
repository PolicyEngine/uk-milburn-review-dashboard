import SectionHeading from "../SectionHeading";
import { PolicyCard } from "../PolicyCards";
import { NOT_COMPUTABLE_MEASURES } from "../../utils/milburn/notComputable";

export const NOT_COMPUTABLE_TITLE = "Candidate measures we cannot compute";

/**
 * The candidate measures the dashboard lists but cannot compute, as cards
 * of the modelled cards' kind, each with the reason. No figure is shown
 * for any of them.
 */
export default function NotComputableMeasures({ measures = NOT_COMPUTABLE_MEASURES }) {
  if (!measures.length) return null;
  return (
    <section id="measures-not-computable" aria-label={NOT_COMPUTABLE_TITLE}>
      <SectionHeading
        icon="list"
        title={NOT_COMPUTABLE_TITLE}
        subtitle="Listed with the reason; no figure is shown for them anywhere on this dashboard."
      />
      <div className="report-section policy-details-content">
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
                category: measure.category,
                notModelled: measure.notModelled,
                timeline: false,
                direction: "neutral",
              }}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
