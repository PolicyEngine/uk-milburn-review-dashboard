/**
 * Which view an address opens, read before the page's code runs, so the
 * server's HTML can paint that view's placeholder (ViewSkeleton.jsx) at
 * once: <html data-boot-view="tab:sub">. Kept free of React: the root
 * layout's inline script (BOOT_VIEW_SCRIPT) and the page read the same rule.
 * App.jsx's own routing decides what opens; this only picks the placeholder.
 */

import { POVERTY_FIGURES_SHOWN } from "./povertyFigures";
import { subShownOnReportDay } from "./milburn/reportDay";

export const BOOT_TABS = Object.freeze(["dashboard", "policies", "methodology"]);
export const BOOT_SUBS = Object.freeze({
  // Poverty only while its figures are shown (povertyFigures.js), as PopulationImpactView
  // Less the sub-tabs the report-day switch hides (milburn/reportDay.js)
  dashboard: Object.freeze(
    ["age", ...(POVERTY_FIGURES_SHOWN ? ["poverty"] : []), "finances", "scenarios", "benchmarks"].filter((sub) =>
      subShownOnReportDay(sub),
    ),
  ),
});
// Old sub-tab names that now open another (App.jsx oldAgeSubGroup)
const SUB_ALIASES = Object.freeze({ young: "age", pensioners: "age" });

/** "tab:sub" (or "tab" for a view without sub-tabs) for an address. */
export function bootView({ search, hash }) {
  const params = new URLSearchParams(search);
  if (hash === "#young-people") return "dashboard:age";
  const asked = params.get("tab");
  const tab = BOOT_TABS.includes(asked) ? asked : "dashboard";
  const subs = BOOT_SUBS[tab];
  if (!subs) return tab;
  const rawSub = params.get("sub");
  const sub = SUB_ALIASES[rawSub] ?? rawSub;
  return `${tab}:${subs.includes(sub) ? sub : subs[0]}`;
}

/** The inline script: marks <html data-boot-view> from the address. */
export const BOOT_VIEW_SCRIPT =
  "(function(){try{" +
  `var T=${JSON.stringify(BOOT_TABS)},S=${JSON.stringify(BOOT_SUBS)},A=${JSON.stringify(SUB_ALIASES)};` +
  "var l=window.location,p=new URLSearchParams(l.search),v;" +
  'if(l.hash==="#young-people")v="dashboard:age";else{' +
  'var t=T.indexOf(p.get("tab"))>=0?p.get("tab"):"dashboard",s=S[t];' +
  'if(!s)v=t;else{var r=p.get("sub"),u=A[r]||r;v=t+":"+(s.indexOf(u)>=0?u:s[0]);}}' +
  'document.documentElement.setAttribute("data-boot-view",v);' +
  "}catch(e){}})();";
