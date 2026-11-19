import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import AgeSection from "../AgeSection";
import { buildMeasureCatalogue, MeasureCatalogueProvider } from "../../utils/measureCatalogue";
import { singleAgeSelection } from "../../utils/ageImpact";
import { singleAgeBars } from "../youngPeople/youngPeopleData";
import { agesText, windowTicks } from "./SingleAgeCard";
import { ALPHA, BETA, COMBINED, YEAR, measureCatalogueFixture } from "../../test/measureCatalogueFixture";
import { POVERTY_FIGURES_SHOWN } from "../../utils/povertyFigures";

// By age's selection rule, on a publication where one single (BETA)
// withholds its age bands (too few survey records), keeping all ages, as
// the State Pension income tax protection does from 2027-28. Point by point
// (Vahid, 29 Oct: where one policy is withheld, show everything else that
// is published, and no disclosure text):
// - the published package of exactly the selection reads its own net; its
//   members' parts are drawn where every member has one, or where the
//   package's net is withheld too, never beside a published net with a
//   member missing;
// - another combination draws each policy's published parts, and its net
//   only where every policy has one;
// - the single alone draws what it has.

/** No disclosure wording anywhere in the section. */
const DISCLOSURE = /too few survey records|not published by age|not shown|Not drawn in|split by policy is not shown/i;
vi.setConfig({ testTimeout: 30000 });

vi.mock("recharts", async () => {
  const React = await import("react");
  const Chart = ({ data, children }) => {
    const rows = data ?? [];
    return <div data-testid="chart-rows" data-rows={JSON.stringify(rows)}>{children}</div>;
  };
  const Bar = ({ dataKey, hide }) => (hide ? null : <span data-testid="series" data-key={dataKey} />);
  const Empty = () => null;
  return {
    ComposedChart: Chart, BarChart: Chart, ScatterChart: Chart, LineChart: Chart,
    ResponsiveContainer: ({ children }) => <div>{children}</div>,
    Bar, Scatter: Empty, Cell: Empty, Tooltip: Empty, Legend: Empty,
    Line: Empty, XAxis: Empty, YAxis: Empty, CartesianGrid: Empty,
    ReferenceArea: Empty, ReferenceLine: Empty, LabelList: Empty, Customized: Empty,
  };
});
vi.mock("../ChartDownloadMenu", () => ({ default: () => null }));
vi.mock("../../utils/loadDashboard", async (importOriginal) => {
  const actual = await importOriginal();
  const { parseTable } = await import("../../utils/publication/csv");
  const { isCatalogueRowDisplayable } = await import("../../utils/measureCatalogue");
  return {
    ...actual,
    peekVerifiedTables: () => null,
    loadVerifiedTable: async (catalogue, table) => {
      const response = await fetch(`/data/${table}.csv`);
      return parseTable(table, await response.text()).filter((row) =>
        isCatalogueRowDisplayable(catalogue, row.reform_id, row.year),
      );
    },
  };
});
vi.mock("../../utils/chartLogo", () => ({
  PolicyEngineLogo: () => null,
  CHART_LOGO: { href: "data:image/png;base64,iVBORw0KGgo=", width: 80, height: 17, padding: 8 },
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const BANDS = ["0-15", "16-24", "25-34", "35-49", "50-64", "65+"];

/** The fixture with BETA's age bands withheld: its all ages row stays. */
function withheldFixture({ packagePublished = true } = {}) {
  const fixture = measureCatalogueFixture({ held: false });
  if (!packagePublished) fixture.manifest.combined[COMBINED].status = "withdrawn";
  const [header, ...lines] = fixture.ageCsv.split("\n");
  const kept = lines.filter((line) => {
    const [id, , , band] = line.split(",");
    return !(id === BETA && BANDS.includes(band));
  });
  fixture.ageCsv = [header, ...kept].join("\n");
  return fixture;
}

async function renderAge(fixture, selectedPolicies) {
  const catalogue = buildMeasureCatalogue(fixture);
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, text: async () => fixture.ageCsv })));
  const view = render(
    <MeasureCatalogueProvider catalogue={catalogue}>
      <AgeSection policies={catalogue.measures} selectedPolicies={selectedPolicies} selectedYear={YEAR} />
    </MeasureCatalogueProvider>,
  );
  await screen.findByRole("heading", { name: /Average change by age/ });
  return { ...view, catalogue };
}

