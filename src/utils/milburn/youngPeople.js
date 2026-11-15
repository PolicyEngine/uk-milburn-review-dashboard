/**
 * Figures on young people read from the verified results the page already
 * loads (the age_impact table of each verified artifact). Each is null when
 * its row or column is missing: never a zero standing in for a missing
 * figure.
 */

/** The age band the review's "young people" maps to in the age table. */
export const YOUNG_BAND = "16-24";

const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

/**
 * People aged 16 to 24 in households whose net income falls under a run
 * (`people` x `pct_worse_off` / 100 on the age table's 16-24 row): the
 * young people the run leaves worse off, static, in `year`. Null without
 * that row or either column.
 *
 * @param {Array<Object>|null} rows - age_impact rows
 * @param {string} reformId
 * @param {number} year - The fiscal year's first calendar year (2027 is 2027-28)
 * @returns {number|null}
 */
export function youngPeopleWorseOff(rows, reformId, year) {
  if (!Array.isArray(rows) || !reformId) return null;
  const row = rows.find(
    (candidate) =>
      candidate.reform_id === reformId &&
      Number(candidate.year) === Number(year) &&
      String(candidate.age_band) === YOUNG_BAND,
  );
  if (!row) return null;
  const people = finite(row.people);
  const share = finite(row.pct_worse_off);
  if (people === null || share === null) return null;
  return (people * share) / 100;
}
