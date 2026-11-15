import "./MilburnBanner.css";

/** The banner's words: the measures are candidates, not policy. */
export const MILBURN_BANNER_TEXT =
  "Candidate measures modelled before the review is published. These are not announced policy.";

/**
 * Always on, above every view and the landing page: the measures this
 * dashboard models are candidates for the Milburn review of young people
 * and work, modelled before its final report.
 */
export default function MilburnBanner() {
  return (
    <p className="milburn-banner" role="note">
      {MILBURN_BANNER_TEXT}
    </p>
  );
}