const chartRows = (container) =>
  [...container.querySelectorAll('[data-testid="chart-rows"]')].map((node) => JSON.parse(node.dataset.rows));

/** No chart draws some of its points and not others in the selected year. */
function expectNoHalfDrawn(container) {
  for (const rows of chartRows(container)) {
    const points = rows.filter((point) => point.year === undefined || point.year === YEAR);
    for (const key of ["netChange", ...BANDS, "all"]) {
      const present = points.filter((point) => key in point);
      if (present.length < 2) continue;
      const drawn = present.filter((point) => point[key] !== null && point[key] !== undefined);
      expect([0, present.length], `${key} drawn at ${drawn.length} of ${present.length} points`).toContain(drawn.length);
    }
  }
}

/** The bands the section draws: 16 to 24 only (Vahid, 18 Nov). */
const SHOWN_BANDS = ["16-24"];
/** The bands the section never draws, lists or exports. */
const HIDDEN_BANDS = BANDS.filter((band) => !SHOWN_BANDS.includes(band));

/**
 * By age's "Average change by age" card in its 16 to 24 band view: shown
 * when every single age from 16 to 24 is withheld (the fixture has no
 * single-age rows unless withSingleAges adds them) and the band is not.
 */
const meanCard = (container) => container.querySelector(".young-people-mean");

/** The Average change by age card, whichever view it shows. */
const ageCard = (container) => container.querySelector(".young-people-mean, .single-age-card");

/** The single-year view of Average change by age, 16 to 24 (the card opens on it when single ages are published). */
const singleYears = (container) => container.querySelector(".single-age-card");

/** The fixture with single-year rows 0 to 90+ for each key, less `without`'s. */
function withSingleAges(fixture, without = null) {
  const lines = [ALPHA, BETA, COMBINED].filter((id) => id !== without).flatMap((id) =>
    Array.from({ length: 91 }, (_, age) =>
      [id, id, YEAR, age === 90 ? "90+" : String(age), 10_000, 500, id === ALPHA ? 100 : id === BETA ? -50 : 50, 25, 20, 30, 50, 2_000].join(","),
    ),
  );
  return { ...fixture, ageCsv: [fixture.ageCsv, ...lines].join("\n") };
}

