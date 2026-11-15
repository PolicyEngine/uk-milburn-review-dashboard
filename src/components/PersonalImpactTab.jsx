import HouseholdCalculator from "./HouseholdCalculator";
import UnavailableMeasures from "./publication/UnavailableMeasures";
import UnavailableNotice, { RemoveUnavailable } from "./publication/UnavailableNotice";
import { isCatalogueRowDisplayable, publishedDefinitions, publishedEngine, useMeasureCatalogue } from "../utils/measureCatalogue";
import { usePublicationCheck } from "../utils/publication/check";
import { publishedRequest, removableFromSelection } from "../utils/calculatorOnlyMeasures";
import "./PersonalImpactTab.css";

/**
 * Household calculator: one household's answers, then its net income in the
 * year chosen in the title band before and after the selected policies.
 */
function PersonalImpactTab({ selectedPolicies = [], policies = [], year, onRemoveUnavailable, active = true }) {
  const catalogue = useMeasureCatalogue();
  const confirmPublication = usePublicationCheck();
  // The local build route (utils/milburn/localBuild.js) has no receipts:
  // the calculator checks every live answer against a receipt's engine and
  // approved definition, so it cannot answer on this build
  if (catalogue.localBuild) {
    return (
      <UnavailableNotice reason="Household calculator is not available on the local build">
        <p>
          The calculator checks each answer against the model version and measure definitions that the published
          figures&rsquo; receipts record. The local build ({catalogue.localBuild.label}) has no receipts, so there is
          nothing to check a household&rsquo;s answer against.
        </p>
        <p>
          The household API runs on this engine (<code>HOUSEHOLD_WORKERS=2 PORT=8010 uv run uk-budget-api</code>) and
          can be asked directly for the six computable measures.
        </p>
      </UnavailableNotice>
    );
  }
  const unavailable = selectedPolicies.filter((id) => !isCatalogueRowDisplayable(catalogue, id, year));
  if (!catalogue.manifest || unavailable.length) {
    const names = unavailable.map((id) => catalogue.byId.get(id)?.name ?? id);
    return (
      <UnavailableNotice reason="Household calculator is unavailable for the selected policies">
        <p>{names.join(", ") || "No verified measures are published yet."}</p>
        {catalogue.manifest && onRemoveUnavailable && removableFromSelection(unavailable, selectedPolicies) && (
          <RemoveUnavailable names={names} onRemove={() => onRemoveUnavailable(unavailable)} />
        )}
      </UnavailableNotice>
    );
  }
  // What a household request carries that the publication names: the
  // selection, and a calculator-only measure too once the manifest names
  // it, selected or not. Each is checked against its receipt; one the
  // manifest doesn't name has none (calculatorOnlyMeasures.js)
  const published = (id) => catalogue.byId.has(id);
  const checkedIds = publishedRequest(selectedPolicies, published);
  // The household API answers live; its package versions must be the ones
  // those measures' receipts record (useHouseholdImpact)
  const expectedEngine = publishedEngine(catalogue, checkedIds);
  if (selectedPolicies.length && !expectedEngine) {
    return (
      <UnavailableNotice reason="Household calculator is unavailable for the selected policies">
        <p>Their published figures do not name one model version for the household calculator to match.</p>
      </UnavailableNotice>
    );
  }
  // And it must compute each measure from the definition its receipt
  // approved: a measure with none to check is unavailable, never unchecked
  const { definitions: expectedDefinitions, missing } = publishedDefinitions(catalogue, checkedIds);
  if (missing.length) {
    return (
      <UnavailableMeasures
        reason="Household calculator is unavailable for the selected measures"
        summary="The household calculator cannot be checked against these measures' published figures:"
        measures={missing.map(({ id, reason }) => ({ id, name: catalogue.byId.get(id)?.name ?? id, why: [reason] }))}
        // Only when taking them out of the selection lifts this: not for a
        // calculator-only one, in every request, selected or not
        onRemove={removableFromSelection(missing.map(({ id }) => id), selectedPolicies) ? onRemoveUnavailable : undefined}
      />
    );
  }
  // The examples' precomputed answers are for every published measure, so
  // they are checked against those measures' receipts, whatever is selected
  // now (with none selected there is no expectedEngine at all): their
  // engine, and each one's definition, none unless every one has one to
  // check (#136: a file's answers are never shown unchecked either)
  const presetIds = publishedRequest(
    policies.filter((policy) => policy.displayable !== false).map((policy) => policy.id),
    published,
  );
  const presetEngine = publishedEngine(catalogue, presetIds);
  const presetChecks = publishedDefinitions(catalogue, presetIds);
  const presetDefinitions = presetChecks.missing.length ? null : presetChecks.definitions;
  const publicationKey = catalogue.manifest.snapshotSha256 ?? String(catalogue.manifest.revision);
  return (
    <div className="personal-impact-tab">
      <HouseholdCalculator
        key={publicationKey}
        publicationKey={publicationKey}
        selectedPolicies={selectedPolicies}
        policies={policies}
        year={year}
        expectedEngine={expectedEngine}
        expectedDefinitions={expectedDefinitions}
        presetEngine={presetEngine}
        presetDefinitions={presetDefinitions}
        confirmPublication={confirmPublication}
        onRemoveUnavailable={onRemoveUnavailable}
        active={active}
      />
    </div>
  );
}

export default PersonalImpactTab;
