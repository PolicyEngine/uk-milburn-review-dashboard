import { afterEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import MethodologyTab, { METHOD_CONTENTS, METHOD_SECTIONS, MILBURN_LIMITATIONS } from "./MethodologyTab";
import { NOT_COMPUTABLE_MEASURES } from "../utils/milburn/notComputable";
import { groupMilburnMeasures, MILBURN_GROUPS } from "../utils/milburn/measureGroups";
import { METHOD_ANCHORS } from "./methodology/anchors";
import { unavailableMeasures } from "./methodology/measures";
import { buildMeasureCatalogue, MeasureCatalogueProvider } from "../utils/measureCatalogue";
import { measureCatalogueFixture } from "../test/measureCatalogueFixture";
const catalogue = buildMeasureCatalogue(measureCatalogueFixture());
const UNAVAILABLE = unavailableMeasures(catalogue);

afterEach(() => {
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
  delete window.matchMedia;
});

const renderTab = (onShowTab = vi.fn()) => render(<MeasureCatalogueProvider catalogue={catalogue}><MethodologyTab onShowTab={onShowTab} /></MeasureCatalogueProvider>);

describe("MethodologyTab", () => {
  it("keeps the anchors other views link to", () => {
    // The age cards link to these
    expect(METHOD_SECTIONS.young).toBe("method-young");
    // The Impact sub-tabs' static caveat line links here (App.jsx STATIC_CAVEAT_ANCHOR)
    expect(METHOD_SECTIONS.model).toBe("method-model");
    const { container } = renderTab();
    for (const id of Object.values(METHOD_SECTIONS)) {
      expect(container.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it("lists every section in a contents nav, each linking to its titled section", () => {
    const { container } = renderTab();
    const nav = screen.getByRole("navigation", { name: "Methodology contents" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(
      METHOD_CONTENTS.map((section) => section.title),
    );
    for (const { id, title } of METHOD_CONTENTS) {
      const link = within(nav).getByRole("link", { name: title });
      expect(link).toHaveAttribute("href", `#${id}`);
      const section = container.querySelector(`section#${id}`);
      expect(section).not.toBeNull();
      expect(within(section).getAllByRole("heading", { level: 2 })[0]).toHaveTextContent(title);
    }
    // The phone's jump menu offers the same sections
    const options = within(nav).getAllByRole("option");
    expect(options.map((option) => option.value)).toEqual(METHOD_CONTENTS.map((s) => s.id));
  });

  it("marks the chosen section current, puts it in the address and focuses its title", () => {
    renderTab();
    const nav = screen.getByRole("navigation", { name: "Methodology contents" });
    const link = within(nav).getByRole("link", { name: "Impact" });
    fireEvent.click(link);
    expect(link).toHaveAttribute("aria-current", "location");
    expect(window.location.hash).toBe("#method-population");
    expect(screen.getByRole("heading", { level: 2, name: "Impact" })).toHaveFocus();

    fireEvent.change(within(nav).getByRole("combobox"), {
      target: { value: METHOD_SECTIONS.limitations },
    });
    expect(window.location.hash).toBe("#method-limitations");
    expect(within(nav).getByRole("link", { name: "Limitations" })).toHaveAttribute(
      "aria-current",
      "location",
    );
  });

  it("keeps headings in order, never skipping a level", () => {
    const { container } = renderTab();
    const levels = [...container.querySelectorAll("h2, h3, h4, h5, h6")].map((heading) =>
      Number(heading.tagName[1]),
    );
    expect(levels[0]).toBe(2);
    levels.forEach((level, index) => {
      if (index > 0) expect(level - levels[index - 1]).toBeLessThanOrEqual(1);
    });
  });

  it("counts and lists the measures the page offers, leaving out a hidden run", () => {
    // The page offers the report's runs and the comparators; every other run is hidden
    const offeredIds = MILBURN_GROUPS.filter((group) => !group.hidden).flatMap((group) => group.ids);
    const offered = catalogue.measures.map((measure, index) => ({ ...measure, id: offeredIds[index] }));
    expect(offered.every((measure) => typeof measure.id === "string")).toBe(true);
    const hidden = { ...catalogue.measures[0], id: "milburn_package_entry_25pct", name: "Hidden entry run" };
    const withHidden = { ...catalogue, measures: [...offered, hidden] };
    render(<MeasureCatalogueProvider catalogue={withHidden}><MethodologyTab onShowTab={vi.fn()} /></MeasureCatalogueProvider>);
    const shown = groupMilburnMeasures(withHidden.measures).flatMap((group) => group.measures);
    expect(shown).toHaveLength(catalogue.measures.length);
    const button = screen.getByRole("button", { name: /^Measures modelled/ });
    expect(button).toHaveTextContent(`${shown.length} published`);
    const card = button.closest(".method-topic");
    expect([...card.querySelectorAll(".method-list li")].map((item) => item.textContent).sort()).toEqual(shown.map((measure) => measure.name).sort());
    expect(card).not.toHaveTextContent("Hidden entry run");
  });

  it("says why ages no measure targets change, under Results by age", () => {
    const { container } = renderTab();
    expect(container.querySelector(`#${METHOD_SECTIONS.young}`).textContent).toContain(
      "Other agesOther ages change only because they share a household with someone in the targeted ages.",
    );
  });

  it("describes the move into work by the group that moves", () => {
    const { container } = renderTab();
    expect(container).toHaveTextContent("Non-working 18 to 24-year-olds whose Universal Credit health element the package removes");
    expect(container.textContent).not.toMatch(/young people it leaves worse off/);
  });

  it("lists the unavailable measures only when there are any", () => {
    renderTab();
    const card = screen.getByRole("button", { name: /^Measures modelled/ }).closest(".method-topic");
    expect(card.querySelectorAll(".mm-reasons li")).toHaveLength(UNAVAILABLE.length);
    for (const measure of UNAVAILABLE) expect(card).toHaveTextContent(`${measure.name}${measure.why}`);
    const empty = { ...catalogue, measures: catalogue.measures.filter((measure) => measure.displayable) };
    cleanup();
    render(<MeasureCatalogueProvider catalogue={empty}><MethodologyTab onShowTab={vi.fn()} /></MeasureCatalogueProvider>);
    const emptyCard = screen.getByRole("button", { name: /^Measures modelled/ }).closest(".method-topic");
    expect(emptyCard.querySelector(".mm-reasons")).toBeNull();
  });

  it("has no Household calculator section, and no topics for the removed All households sub-tab", () => {
    const { container } = renderTab();
    expect(METHOD_CONTENTS.map((section) => section.title)).not.toContain("Household calculator");
    for (const title of ["By income decile", "Household scatter", "Figures by area"]) {
      expect(screen.queryByRole("button", { name: new RegExp(`^${title}`) })).toBeNull();
    }
    expect(container.querySelector(`#${METHOD_ANCHORS.householdCalc}`)).toBeNull();
  });

  it("says young LCWRA claimants mostly also get PIP, and how the caseloads compare with DWP's", () => {
    const { container } = renderTab();
    expect(container.textContent).toContain("About nine in ten young claimants with limited capability for work and work-related activity (LCWRA) in the data also get PIP");
    expect(container.textContent).toContain("sits 1.5% above DWP's figure");
    expect(container.textContent).not.toContain("23% above");
    expect(container.textContent).toContain("too few aged 20 to 24. The proposal starts at 18");
    expect(container.textContent).toContain("the young average award is lower than the published figures");
  });

  it("switches views from its links, in place", () => {
    const onShowTab = vi.fn();
    renderTab(onShowTab);
    // Young people, with 16 to 24 chosen
    const young = screen.getAllByRole("link", { name: "Young people", hidden: true }).find((a) => a.getAttribute("href").startsWith("?tab="));
    expect(young).toHaveAttribute("href", "?tab=dashboard&sub=age&age=16-24#young-people");
    fireEvent.click(young);
    expect(onShowTab).toHaveBeenLastCalledWith("dashboard", "age", { age: "16-24" });
  });

  it("links every external source in a new tab, saying so, and every shared term to its definition", () => {
    const { container } = renderTab();
    const external = [...container.querySelectorAll('a[href^="http"]')];
    expect(external.length).toBeGreaterThan(3);
    for (const link of external) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveTextContent("(opens in a new tab)");
    }
    expect(external.map((link) => link.getAttribute("href"))).toEqual(
      expect.arrayContaining(["https://pypi.org/project/policyengine-uk/2.177.7/"]),
    );
    // Each term link lands on a term the glossary defines
    const terms = [...container.querySelectorAll('a[href^="#term-"]')];
    expect(terms.length).toBeGreaterThan(5);
    for (const link of terms) {
      expect(container.querySelector(link.getAttribute("href"))).not.toBeNull();
    }
    // In-view anchors exist too
    for (const link of container.querySelectorAll('a[href^="#method-"]')) {
      expect(container.querySelector(link.getAttribute("href")), link.getAttribute("href")).not.toBeNull();
    }
  });

  it("keeps the space after every link: no JSX text after a tag that loses it in the build", () => {
    // Next's compiler (SWC) drops the leading space of JSX text that runs on
    // to another line after a closing tag ("net income</Term> under ...",
    // shown as "net incomeunder"); jsdom's transform keeps it, so a render
    // test cannot see it. Such text needs an explicit {" "}.
    const root = join(fileURLToPath(import.meta.url), "..");
    const files = [
      "MethodologyTab.jsx",
      "GeographyMethodology.jsx",
      ...readdirSync(join(root, "methodology")).filter((f) => f.endsWith(".jsx")).map((f) => `methodology/${f}`),
      "personal/singleYearMethodNotes.jsx",
    ];
    const tag = /(<\/[A-Za-z][\w.]*>|\/>) +(?=[^\s{<])/g;
    const glued = [];
    for (const file of files) {
      const lines = readFileSync(join(root, file), "utf8").split("\n");
      lines.forEach((line, index) => {
        for (const match of line.matchAll(tag)) {
          const rest = line.slice(match.index + match[0].length);
          const next = (lines[index + 1] ?? "").trim();
          if (/[<{]/.test(rest) || /^\s*(\/\/|\*)/.test(line) || !next || /^[<{)}/]/.test(next)) continue;
          glued.push(`${file}:${index + 1}`);
        }
      });
    }
    expect(glued).toEqual([]);
  });

  it("renders every section with its icon, so a missing icon name fails", () => {
    const { container } = renderTab();
    for (const { id } of METHOD_CONTENTS) {
      const section = container.querySelector(`section#${id}`);
      expect(section).not.toBeNull();
      expect(section.querySelector(".section-heading .section-icon svg")).not.toBeNull();
    }
    // Every defined term has its icon
    for (const term of container.querySelectorAll(".method-fact dt")) {
      expect(term.querySelector("svg")).not.toBeNull();
    }
  });

  it("opens each section with a one-line summary, its topics folded until asked for", () => {
    const { container } = renderTab();
    for (const { id } of METHOD_CONTENTS) {
      const section = container.querySelector(`section#${id}`);
      expect(section.querySelector(".section-heading p")?.textContent.trim()).toBeTruthy();
      for (const toggle of section.querySelectorAll(".method-topic > .disclosure-toggle")) {
        expect(toggle).toHaveAttribute("aria-expanded", "false");
      }
    }
    // No "Back to top" after every section: the contents stay in view
    expect(container).not.toHaveTextContent("Back to top");
  });

  it("opens a folded topic when a link leads into it", async () => {
    const { container } = renderTab();
    const glossary = document.getElementById(METHOD_ANCHORS.glossary);
    const toggle = within(glossary).getByRole("button", { name: /Terms the charts use/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // A term link inside another topic leads to the glossary
    fireEvent.click(container.querySelector('a[href="#term-netIncome"]'));
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(window.location.hash).toBe("#term-netIncome");
  });

  it("defines each shared term in one line", () => {
    const { container } = renderTab();
    const rows = [...container.querySelectorAll(".method-glossary-row")];
    expect(rows.length).toBeGreaterThan(10);
    for (const row of rows) {
      expect(row.querySelector("dd").textContent.length).toBeLessThan(200);
    }
    expect(container.textContent).not.toMatch(/66 in 2026-27/);
  });

  it("names the build, the model and that the figures are static", () => {
    const { container } = renderTab();
    expect(container).toHaveTextContent("Microcosm UK build fcfac709, policyengine-uk 2.177.7, certified in policyengine 6.20.2");
    expect(container).toHaveTextContent("policyengine-core 3.34.10");
    expect(container).toHaveTextContent("uk-frs-calibration-attempt-20261115T104657Z-fcfac709");
    expect(container).toHaveTextContent("no behavioural response in the main figures");
    expect(container.textContent).not.toMatch(/Autumn Budget|October 2026/i);
  });

  it("lists the limits once: static, no NEET variable, ADP held as PIP, the age-blind draw, small samples at 16 and 17", () => {
    const { container } = renderTab();
    const limitations = container.querySelector(`section#${METHOD_SECTIONS.limitations}`);
    const terms = [...limitations.querySelectorAll(".method-fact dt")].map((term) => term.textContent);
    expect(terms).toEqual(MILBURN_LIMITATIONS.map(([term]) => term));
    for (const words of ["No NEET variable", "Adult Disability Payment", "does not depend on age", "16 or 17"]) {
      expect(limitations).toHaveTextContent(words);
    }
  });

  it("lists every measure it cannot compute with the reason, and no figure for any", () => {
    const { container } = renderTab();
    const topic = container.querySelector("#method-not-computable");
    for (const measure of NOT_COMPUTABLE_MEASURES) expect(topic).toHaveTextContent(`${measure.name}${measure.notModelled}`);
    expect(topic.textContent).not.toMatch(/£/);
  });
});