describe("By age's selection rule with a single that withholds its age bands", () => {
  it("reads the published package's own rows: the 16 to 24 band drawn, no withheld note", async () => {
    const { container } = await renderAge(withheldFixture(), [ALPHA, BETA]);
    expect(container.textContent).not.toMatch(/no published results by age/);
    // Average change by age: the package's net (50) for 16 to 24, no other
    // band, and no stack of the singles under it
    const bands = chartRows(container).find((rows) => rows.some((point) => point.band === "16-24"));
    expect(bands.map((point) => point.band)).toEqual(SHOWN_BANDS);
    expect(bands.map((point) => point.netChange)).toEqual([50]);
    expect(bands.every((point) => point[`measure:${ALPHA}`] === null)).toBe(true);
    // Average change by age: no note or caveat on the card, a one-line
    // subtitle, and no By policy option (the package's net is published
    // where a member's part is not)
    const card = meanCard(container);
    expect(within(card).getByText("Average change in household income per person, £ a year, with all the selected policies.")).toBeInTheDocument();
    expect(card.querySelector(".chart-footer .note, .chart-footer [class*='note']")).toBeNull();
    fireEvent.click(within(card).getByRole("button", { name: /About this chart/ }));
    expect(container.textContent).not.toMatch(DISCLOSURE);
    const pill = within(card).queryByRole("button", { name: /^Options:/ });
    if (pill) {
      fireEvent.click(pill);
      expect(within(card).queryByRole("radio", { name: "By policy" })).toBeNull();
    }
    // Change by year: 16 to 24 and all ages drawn in the published year
    const trend = chartRows(container).find((rows) => rows.some((point) => point.year === YEAR && "all" in point));
    const year = trend.find((point) => point.year === YEAR);
    for (const key of [...SHOWN_BANDS, "all"]) expect(year[key]).toBe(50);
    expect(document.querySelector(".young-people-trend .trend-headline")).toHaveTextContent(/gain about £50/);
    expectNoHalfDrawn(container);
  });

  it("draws another combination's published parts, with no net where a policy is withheld", async () => {
    const { container } = await renderAge(withheldFixture({ packagePublished: false }), [ALPHA, BETA]);
    const card = meanCard(container);
    const bands = chartRows(card).find((rows) => rows.some((point) => point.band === "16-24"));
    // Alpha's own part for 16 to 24; Beta's withheld, and so the net
    expect(bands.map((point) => point[`measure:${ALPHA}`])).toEqual([100]);
    expect(bands.every((point) => (point[`measure:${BETA}`] ?? null) === null && point.netChange === null)).toBe(true);
    // Change by year: all ages, where both publish, keeps its net; 16 to 24 does not
    const trend = chartRows(container).find((rows) => rows.some((point) => point.year === YEAR && "all" in point));
    const year = trend.find((point) => point.year === YEAR);
    expect(year.all).toBe(50);
    expect(year["16-24"]).toBeNull();
    expect(container.textContent).not.toMatch(DISCLOSURE);
  });

  it("draws the single alone with what it has, with no disclosure text", async () => {
    const { container } = await renderAge(withheldFixture(), [BETA]);
    const trend = chartRows(container).find((rows) => rows.some((point) => point.year === YEAR && "all" in point));
    expect(trend.find((point) => point.year === YEAR).all).toBe(-50);
    // No note under any plot: the reason sits in About this chart's caveats
    expect(container.querySelector(".chart-footer .note")).toBeNull();
    const trendCard = container.querySelector(".young-people-trend");
    expect(trendCard.textContent).not.toMatch(/Not drawn in/);
    fireEvent.click(within(trendCard).getByRole("button", { name: /About this chart/ }));
    expect(trendCard.textContent).not.toMatch(DISCLOSURE);
  });

  it("applies the same rule to single years of age", () => {
    const policies = [{ id: "a" }, { id: "b" }];
    const rows = [
      ...[10, 11, 12].map((age) => ({ reform_id: "a", year: YEAR, age_band: String(age), mean_change: 10, sample_size: 500 })),
      { reform_id: "b", year: YEAR, age_band: "10", mean_change: 5, sample_size: 500 },
      ...[10, 11, 12].map((age) => ({ reform_id: "pkg", year: YEAR, age_band: String(age), mean_change: 14, sample_size: 500 })),
    ];
    const bars = singleAgeBars(rows, policies, ["a", "b"], YEAR, 10, 12);
    const fromPackage = singleAgeSelection(bars, { rows, policies, selected: ["a", "b"], year: YEAR, packageRun: "pkg" });
    expect(fromPackage.map((point) => point.netChange)).toEqual([14, 14, 14]);
    // Every part at 10; at 11 and 12 the package's net is published and b
    // is missing, so no part sits beside it
    expect(fromPackage.map((point) => point.parts.length)).toEqual([2, 0, 0]);
    expect(fromPackage.map((point) => point.partsShown)).toEqual([true, false, false]);
    // The package withholds 11 and 12 too (#347): a's own part, no net
    const withheld = rows.filter((row) => !(row.reform_id === "pkg" && row.age_band !== "10"));
    const packageWithheld = singleAgeSelection(singleAgeBars(withheld, policies, ["a", "b"], YEAR, 10, 12), { rows: withheld, policies, selected: ["a", "b"], year: YEAR, packageRun: "pkg" });
    expect(packageWithheld.map((point) => point.netChange)).toEqual([14, null, null]);
    expect(packageWithheld.map((point) => point.parts.map((part) => part.id))).toEqual([["a", "b"], ["a"], ["a"]]);
    expect(packageWithheld.map((point) => point.a)).toEqual([undefined, undefined, undefined]);
    expect(packageWithheld[1]["measure:a"]).toBe(10);
    // Another combination: the sum where both publish, a's part alone elsewhere
    const combination = singleAgeSelection(bars, { rows, policies, selected: ["a", "b"], year: YEAR });
    expect(combination.map((point) => point.netChange)).toEqual([15, null, null]);
    expect(combination.map((point) => point.parts.length)).toEqual([2, 1, 1]);
    const alone = singleAgeSelection(singleAgeBars(rows, policies, ["b"], YEAR, 10, 12), { rows, policies, selected: ["b"], year: YEAR });
    expect(alone.map((point) => point.netChange)).toEqual([5, null, null]);
  });
});

