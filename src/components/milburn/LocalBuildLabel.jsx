import { useMeasureCatalogue } from "../../utils/measureCatalogue";
import { NOT_YET_RUN } from "../../utils/milburn/localBuild";
import "./milburn.css";

/**
 * The local build's label, near the figures of every view on the local
 * build route (utils/milburn/localBuild.js): the build and engine the runs
 * were made on, from their model_build.json, and that no certificate covers
 * it. Lists the runs not yet made, which show no figure. Nothing on the
 * verified route.
 */
export default function LocalBuildLabel() {
  const catalogue = useMeasureCatalogue();
  const local = catalogue.localBuild;
  if (!local) return null;
  const pending = catalogue.measures.filter((measure) => measure.availability?.reason === NOT_YET_RUN);
  return (
    <p className="milburn-label milburn-build-label" role="note" data-local-build="">
      Figures from {local.label}: not certified.
      {pending.length > 0 && ` ${NOT_YET_RUN}: ${pending.map((measure) => measure.name).join(", ")}.`}
    </p>
  );
}
