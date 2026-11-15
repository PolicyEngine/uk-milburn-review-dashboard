/**
 * The package's combined run, read from its verified artifact.
 *
 * The catalogue names a combined run (`combinedId`) only when it covers
 * exactly the displayable measures. The Milburn package combines two of
 * the measures, so the catalogue leaves it unnamed and the shared table
 * loaders drop its rows. This reads it directly: the one combined run the
 * manifest lists and the page verified, through the same receipt checks
 * (loadArtifact), gated by its manifest entry and its members' years.
 * Never another file, and null where it is missing.
 */
import { useEffect, useState } from "react";
import { loadArtifact } from "../publication/load";
import { isDisplayable } from "../publication/manifest";
import { isSupported } from "../publication/select";

/**
 * The package run's key: the catalogue's combined run, else the one
 * displayable combined run the manifest lists and the page verified, else
 * null (none, or several to choose between).
 */
export function packageKeyOf(catalogue) {
  // The local build route: the package is a run of its own, shown only once
  // its folder has been read (utils/milburn/localBuild.js)
  if (catalogue?.localBuild) {
    const key = catalogue.localBuild.packageId;
    return key && catalogue.byId?.get(key)?.displayable ? key : null;
  }
  if (catalogue?.combinedId) return catalogue.combinedId;
  const combined = catalogue?.manifest?.combined;
  if (!combined || !catalogue.tablesByKey) return null;
  const keys = Object.keys(combined).filter(
    (key) => isDisplayable(combined[key]) && Object.hasOwn(catalogue.tablesByKey, key) && !catalogue.failures?.[key],
  );
  return keys.length === 1 ? keys[0] : null;
}

/** Whether a package row's year is published for the run and every member. */
export function packageYearShown(catalogue, key, year) {
  if (catalogue?.localBuild) {
    const run = catalogue.manifest?.measures?.[key];
    return Boolean(run) && isDisplayable(run) && isSupported(run, Number(year));
  }
  const entry = catalogue?.manifest?.combined?.[key];
  if (!entry || !isDisplayable(entry) || !isSupported(entry, Number(year))) return false;
  return (entry.measures ?? []).every((member) => {
    const memberEntry = catalogue.manifest.measures[member];
    return memberEntry ? isSupported(memberEntry, Number(year)) : false;
  });
}

// One load per catalogue, key and table
const loads = new WeakMap();

/** The package run's rows of one table, or [] when it has none. */
export function loadPackageTable(catalogue, key, table, { basePath = process.env.NEXT_PUBLIC_BASE_PATH || "" } = {}) {
  if (!catalogue || typeof catalogue !== "object" || !key) return Promise.resolve([]);
  let cache = loads.get(catalogue);
  if (!cache) loads.set(catalogue, (cache = new Map()));
  const id = `${key}\u0000${table}`;
  if (!cache.has(id) && catalogue.localBuild) {
    // Loaded with the catalogue: the run's own rows, its years only
    const rows = catalogue.tablesByKey?.[key]?.[table] ?? [];
    cache.set(id, Promise.resolve(rows.filter((row) => row.reform_id === key && packageYearShown(catalogue, key, row.year))));
  }
  if (!cache.has(id)) {
    const entry = catalogue.manifest?.combined?.[key] ?? catalogue.manifest?.measures?.[key];
    const promise = loadArtifact(basePath, key, entry, { tables: [table] })
      .then((tables) => (tables[table] ?? []).filter((row) => row.reform_id === key && packageYearShown(catalogue, key, row.year)))
      .catch((error) => {
        cache.delete(id);
        throw error;
      });
    cache.set(id, promise);
  }
  return cache.get(id);
}

/**
 * The package run's rows of one table: { status: "loading"|"ready"|
 * "unavailable", rows }. Unavailable without a package run or its table.
 */
export function usePackageTable(catalogue, table) {
  const key = packageKeyOf(catalogue);
  const [state, setState] = useState({ for: null, status: "loading", rows: null });
  useEffect(() => {
    let cancelled = false;
    if (!key) return undefined;
    loadPackageTable(catalogue, key, table)
      .then((rows) => {
        if (!cancelled) setState({ for: catalogue, status: rows.length ? "ready" : "unavailable", rows: rows.length ? rows : null });
      })
      .catch(() => {
        if (!cancelled) setState({ for: catalogue, status: "unavailable", rows: null });
      });
    return () => {
      cancelled = true;
    };
  }, [catalogue, key, table]);
  if (!key) return { key: null, status: catalogue?.manifest ? "unavailable" : "loading", rows: null };
  return state.for === catalogue ? { key, ...state } : { key, status: "loading", rows: null };
}
