/**
 * The local build data route: the Milburn review's figures from the flat
 * results the pipeline writes on Microcosm build 6f918b81 with
 * policyengine-uk 2.177.7 (docs/milburn-local-run.md).
 *
 * The verified publication route (manifest.json and receipted artifacts,
 * utils/publication/) cannot run on this build: its receipts are bound to
 * policyengine.py's certified bundle. This route is separate from it and
 * never touches its checks. It reads:
 *
 * - public/data/milburn_measures.json: every candidate measure, computable
 *   (with a description) or not (with the reason, no figure);
 * - public/data/milburn/<measure_id>/: one national run per measure (and
 *   one for the package), written by `uk-budget-data generate`:
 *   budgetary_impact.csv, distributional_impact.csv, winners_losers.csv,
 *   metrics.csv, age_impact.csv and model_build.json (the label,
 *   `"certified": false`).
 *
 * It turns them into the parts loadDashboard's dashboardFromParts takes (a
 * manifest-shaped catalogue and each run's typed tables), so the charts are
 * the same components. Each run is a measure of its own, the package
 * included: runs are never summed on the page (the package carries its
 * members' interactions). A run whose folder or build record is missing is
 * "not yet run", never zero.
 */

import { parseFlatTable, parseTable } from "../publication/csv";

export const LOCAL_BUILD_ROUTE = "local-build";
export const MEASURES_FILE = "milburn_measures.json";
export const RUNS_DIR = "milburn";
export const BUILD_RECORD_FILE = "model_build.json";
export const NOT_YET_RUN = "Not yet run";

/** The tables each run's folder holds, by table name. */
export const LOCAL_TABLES = Object.freeze({
  budgetary_impact: "budgetary_impact.csv",
  distributional_impact: "distributional_impact.csv",
  winners_losers: "winners_losers.csv",
  metrics: "metrics.csv",
  age_impact: "age_impact.csv",
});

/**
 * Tables a run's folder may hold besides: the binned household scatter
 * (All households), shown where present, unavailable where not.
 */
export const OPTIONAL_LOCAL_TABLES = Object.freeze({
  household_scatter_binned: "household_scatter_binned.csv",
});

// Read as flat files: metrics.csv carries the poverty and inequality
// columns after its contract columns (csv.js FLAT_EXTRA_COLUMNS)
const FLAT_PARSED = new Set(["metrics"]);

/**
 * Whether this build reads the local build route: NEXT_PUBLIC_DATA_ROUTE,
 * which next.config.ts sets to "local-build" when
 * public/data/milburn_measures.json exists (unless the environment names
 * another route).
 */
export function isLocalBuildRoute(env = process.env.NEXT_PUBLIC_DATA_ROUTE) {
  return env === LOCAL_BUILD_ROUTE;
}

const text = (value) => (typeof value === "string" ? value.trim() : "");

/**
 * milburn_measures.json, checked: the computable measures (id, name,
 * description, first year, members for the package) and the not-computable
 * ones (with their reason). Null when it is not that file.
 */
export function parseMeasuresFile(json) {
  if (!json || typeof json !== "object" || !Array.isArray(json.measures)) return null;
  const computable = [];
  const notComputable = [];
  const seen = new Set();
  for (const measure of json.measures) {
    const id = text(measure?.id);
    if (!id || seen.has(id) || !/^[a-z0-9_]+$/.test(id)) continue;
    seen.add(id);
    const base = { id, name: text(measure.name) || id, description: text(measure.description) };
    if (measure.status === "computable") {
      computable.push({
        ...base,
        firstYear: Number.isInteger(measure.first_year) ? measure.first_year : null,
        members: Array.isArray(measure.measures) ? measure.measures.filter((member) => typeof member === "string") : [],
      });
    } else if (measure.status === "not_computable") {
      notComputable.push({ ...base, reason: text(measure.reason) });
    }
  }
  return { build: text(json.build), computable, notComputable };
}

/**
 * A run's model_build.json, checked: null unless it states the label, is
 * not certified, names the run and lists its years. The pipeline writes it
 * after the tables, so a folder without it is a run still in progress.
 */
