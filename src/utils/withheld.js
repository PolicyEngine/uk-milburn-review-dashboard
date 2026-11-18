/**
 * One label for every figure the disclosure floor withholds (an empty cell
 * in a run's CSV, null in milburn_summary.json): chart slots, tiles and
 * table rows all say this, never "not yet published" or "no change".
 * A figure can be withheld for resting on one or two survey households, or
 * under a partner rule, because it would let such a figure be worked out
 * (disclosure_floor.apply_flat_floor), so the short label names neither.
 */
export const WITHHELD_LABEL = "Withheld to protect survey households";

/** The longer form, for tooltips and notes. */
export const WITHHELD_DETAIL =
  "Withheld: this figure rests on fewer than 3 survey households, or would let such a figure be worked out.";

/** The floor and its partner rules, said once on Methodology. */
export const WITHHELD_METHOD =
  "We withhold any figure that rests on one or two survey households. We also withhold figures that would let a reader work one out, such as the total for a group with a withheld band, or the average gain where too few households lose.";

/** "Withheld for 2028-29": a year's figure that the floor withholds. */
export const withheldFor = (yearText) => `Withheld for ${yearText}.`;

/**
 * Whether a published row withholds a figure: the row is there and its
 * cell is empty (CSV) or null (JSON). No row, or a row without the column
 * (a file written before it), is not published, never withheld.
 */
export function isWithheldCell(row, key) {
  if (!row || typeof row !== "object" || !Object.hasOwn(row, key)) return false;
  const raw = row[key];
  return raw === null || (typeof raw === "string" && raw.trim() === "");
}