describe("Average change by age with a package whose every member has rows by age", () => {
  it("opens on By policy, each policy's part stacked under the package's net, and keeps the reader's choice", async () => {
    const { container } = await renderAge(measureCatalogueFixture({ held: false }), [ALPHA, BETA]);
    const card = meanCard(container);
    const bandRows = () => chartRows(container.querySelector(".young-people-mean")).find((rows) => rows.some((point) => point.band === "16-24"));
    // By default (Vahid, 29 October): each policy's own rows stacked under the package's net
    expect(bandRows().map((point) => point[`measure:${ALPHA}`])).toEqual([100]);
    expect(bandRows().map((point) => point[`measure:${BETA}`])).toEqual([-50]);
    expect(bandRows().map((point) => point.netChange)).toEqual([50]);
    // By policy is the default, so the pill does not name it
    expect(within(card).getByRole("button", { name: /^Options:/ }).getAttribute("aria-label") ?? "").not.toMatch(/By policy/);
    fireEvent.click(within(card).getByRole("button", { name: /^Options:/ }));
    expect(within(card).getByRole("radio", { name: "By policy" })).toHaveAttribute("aria-checked", "true");
    // All selected policies: the package's own net, no policy parts
    fireEvent.click(within(card).getByRole("radio", { name: "All selected policies" }));
    expect(bandRows().map((point) => point.netChange)).toEqual([50]);
    expect(bandRows().every((point) => point[`measure:${ALPHA}`] === null)).toBe(true);
    expect(within(card).getByText("Average change in household income per person, £ a year, with all the selected policies.")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: /^Options:.*All selected policies/ })).toBeInTheDocument();
    // No caveat: nothing is withheld
    fireEvent.click(within(card).getByRole("button", { name: /About this chart/ }));
    expect(card.textContent).not.toMatch(DISCLOSURE);
  });
});

describe("Young people shows 16 to 24 and all ages only (Vahid, 18 Nov)", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  /** Every radio in a card's Options, the pill opened (none when it has no pill). */
  function radios(card) {
    const pill = within(card).queryByRole("button", { name: /^Options:/ });
    if (!pill) return [];
    fireEvent.click(pill);
    return within(card).queryAllByRole("radio").map((radio) => radio.getAttribute("aria-label") ?? radio.textContent);
  }

  it("opens Average change by age on 16 to 24 by single year of age, with no age group or view choice", async () => {
    const { container } = await renderAge(withSingleAges(measureCatalogueFixture({ held: false })), [ALPHA, BETA]);
    const card = singleYears(container);
    expect(card).not.toBeNull();
    expect(container.querySelector(".young-people-mean")).toBeNull();
    expect(card).toHaveTextContent("at each age from 16 to 24");
    const ages = chartRows(card).find((rows) => rows.some((point) => point.label === "20"));
    expect(ages.map((point) => point.label)).toEqual(["16", "17", "18", "19", "20", "21", "22", "23", "24"]);
    for (const selector of [".single-age-card", ".young-people-trend", ".young-people-measures", ".young-people-shares"]) {
      const each = container.querySelector(selector);
      if (!each) continue;
      const names = radios(each).join(" | ");
      expect(names, selector).not.toMatch(/25 to 34|Under 16|35 to 49|50 to 64|65 and over|Pensioners|Age groups|Every age group/);
    }
  });

  it("leaves an old link's ?age= in the address without reading it", async () => {
    window.history.replaceState(null, "", "/?age=25-34");
    const { container } = await renderAge(withSingleAges(measureCatalogueFixture({ held: false })), [ALPHA, BETA]);
    expect(singleYears(container)).toHaveTextContent("at each age from 16 to 24");
    expect(container.textContent).not.toMatch(/25 to 34/);
    expect(new URLSearchParams(window.location.search).get("age")).toBe("25-34");
  });

  it("sets Effect of each policy's 16 to 24 against all ages, with no Compare choice", async () => {
    const { container } = await renderAge(withSingleAges(measureCatalogueFixture({ held: false })), [ALPHA, BETA]);
    const measures = container.querySelector(".young-people-measures");
    const legend = measures.querySelector(".measure-dumbbell-legend");
    expect(legend).toHaveTextContent("16 to 24");
    expect(legend).toHaveTextContent("All ages");
    expect(legend).not.toHaveTextContent("25 to 34");
    expect(within(measures).queryByRole("button", { name: /^Options:/ })).toBeNull();
  });

  it("draws Change by year's lines for 16 to 24 and all ages only, with no note on other ages", async () => {
    const { container } = await renderAge(measureCatalogueFixture({ held: false }), [ALPHA, BETA]);
    const trend = container.querySelector(".young-people-trend");
    expect(trend.textContent).not.toMatch(/Other ages|share a household/);
    expect(container.textContent).not.toMatch(/ages the policy does not target/);
    // The line chips: 16 to 24 and all ages, no other group
    const legend = trend.querySelector(".chart-legend");
    expect(legend).toHaveTextContent("16 to 24");
    expect(legend).toHaveTextContent("All ages");
    expect(legend.textContent).not.toMatch(/Under 16|25 to 34|35 to 49|50 to 64|65 and over|Other ages/);
    expect(HIDDEN_BANDS).toHaveLength(5);
  });
});