export function parseBuildRecord(json, id) {
  if (!json || typeof json !== "object") return null;
  const label = text(json.label);
  const years = Array.isArray(json.years) ? json.years.filter((year) => Number.isInteger(year)) : [];
  if (!label || json.certified !== false || !years.length) return null;
  if (!Array.isArray(json.measures) || !json.measures.includes(id)) return null;
  const engine = json.engine && typeof json.engine === "object" && !Array.isArray(json.engine)
    ? Object.fromEntries(Object.entries(json.engine).filter(([, version]) => typeof version === "string"))
    : {};
  return { label, certified: false, build: text(json.build), datasetSha256: text(json.dataset_sha256), engine, years: [...years].sort((a, b) => a - b) };
}

/**
 * One run's tables from its files' text, typed as the verified route types
 * them (csv.js), with only the run's own rows. Throws on a file that is not
 * the table the pipeline writes.
 *
 * @param {string} id - The run (a measure id, or the package's)
 * @param {Object<string, string>} files - Text by table name
 * @returns {Object<string, Array<Object>>}
 */
export function runTables(id, files) {
  const tables = {};
  for (const table of Object.keys(LOCAL_TABLES)) {
    if (typeof files[table] !== "string") throw new Error(`${LOCAL_TABLES[table]} is missing`);
    const rows = FLAT_PARSED.has(table) ? parseFlatTable(table, files[table]) : parseTable(table, files[table]);
    const other = rows.find((row) => row.reform_id !== id);
    if (other) throw new Error(`${LOCAL_TABLES[table]} has rows for ${other.reform_id}, not ${id}`);
    tables[table] = rows;
  }
  for (const table of Object.keys(OPTIONAL_LOCAL_TABLES)) {
    if (typeof files[table] !== "string") continue;
    const rows = parseTable(table, files[table]);
    const other = rows.find((row) => row.reform_id !== id);
    if (other) throw new Error(`${OPTIONAL_LOCAL_TABLES[table]} has rows for ${other.reform_id}, not ${id}`);
    tables[table] = rows;
  }
  return tables;
}

