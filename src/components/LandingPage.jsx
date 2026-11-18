import SourceLink from "./SourceLink";
import { ChevronRight } from "lucide-react";
import TitleIcon from "./TitleIcon";
import { REPORT_DAY, subShownOnReportDay } from "../utils/milburn/reportDay";
import { FINAL_REPORT, REPORT_PUBLISHED, reportCopy } from "../utils/milburn/reportStatus";
import "./LandingPage.css";

/** One of the three boxes: a link that opens its view in place. */
function LandingBox({ tab, sub, icon, title, description, onOpen }) {
  const href = `?${new URLSearchParams({ tab, ...(sub ? { sub } : {}) })}`;
  return (
    <li className="landing-box-item">
      <a
        className="landing-box"
        href={href}
        onClick={(event) => {
          // A new tab or window opens the address as usual
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          onOpen(tab, sub);
        }}
      >
        <svg className="landing-box-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 17 17 7M8 7h9v9" />
        </svg>
        <TitleIcon name={icon} size={24} className="landing-box-icon" />
        <span className="landing-box-title">{title}</span>
        <span className="landing-box-description">{description}</span>
        <span className="landing-box-explore">
          Explore<span className="landing-box-arrow" aria-hidden="true">→</span>
        </span>
      </a>
    </li>
  );
}

/**
 * The three ways in, in order: [tab, sub, icon, title, line]. While the
 * measures are provisional, the policies box names them as modelled
 * measures, not the Budget's contents. A box whose sub-tab the report-day
 * switch hides (utils/milburn/reportDay.js: Moves into work (illustrative)) goes with it.
 * The measures box's line is the report-status switch's
 * (utils/milburn/reportStatus.js).
 */
export const landingBoxes = ({ reportDay = REPORT_DAY, published = REPORT_PUBLISHED } = {}) => [
  ["dashboard", "age", "usersRound", "Young people", "Who gains or loses, and the cost"],
  ["dashboard", "scenarios", "sliders", "Moves into work (illustrative)", "If some young people find work"],
  ["policies", undefined, "list", "Measures we model", reportCopy(published).measuresBoxLine],
].filter(([, sub]) => subShownOnReportDay(sub, reportDay));

/**
 * What the dashboard is: the heading (its id given, as the
 * landing page and the overview drawer each name themselves by it), the
 * paragraph and the provisional notice. One source for both. The words
 * are the report-status switch's (utils/milburn/reportStatus.js): `published`
 * overrides it. Once published, the paragraph links to the report itself.
 */
export function LandingIntro({ headingId, provisional, note = null, className = "landing-hero", published = REPORT_PUBLISHED }) {
  const copy = reportCopy(published);
  return (
    <div className={className}>
      <h2 id={headingId} className="landing-heading">{copy.landingHeading}</h2>
      <p className="landing-intro">
        {copy.landingIntroLead}<SourceLink source="policyengine_uk_model" />{" "}{copy.landingIntroRest}
        {published && (
          <>
            {" "}
            <a href={FINAL_REPORT.url} target="_blank" rel="noopener noreferrer">
              {FINAL_REPORT.shortTitle}
              <span className="policy-sr-only"> (opens in a new tab)</span>
            </a>
          </>
        )}
        {copy.landingIntroTail}
      </p>
      {note && <p className="landing-intro landing-intro-note">{note}</p>}
      {provisional}
    </div>
  );
}

/** A way in as a row of a list (the overview drawer): the whole row is the link. */
function LandingRow({ tab, sub, icon, title, description, onOpen }) {
  const href = `?${new URLSearchParams({ tab, ...(sub ? { sub } : {}) })}`;
  return (
    <li>
      <a
        className="landing-row"
        href={href}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          onOpen(tab, sub);
        }}
      >
        <TitleIcon name={icon} size={18} className="landing-row-icon" />
        <span className="landing-row-text">
          <span className="landing-row-title">{title}</span>
          <span className="landing-row-description">{description}</span>
        </span>
        <ChevronRight className="landing-row-chevron" size={18} strokeWidth={2} aria-hidden="true" />
      </a>
    </li>
  );
}

/**
 * The three ways in: boxes side by side (the landing page), or a list of
 * rows (`list`, the overview drawer's "In this dashboard" card), labelled
 * by `labelledBy`.
 */
export function LandingBoxes({ onOpen, list = false, labelledBy, reportDay = REPORT_DAY, published = REPORT_PUBLISHED }) {
  const BOXES = landingBoxes({ reportDay, published });
  if (list) {
    return (
      <ul className="landing-rows" aria-labelledby={labelledBy}>
        {BOXES.map(([tab, sub, icon, title, description]) => (
          <LandingRow key={`${tab}:${sub ?? ""}`} tab={tab} sub={sub} icon={icon} title={title} description={description} onOpen={onOpen} />
        ))}
      </ul>
    );
  }
  return (
    <ul className="landing-boxes">
      {BOXES.map(([tab, sub, icon, title, description]) => (
        <LandingBox key={`${tab}:${sub ?? ""}`} tab={tab} sub={sub} icon={icon} title={title} description={description} onOpen={onOpen} />
      ))}
    </ul>
  );
}

/**
 * The landing page, at the bare address only (utils/landing.js): what the
 * dashboard does, then three ways in, over a silhouette of the Public
 * finances view (App.jsx).
 *
 * @param {Object} props
 * @param {(tab: string, sub?: string) => void} props.onOpen - Open a view (App's handleTabChange)
 * @param {React.ReactNode} [props.provisional] - The provisional notice, when it applies
 * @param {boolean} [props.provisionalWording] - Whether the measures are provisional (the boxes' wording)
 * @param {boolean} [props.published] - Whether the final report is published (the report-status switch's state unless given)
 */
export default function LandingPage({ onOpen, provisional, provisionalWording = false, published = REPORT_PUBLISHED }) {
  return (
    <section className="landing" aria-labelledby="landing-heading">
      <LandingIntro headingId="landing-heading" provisional={provisional} published={published} />
      <LandingBoxes onOpen={onOpen} provisional={provisionalWording} published={published} />
    </section>
  );
}