describe("Average change by age by single year of age, 16 to 24", () => {
  const singleCard = (container) => singleYears(container);
  const ageRows = (card) => chartRows(card).find((rows) => rows.some((point) => point.label === "20"));

  it("shows single years, with each policy's part offered as By policy when every member has rows", async () => {
    const { container } = await renderAge(withSingleAges(measureCatalogueFixture({ held: false })), [ALPHA, BETA]);
    const card = singleCard(container);
    expect(card).not.toBeNull();
    expect(container.querySelector(".young-people-mean")).toBeNull();
    expect(ageRows(card).every((point) => point.netChange === 50)).toBe(true);
    fireEvent.click(within(card).getByRole("button", { name: /^Options:/ }));
    fireEvent.click(within(card).getByRole("radio", { name: "Each policy" }));
    expect(within(card).getAllByTestId("series").map((node) => node.dataset.key).sort()).toEqual([`measure:${ALPHA}`, `measure:${BETA}`]);
  });

  it("drops the Show choice beside a published package net with a member's single years missing, with no caveat", async () => {
    const { container } = await renderAge(withSingleAges(withheldFixture(), BETA), [ALPHA, BETA]);
    const card = singleCard(container);
    // The package's own net at every age, never its parts
    expect(ageRows(card).every((point) => point.netChange === 50 && (point[`measure:${ALPHA}`] ?? null) === null)).toBe(true);
    // One usable option reads as broken (team feedback, 28 October): no Show
    // group, and with no other choice no Options pill at all
    expect(within(card).queryByRole("button", { name: /^Options:/ })).toBeNull();
    expect(within(card).queryByRole("radio", { name: "Each policy" })).toBeNull();
    expect(within(card).queryByRole("radio", { name: "Net change" })).toBeNull();
    expect(within(card).queryByText(/^Each policy:/)).toBeNull();
    fireEvent.click(within(card).getByRole("button", { name: /About this chart/ }));
    expect(card.textContent).not.toMatch(DISCLOSURE);
    // No part drawn, not even the policy with rows: beside the package's
    // published net, it would give the withheld policy's part back by
    // difference
    expect(within(card).getAllByTestId("series").map((node) => node.dataset.key)).toEqual(["netChange"]);
  });

  it("draws the other policy's part, with no net, at the ages a member and the package withhold (issue 340)", async () => {
    // BETA leaves out ages 20 and 21, and so does the package
    const fixture = withSingleAges(measureCatalogueFixture({ held: false }));
    const [header, ...lines] = fixture.ageCsv.split("\n");
    const kept = lines.filter((line) => {
      const [id, , , band] = line.split(",");
      return !((id === BETA || id === COMBINED) && ["20", "21"].includes(band));
    });
    const { container } = await renderAge({ ...fixture, ageCsv: [header, ...kept].join("\n") }, [ALPHA, BETA]);
    const card = singleCard(container);
    const points = () => chartRows(card).find((rows) => rows.some((point) => point.label === "22"));
    const byAge = () => Object.fromEntries(points().map((point) => [point.label, point]));
    expect(["20", "21", "22"].map((age) => byAge()[age].netChange)).toEqual([null, null, 50]);
    // By policy: alpha's own part at 20 and 21, beta's left out, no net
    fireEvent.click(within(card).getByRole("button", { name: /^Options:/ }));
    fireEvent.click(within(card).getByRole("radio", { name: "Each policy" }));
    expect(within(card).getAllByTestId("series").map((node) => node.dataset.key).sort()).toEqual([`measure:${ALPHA}`, `measure:${BETA}`]);
    expect(["20", "21", "22"].map((age) => byAge()[age][`measure:${ALPHA}`])).toEqual([100, 100, 100]);
    expect(["20", "21", "22"].map((age) => byAge()[age][`measure:${BETA}`] ?? null)).toEqual([null, null, -50]);
    fireEvent.click(within(card).getByRole("button", { name: /About this chart/ }));
    expect(card.textContent).not.toMatch(DISCLOSURE);
  });

  it("lists no policy as having no effect when it draws the package's net alone", async () => {
    // The bars show the package's gains, so no policy is "no change for the
    // households shown" (Vahid, 28 October: 16 to 24 in 2031-32 listed all 8)
    const { container } = await renderAge(withSingleAges(withheldFixture(), BETA), [ALPHA, BETA]);
    const card = singleCard(container);
    fireEvent.click(within(card).getByRole("button", { name: /About this chart/ }));
    expect(card.querySelectorAll("[data-zero-measure]")).toHaveLength(0);
    expect(within(card).queryByText(/No effect on household incomes/)).toBeNull();
  });

  it("draws no parts beside the package's published net in Change by year's Policies view, with no caveat", async () => {
    const { container } = await renderAge(withheldFixture(), [ALPHA, BETA]);
    const trend = container.querySelector(".young-people-trend");
    fireEvent.click(within(trend).getByRole("button", { name: /^Options:/ }));
    fireEvent.click(within(trend).getByRole("radio", { name: /^Policies,/ }));
    expect(within(trend).queryAllByTestId("series").map((node) => node.dataset.key)).not.toContain(`measure:${ALPHA}`);
    fireEvent.click(within(trend).getByRole("button", { name: /About this chart/ }));
    expect(trend.textContent).not.toMatch(DISCLOSURE);
  });
});