// A short digest of what the page shows, so the views start afresh when a
// run is added or rewritten (App.jsx keys the views on it)
function fingerprint(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * The parts dashboardFromParts builds the page from, for the local route.
 *
 * @param {Object} measuresFile - parseMeasuresFile's result
 * @param {Object<string, {record: Object, tables: Object}|{error: string}|null>} runs -
 *   By computable measure id: the run's checked build record and tables, an
 *   error for a folder that could not be read, or null for no folder
 */
export function localBuildParts(measuresFile, runs = {}) {
  const measures = {};
  const tablesByKey = {};
  const failures = {};
  const notRun = [];
  const labels = new Set();
  for (const measure of measuresFile.computable) {
    const run = runs[measure.id] ?? null;
    const entry = { name: measure.name, description: measure.description, years: [], unsupported_years: [] };
    if (run?.record && run.tables) {
      measures[measure.id] = { ...entry, status: "provisional", years: [...run.record.years] };
      tablesByKey[measure.id] = { ...run.tables, engine: { ...run.record.engine }, record: run.record };
      labels.add(run.record.label);
    } else if (run?.error) {
      measures[measure.id] = { ...entry, status: "staged" };
      failures[measure.id] = run.error;
    } else {
      measures[measure.id] = { ...entry, status: "staged" };
      notRun.push(measure.id);
    }
  }
  const ran = Object.keys(tablesByKey).sort();
  const label = labels.size === 1 ? [...labels][0] : labels.size ? [...labels].sort().join("; ") : measuresFile.build;
  const snapshotSha256 = `local-build-${fingerprint(JSON.stringify([ran, Object.keys(failures).sort(), ran.map((id) => tablesByKey[id].record), ran.map((id) => tablesByKey[id].budgetary_impact)]))}`;
  const localBuild = {
    label,
    certified: false,
    notRun,
    notComputable: measuresFile.notComputable,
    // The package: the run milburn_measures.json lists with its members
    packageId: measuresFile.computable.find((measure) => measure.members.length > 1)?.id ?? null,
  };
  const manifest = { localBuild: true, revision: 1, measures, combined: {} };
  // As a verified manifest carries it: not enumerable
  Object.defineProperty(manifest, "snapshotSha256", { value: snapshotSha256 });
  return { status: "ready", manifest, snapshotSha256, tablesByKey, failures, localBuild };
}

/**
 * The catalogue's finishing touches on the local route: the route's own
 * facts (label, runs not yet made, measures not computable), and each
 * measure not yet run says so rather than "awaiting approval".
 */
export function finishLocalCatalogue(catalogue, parts) {
  catalogue.localBuild = parts.localBuild;
  for (const id of parts.localBuild.notRun) {
    const measure = catalogue.byId.get(id);
    if (measure) measure.availability = { available: false, status: null, reason: NOT_YET_RUN };
  }
  for (const [id, reason] of Object.entries(parts.failures ?? {})) {
    const measure = catalogue.byId.get(id);
    if (measure) measure.availability = { available: false, status: null, reason: `Results unavailable: ${reason}` };
  }
  return catalogue;
}

async function fetchText(fetchImpl, url, signal) {
  const response = await fetchImpl(url, { signal, cache: "no-cache" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

/** One run's folder: its record and tables, null for none, or an error. */
export async function loadRun(id, { basePath = "", fetchImpl = fetch, signal } = {}) {
  const folder = `${basePath}/data/${RUNS_DIR}/${id}`;
  try {
    const recordText = await fetchText(fetchImpl, `${folder}/${BUILD_RECORD_FILE}`, signal);
    if (recordText === null) return null;
    let recordJson;
    try {
      recordJson = JSON.parse(recordText);
    } catch {
      // Served by a dev server's fallback page, or written in part
      return null;
    }
    const record = parseBuildRecord(recordJson, id);
    if (!record) return { error: `${BUILD_RECORD_FILE} does not state an uncertified run of ${id}` };
    const texts = await Promise.all(Object.entries(LOCAL_TABLES).map(async ([table, file]) => [table, await fetchText(fetchImpl, `${folder}/${file}`, signal)]));
    const missing = texts.filter(([, value]) => value === null).map(([table]) => LOCAL_TABLES[table]);
    if (missing.length) return { error: `${missing.join(", ")} missing` };
    const optional = await Promise.all(Object.entries(OPTIONAL_LOCAL_TABLES).map(async ([table, file]) => [table, await fetchText(fetchImpl, `${folder}/${file}`, signal)]));
    const files = Object.fromEntries([...texts, ...optional.filter(([, value]) => value !== null)]);
    return { record, tables: runTables(id, files) };
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    return { error: error.message };
  }
}

/**
 * Load the local route: milburn_measures.json, then every computable
 * measure's folder. Resolves to dashboardFromParts' parts, or
 * `{status: "no-manifest"}` without the measures file.
 */
export async function loadLocalBuildParts(basePath = "", { fetchImpl = fetch, signal } = {}) {
  const measuresText = await fetchText(fetchImpl, `${basePath}/data/${MEASURES_FILE}`, signal);
  if (measuresText === null) return { status: "no-manifest" };
  const measuresFile = parseMeasuresFile(JSON.parse(measuresText));
  if (!measuresFile) throw new Error(`${MEASURES_FILE} lists no measures`);
  const runs = Object.fromEntries(
    await Promise.all(measuresFile.computable.map(async (measure) => [measure.id, await loadRun(measure.id, { basePath, fetchImpl, signal })])),
  );
  return localBuildParts(measuresFile, runs);
}

/**
 * One table's rows on the local route, as loadVerifiedTables returns them:
 * every run's rows, already loaded with the catalogue. A table the flat
 * run's folder does not hold (the binned household scatter, where it was not
 * written) gives no rows for it, and the run is listed as failed for it, so
 * the view shows it unavailable.
 */
export function localTableRows(catalogue, table, isShown) {
  const keys = Object.keys(catalogue.tablesByKey ?? {});
  const failures = keys.filter((key) => !Array.isArray(catalogue.tablesByKey[key][table]));
  const rows = keys.flatMap((key) => catalogue.tablesByKey[key][table] ?? []).filter((row) => isShown(catalogue, row.reform_id, row.year));
  return { rows, failures };
}

/**
 * The line the page's provisional notice carries on the local route: the
 * build's label, and that no certificate covers it.
 */
export function localBuildNotice(localBuild) {
  return localBuild?.label ? `Local build: ${localBuild.label}, not certified` : "";
}
