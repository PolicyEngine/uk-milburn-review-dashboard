import { useEffect, useState } from "react";
import { OPEN_POPULATION_SUB } from "../utils/populationSub";
import { POVERTY_FIGURES_SHOWN } from "../utils/povertyFigures";
import SubTabs, { SubTabPanel, subTabId, useSubTabParam } from "./SubTabs";
import { YOUNG_PEOPLE_ANCHOR } from "../utils/viewAnchors";
import { REPORT_DAY, subShownOnReportDay } from "../utils/milburn/reportDay";

/**
 * Impact's sub-tabs; the first, Young people (?sub=age, the age-group view
 * opened on 16 to 24), is the default. Poverty is left out while the
 * poverty figures are withheld (povertyFigures.js), so ?sub=poverty opens
 * the default. Moves into work (illustrative) (?sub=scenarios) and Benchmarks set the
 * static results beside a move into work and published figures; both are
 * left out while the report-day switch is on (utils/milburn/reportDay.js),
 * so their links open the default too.
 */
export function populationSubTabs({ reportDay = REPORT_DAY } = {}) {
  return [
    { value: "age", label: "Young people", icon: "usersRound" },
    { value: "finances", label: "Public finances", icon: "landmark" },
    { value: "poverty", label: "Poverty", icon: "percent" },
    { value: "scenarios", label: "Moves into work (illustrative)", icon: "sliders" },
    { value: "benchmarks", label: "Benchmarks", icon: "scale" },
  ]
    .filter((tab) => POVERTY_FIGURES_SHOWN || tab.value !== "poverty")
    .filter((tab) => subShownOnReportDay(tab.value, reportDay));
}

export const POPULATION_SUB_TABS = populationSubTabs();

const SUB_TAB_VALUES = POPULATION_SUB_TABS.map((tab) => tab.value);

const ID_PREFIX = "population";

/** Take #young-people out of the address, keeping the rest. */
function dropYoungHash() {
  if (window.location.hash !== `#${YOUNG_PEOPLE_ANCHOR}`) return;
  window.history.replaceState({}, "", window.location.pathname + window.location.search);
}

function PopulationSubTabs({ note, active = true, children }) {
  const [sub, setSub] = useSubTabParam(SUB_TAB_VALUES, active);
  // Sub-tabs opened so far stay mounted, hidden while another is shown
  const [visited, setVisited] = useState([sub]);
  if (!visited.includes(sub)) setVisited([...visited, sub]);

  // A link to #young-people while this view is open shows its sub-tab
  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash === `#${YOUNG_PEOPLE_ANCHOR}`) setSub("age");
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [setSub]);

  // A link elsewhere on the page that opens a sub-tab (openPopulationSub)
  useEffect(() => {
    const onOpen = (event) => {
      if (!SUB_TAB_VALUES.includes(event.detail)) return;
      dropYoungHash();
      setSub(event.detail);
      document.getElementById(subTabId(ID_PREFIX, event.detail))?.scrollIntoView?.({ block: "center" });
    };
    window.addEventListener(OPEN_POPULATION_SUB, onOpen);
    return () => window.removeEventListener(OPEN_POPULATION_SUB, onOpen);
  }, [setSub]);

  // The #young-people hash belongs to the Young people sub-tab, so it goes
  // with it: a reload never opens a different sub-tab from this one
  const onChange = (next) => {
    if (next !== "age") dropYoungHash();
    setSub(next);
  };

  return (
    <>
      <SubTabs
        tabs={POPULATION_SUB_TABS}
        value={sub}
        onChange={onChange}
        ariaLabel="Impact sections"
        idPrefix={ID_PREFIX}
      />
      {note}
      {SUB_TAB_VALUES.filter((value) => visited.includes(value)).map((value) => (
        <SubTabPanel key={value} idPrefix={ID_PREFIX} value={value} hidden={value !== sub}>
          {children(value)}
        </SubTabPanel>
      ))}
    </>
  );
}

/**
 * The Impact view: its sub-tabs (POPULATION_SUB_TABS) as pills under the
 * view tabs. The open sub-tab is ?sub= (useSubTabParam). App.jsx turns the
 * old links (?tab=young, #young-people, ?sub=young, ?sub=pensioners) into
 * ?sub=age (with ?age=) before this view first reads the address.
 *
 * The sub-tab is read from the address, which the server does not have, so
 * the view renders from the first client effect on: the server's page and
 * the browser's first render agree, and App.jsx has read the address.
 *
 * @param {Object} props
 * @param {React.ReactNode} [props.note] - A line under the sub-tabs, over every panel
 * @param {boolean} [props.active] - Whether the view is shown (App keeps it mounted while hidden)
 * @param {(sub: string) => React.ReactNode} props.children - A sub-tab's content
 */
export default function PopulationImpactView(props) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first client render only
    setReady(true);
  }, []);
  return ready ? <PopulationSubTabs {...props} /> : null;
}