describe("Average change by age when the package withholds every single age", () => {
  // The members have single years, the package none (a package withholds
  // what its members withhold, #347); `bands` keeps or drops its age bands
  function packageWithoutSingleAges({ bands = true } = {}) {
    const fixture = withSingleAges(measureCatalogueFixture({ held: false }), COMBINED);
    if (bands) return fixture;
    const [header, ...lines] = fixture.ageCsv.split("\n");
    const kept = lines.filter((line) => {
      const [id, , , band] = line.split(",");
      return !(id === COMBINED && BANDS.includes(band));
    });
    return { ...fixture, ageCsv: [header, ...kept].join("\n") };
  }

  it("falls back to the 16 to 24 band, with no note and no view choice, when no single age from 16 to 24 is published", async () => {
    // No single-age rows at all: nothing for the single-year view to draw
    const { container } = await renderAge(measureCatalogueFixture({ held: false }), [ALPHA, BETA]);
    expect(container.querySelector(".single-age-card")).toBeNull();
    const card = container.querySelector(".young-people-mean");
    expect(card).not.toBeNull();
    // No note on the card (Vahid, 29 October)
    expect(card.querySelector(".note")).toBeNull();
    expect(card.textContent).not.toMatch(/Single ages not published/);
    expect(card.textContent).not.toMatch(/Not shown: too few survey records at every age/);
    // The package's own net for 16 to 24, no other band
    const bands = chartRows(card).find((rows) => rows.some((point) => point.band === "16-24"));
    expect(bands.map((point) => point.band)).toEqual(SHOWN_BANDS);
    expect(bands.map((point) => point.netChange)).toEqual([50]);
    const pill = within(card).queryByRole("button", { name: /^Options:/ });
    if (pill) fireEvent.click(pill);
    expect(within(card).queryByRole("radio", { name: "Single year of age" })).toBeNull();
    expect(within(card).queryByRole("radio", { name: "Age groups" })).toBeNull();
    // No explanation line, no confidentiality wording anywhere on the card
    expect(card.querySelector(".control-bar-note")).toBeNull();
    expect(container.querySelector(".young-people-mean").textContent).not.toMatch(/confidential|not published for this selection/i);
  });

  it("offers the single-age view for a policy alone that has its single ages", async () => {
    const { container } = await renderAge(packageWithoutSingleAges(), [ALPHA]);
    const card = singleYears(container);
    expect(card).not.toBeNull();
    expect(container.querySelector(".young-people-mean")).toBeNull();
  });

  it("draws each policy's own parts, with no net, where the package withholds its bands too", async () => {
    const { container } = await renderAge(packageWithoutSingleAges({ bands: false }), [ALPHA, BETA]);
    const card = singleYears(container);
    expect(card).not.toBeNull();
    expect(container.querySelector(".young-people-mean")).toBeNull();
    // Net change: nothing to draw, a plain line with no reason given
    expect(card.textContent).toMatch(/No figures for this selection in 2029-30\./);
    expect(card.textContent).not.toMatch(DISCLOSURE);
    // By policy: each member's own published part at every age, no net
    fireEvent.click(within(card).getByRole("button", { name: /^Options:/ }));
    fireEvent.click(within(card).getByRole("radio", { name: "Each policy" }));
    const rows = chartRows(card).find((each) => each.some((point) => point.label === "20"));
    expect(rows.every((point) => point.netChange === null && point[`measure:${ALPHA}`] === 100 && point[`measure:${BETA}`] === -50)).toBe(true);
  });
});

describe("Gains and losses when the package withholds every single age", () => {
  // As Average change by age above: the members have single years, the
  // package none; its age bands are published
  const packageWithoutSingleAges = () => withSingleAges(measureCatalogueFixture({ held: false }), COMBINED);

  /** The card's View radios, its Options opened. */
  function viewRadios(card) {
    fireEvent.click(within(card).getByRole("button", { name: /^Options:/ }));
    return {
      band: within(card).getByRole("radio", { name: "16 to 24 and all ages" }),
      single: within(card).getByRole("radio", { name: "By single year of age" }),
    };
  }

  it("shows 16 to 24 and all ages, with By single year of age disabled and no note", async () => {
    const { container } = await renderAge(packageWithoutSingleAges(), [ALPHA, BETA]);
    const card = container.querySelector(".young-people-shares");
    // Withheld for now (povertyFigures.js): no Gains and losses card, in
    // its fallback too; PovertyFiguresShown.test.jsx checks it comes back
    if (!POVERTY_FIGURES_SHOWN) {
      expect(card).toBeNull();
      return;
    }
    expect(card).not.toBeNull();
    const { band, single } = viewRadios(card);
    expect(band).toHaveAttribute("aria-checked", "true");
    expect(single).toBeDisabled();
    expect(single).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(single);
    expect(within(card).getByRole("radio", { name: "16 to 24 and all ages" })).toHaveAttribute("aria-checked", "true");
    // The two groups drawn, not the empty panel, and no note or explanation line
    expect(card.textContent).not.toMatch(/No shares are published/);
    expect(card.textContent).not.toMatch(/confidential|not published for this selection|too few survey records/i);
    expect(card.textContent).not.toMatch(/Under 16|25 to 34|35 to 49|50 to 64|65 and over|ages the policy does not target/);
    expect(card.querySelector(".note, .control-bar-note")).toBeNull();
  });

  it("keeps the reader's By single year of age, 16 to 24, where the package has its single ages", async () => {
    const { container } = await renderAge(withSingleAges(measureCatalogueFixture({ held: false })), [ALPHA, BETA]);
    const card = container.querySelector(".young-people-shares");
    if (!POVERTY_FIGURES_SHOWN) {
      expect(card).toBeNull();
      return;
    }
    const { single } = viewRadios(card);
    expect(single).not.toBeDisabled();
    fireEvent.click(single);
    expect(within(card).getByRole("radio", { name: "By single year of age" })).toHaveAttribute("aria-checked", "true");
    expect(card.textContent).toMatch(/at each age from 16 to 24/);
  });
});

describe("The single-year age axis", () => {
  it("ticks every five years to 90+ on a wide screen and every ten on a phone, with no State Pension age tick", () => {
    expect(windowTicks([0, 90], [], false)).toEqual([...Array.from({ length: 18 }, (_, i) => String(i * 5)), "90+"]);
    expect(windowTicks([0, 90], [], true)).toEqual(["0", "10", "20", "30", "40", "50", "60", "70", "80", "90+"]);
    expect(windowTicks([55, 90], [], false)).toEqual(["55", "60", "65", "70", "75", "80", "85", "90+"]);
  });

  it("drops a five-year tick too close to the group's ends", () => {
    expect(windowTicks([6, 34], [16, 24], false)).toEqual(["6", "10", "16", "20", "24", "30", "34"]);
  });

  it("covers only the group's own ages (16 to 24 is 16 to 24, not 6 to 34)", () => {
    expect(windowTicks([16, 24], [], false)).toEqual(["16", "20", "24"]);
    expect(agesText([16, 24])).toBe("16 to 24");
    expect(agesText([67, 90])).toBe("67 to 90 and over");
  });
});
