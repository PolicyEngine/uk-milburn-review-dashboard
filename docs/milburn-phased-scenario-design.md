# Moves into work: a phased scenario using the review's figures (design)

Design for item 7 of María's review (issue #6): replace the "Moves into work
(illustrative)" tab's flat 25% on the pre-report package with a scenario
on the report package that phases moves into work over 2027-28 to 2031-32,
using figures the review publishes. Nothing here has been run. No Modal or
local microsimulation was used to write it. Reviewed by a Fable 5.2
subagent for modelling soundness and neutrality; its points are folded in
(section 10).

Sources: the GOV.UK publication of 17 November 2026, read from local copies
taken that day (report HTML, analytical annex HTML, accompanying data tables
ODS; see `docs/report-day/05-report-measures.md`). Table 3 was re-read from
the ODS for this note.

- Report: <https://www.gov.uk/government/publications/from-a-welfare-state-to-a-working-state-a-new-settlement-for-the-next-generation/from-a-welfare-state-to-a-working-state-a-new-settlement-for-the-next-generation>
- Analytical annex: <https://www.gov.uk/government/publications/from-a-welfare-state-to-a-working-state-a-new-settlement-for-the-next-generation/from-a-welfare-state-to-a-working-state-analytical-annex>
- Data tables: <https://assets.publishing.service.gov.uk/media/6af74c9b9be17c68c69ca838/from-a-welfare-state-to-a-working-state-accompanying-data-tables.ods>

## 1. What the review publishes, and the job each figure does

| Figure | Where | What it covers | Its job here |
|---|---|---|---|
| An additional employment impact of 9% for UC health claimants | Annex, section 1 (welfare savings, key assumptions) | A behavioural assumption in the welfare costing, for UC health claimants, in a scenario with replacement awards (Severe and Complex Needs Insurance, the Additional Cost Allowance, or neither). The annex describes it as narrowing the gap between the LCWRA and LCW groups' employment rates. It does not say whether 9% is points or per cent, and gives no time path. It gives no figure for PIP recipients | **Level**: the share assumed in work by 2036-37, the last year the review publishes (not a steady state: Table 3's gap is still rising then) |
| NEET rate with and without the recommendations, 2026-27 to 2036-37 | Data tables, table 3 (annex, section 2) | The whole package's effect on the 16 to 24 NEET rate, education included, driven largely by employment support, guarantees, education and a "system transformation" effect; rounded to 1 decimal place; no split by measure | **Timing**, in the central path only, and stated as our pairing |
| Around 440,000 young people into sustained work by 2036 | Report, paragraphs 111 and 739; annex, section 8 (the poverty model's employment assumption, from the "wider package of support", including effects beyond age 24). Annex section 2 gives around 400,000 more 16 to 24-year-olds in work in 2036 | The whole set of recommendations | **Context only**, beside our figures; never used to set the share |

Table 3 (percentages, UK):

| | 2026-27 | 2027-28 | 2028-29 | 2029-30 | 2030-31 | 2031-32 | … | 2035-36 | 2036-37 |
|---|---|---|---|---|---|---|---|---|---|
| Baseline | 13.1 | 12.7 | 12.7 | 12.7 | 12.8 | 12.9 | … | 13.3 | 13.4 |
| With recommendations | 13.1 | 12.4 | 11.8 | 11.0 | 10.1 | 9.2 | … | 7.0 | 6.8 |
| Gap (pp) | 0.0 | 0.3 | 0.9 | 1.7 | 2.7 | 3.7 | … | 6.3 | 6.6 |

Why the 440,000 cannot set the share: 440,000 × Table 3's share of its
2036-37 gap gives about 113,000 in 2029-30 and 247,000 in 2031-32. The
whole group our current run draws from (non-working 18 to 24-year-olds with
PIP or the health element) is about 331,000 (the published 25% run moves
about 83,000 a year: `people_directly_affected`, age band `all`, in
`public/data/milburn/milburn_package_entry_25pct/age_impact.csv`). The
review's figure counts NEET young people outside the benefit system (it
puts hidden NEETs in England alone at 314,000, paragraph 275), people moved
by measures we do not model, and people over 24. The review gives no figure
for the benefit changes alone.

## 2. The yearly share moving into work

Two paths, both shown, both computed from the same runs (section 5):

**Central (Table 3 timing), the path María asked for:**

    share(year) = 9% × phase(year)
    phase(year) = (gap(year) − gap(2028-29)) / (gap(2036-37) − gap(2028-29))

**Companion (no ramp):** `share(year) = 9%` from 2029-30, which is how the
annex states the assumption: with no time path.

| Year | Gap (pp) | phase (rebased, central) | central share | phase (not rebased, stated) | share | companion share |
|---|---|---|---|---|---|---|
| 2027-28 | 0.3 | 0 | 0 | – | 0 | 0 |
| 2028-29 | 0.9 | 0 | 0 | – | 0 | 0 |
| 2029-30 | 1.7 | 0.8 / 5.7 = 0.140 | 1.26% | 1.7 / 6.6 = 0.258 | 2.32% | 9% |
| 2030-31 | 2.7 | 1.8 / 5.7 = 0.316 | 2.84% | 2.7 / 6.6 = 0.409 | 3.68% | 9% |
| 2031-32 | 3.7 | 2.8 / 5.7 = 0.491 | 4.42% | 3.7 / 6.6 = 0.561 | 5.05% | 9% |

Choices, all ours, each stated on the page:

- **Pairing the 9% with Table 3's timing is ours.** In the review, the
  welfare effect's timing comes from rollout (new claims first, then
  existing claimants at reassessment within five years), not from the NEET
  path, which is driven mostly by other measures. The central path also
  removes the benefits in full in April 2029 while only 1.26% respond that
  year. The tab says so, and shows the flat 9% companion beside it so the
  timing assumption is visible. A third path following the review's rollout
  (9% among those the phased package has reached) is open question 4.
- **9% read as percentage points**, an inference from the annex's wording
  ("narrow the gap" between two employment rates), not settled. A relative
  9% on a low employment rate would be well under 1 point, so the level
  differs by an order of magnitude between the two readings. Results scale
  with this reading (section 5), and the tab says the annex does not say
  which. Not to be published until open question 1 is answered or that
  caveat is on the page.
- **Rebased.** Table 3's gap is already 0.3pp and 0.9pp before April 2029,
  from measures this scenario does not model. Not rebasing would attribute
  those to a benefit change that has not yet happened. The unrebased path is
  stated beside it.
- **Rounding.** The rebased phase rests on four rates rounded to 1 decimal
  place in its numerator and four in its denominator. The 2029-30 numerator could be about 0.6 to 1.0pp and the
  denominator about 5.5 to 5.9pp, so the phase is about 0.10 to 0.18 and the
  2029-30 share about 0.9% to 1.6%. The page gives the range.
- **By 2031-32 the central share is about half way to 9%.** The tab says so.

The schedule lives in `milburn_design.py` as constants:

```python
REPORT_ENTRY_EFFECT = 0.09          # annex s.1, read as percentage points
REPORT_NEET_GAP_PP = {              # data tables, table 3: baseline − with
    2028: 0.9, 2029: 1.7, 2030: 2.7, 2031: 3.7, 2036: 6.6,
}
REPORT_ENTRY_REBASE_YEAR = 2028     # None: not rebased
def report_entry_share(year, path="table3"): ...   # "table3" | "flat"
```

`check_report_design()` checks: the effect is in [0, 1]; the gaps rise
year on year; every year from `REPORT_START_YEAR` to `LAST_POLICY_YEAR` has a
gap; the rebase year is `REPORT_START_YEAR − 1`; the share is 0 before
`REPORT_START_YEAR` and never above `REPORT_ENTRY_EFFECT`.

## 3. How it is applied, and to whom

Builds on `milburn_report_package_with_entry_25pct`
(`src/uk_budget_data/budget_measures/milburn_report.py`, line 112) and
`_employment_response` (`milburn_variants.py`, line 157).

- **Base package:** `milburn_report_package` in full (the health element
  removed for under-25s and PIP for 18 to 24-year-olds, from April 2029, no
  replacement payments), the headline static run the tab compares with. The
  review's 9% sits in a scenario with replacement awards; ours has none. The
  tab and Methodology say so. The phased base is open question 4.
- **Who moves (central):** non-working young people whose health element the
  package removes: the UC assessed claimant (not the other member of a
  single claim) with limited capability for work and work-related activity,
  aged 18 to 24, with no employment or self-employment income in the year.
  The annex states its 9% for UC health claimants and is silent on PIP
  recipients, so PIP recipients without the health element do not move in
  the central run; a sensitivity adds them (section 5). The annex's "UC
  health claimants" may be a wider group than LCWRA claimants aged 18 to 24.
  - Today's `_employment_response` selects anyone with the LCWRA flag, UC
    claim or not; the new selection adds the claimant test the removal
    itself uses (`lcwra_removed_under_25_phased`), on baseline, pre-removal
    status.
  - 16 and 17-year-old claimants lose the health element
    (`REPORT_UC_HEALTH_LOWER_AGE = 0`) but do not move: the band starts at 18,
    as the current run does. Stated in Methodology.
- **Share of whom:** the share applies to the group's non-workers (the
  people who move in the everyone-moves run, section 5). Read strictly, a
  9-point rise in the group's employment rate means `share / (1 − e)` of
  non-workers, with `e` the group's employment rate; no run output carries
  `e` today, and with few young LCWRA claimants in work the difference is
  small (open question 2: add an output for the group's total, or keep the
  plain share).
- **Earnings on entry:** 16 hours a week, 52 weeks, at the minimum wage for
  their age: our assumption, carried over from the earlier run. The review
  assumes a mixture of full-time and part-time moves and publishes no split,
  hours or wage (annex sections 3, 7 and 8 rest on unpublished hours and
  wage assumptions). The tab's entry cases (16 and 25 hours) show how the
  household gain changes with hours.
- **Reform only.** As now, the movers work in the reform and not under
  current law, so their earnings, the taxes on them and the fall in their
  means-tested benefits all count in the reform's results.
- **Static.** Nobody else changes behaviour; no wage or demand effects; no
  moves in or out of education. The figures for each year apply that year's
  share to that year's group; there is no cohort tracking, so nothing is
  said about who stays in work from one year to the next.
- **No random draw.** The scenario's figures are arithmetic on two runs
  (section 5), so there is no seeded draw and nobody is "chosen at random"
  in what is published.

## 4. Years covered

2027-28 to 2031-32, the years the dashboard shows.

- **2027-28 and 2028-29:** no benefit change and no moves, as the static
  report package. The tab shows a note for those years, not zero-valued
  charts, and says the review's own NEET path falls before April 2029 from
  measures this scenario does not model.
- **2029-30 to 2031-32:** the package in full, with the shares above.
- The review's costing runs 2029-30 to 2036-37 and its poverty model to
  2030-31 with steady-state employment assumptions (annex, section 8); our
  model stops at 2031-32. No year is like for like with the review's figures.

## 5. Runs to add: two large-share runs, then arithmetic

**Why not run the scenario directly.** The 16 to 24 band has about 14,800
records for about 7.5m people (about 500 people a record). The central
path's movers are about 4,200 people in 2029-30 on the whole PIP or health
element group, 9,400 in 2030-31 and 14,600 in 2031-32, so about 8 to 30
records, fewer for the health-element-only group. Under one seeded draw
those figures would be dominated by which handful of records is drawn, and
much would be withheld under the disclosure floor (3 survey households; 100
records for an average). Extra seeds of a handful of records do not fix
that.

**Instead: run everyone in the group moving, and scale.** Movers are a
random subset of the group, so for additive statistics the expected effect
of a share `s` is linear in `s`:

    result(s, year) = static(year) + s(year) × (all_move(year) − static(year))

This holds for totals and headcounts: the Exchequer effect, total change in
net income, people in poverty, people in losing and gaining households.
It does not hold for averages among losers or movers, or for the Gini; the
tab does not show those for this scenario. It is exact in expectation only
where movers do not share a household with another mover (two movers in one
household can cross a poverty line together where one would not); with
movers about 1 to 9% of a group that rarely shares households, the error is
small, and the linearity check (open question 5) measures it. The page labels the figures as
arithmetic on two runs, not a run of the scenario. A run where everyone in
the group moves has every record in it, so nothing rests on a seed, and any
path (Table 3, flat 9%, the unrebased path, a relative 9%) is a re-weighting
with no new run.

| Id | What | Status |
|---|---|---|
| `milburn_report_package_entry_all_uc_health` | The report package with every non-working 18 to 24-year-old UC health claimant (as defined in section 3) moving into 16 hours at their minimum wage, from April 2029 | New, reserved, **not promoted**: an input to the arithmetic, never published as a run |
| `milburn_report_package_entry_all_with_pip` | The same, adding non-working 18 to 24-year-olds with PIP | New, reserved, not promoted; for the PIP sensitivity (open question 3) |
| `milburn_report_package_entry_25pct` | Already reserved, never run | Not needed: superseded by the runs above. Stays reserved |

Both runs are staged outside the repository (`STAGE=~/milburn-runs/<date>`,
as `docs/milburn-local-run.md` does), never copied into
`public/data/milburn/`: every file under `public/` is a publication, and a
promoted or hidden-group id is loadable by `?policies=<id>`. Only the
derived file `public/data/milburn_entry_path.json` is published, and it
goes through the disclosure checks like any other (the groups are about
331,000 people with PIP, fewer without; the 16 to 24 band has 14,772 person
records for 7.48m people in 2029-30, from `sample_size` in
`milburn_report_package/age_impact.csv`, about 500 people a record, so the
groups are some hundreds of records).

Linearity check: a seeded 25% draw on the **same selection** as
`milburn_report_package_entry_all_with_pip`, and its complement (the same
draw at or above 0.25). Then `(r25 − static) + (r75 − static) = (all −
static)` holds exactly when movers do not interact, with no draw noise; the
residual is pure interaction (two movers in one household, the relative
line). Tolerances fixed before the runs: 2% of the increment for the
Exchequer, 5% for poverty and the losing-households share (or below the
page's rounding). A figure that fails is withheld on every full-package
path. The rollout path is not checked. The reserved
`milburn_report_package_entry_25pct` uses the old selection and stays
unrun.

Selection, after the second Fable review: the benefit unit's element must
actually go (no claimant with LCWRA in it keeps it: 25 or over, or not yet
reached), not only the person's age; read on the run's own current-law
values before the move, after which the simulation's calculated values are
dropped (`drop_computed_arrays`) so nothing read before the move is reused.

**Floor on the derived figures.** The two runs' own tables carry the flat
floor (`apply_flat_floor`: 3 survey households, a thin age band takes "all"
and its single ages, a withheld side takes the other side's conditional
mean). A derived figure is `static + s × (all_move − static)`, so it gives
back `all_move − static`, a statistic about the movers' households. It is
published only when:

1. neither input cell is withheld in its run; and
2. the movers rest on at least 3 survey households (the all-move run's
   `n_survey_households_direct`, row `all`, from its private counts); and
3. for a count-based figure (poverty, people in losing households), the
   difference rests on at least 3 survey households: the two runs'
   private counts of households whose status changes against current law
   differ by at least 3 (`|n_all − n_static| ≥ 3`, a lower bound on the
   households whose status differs between the two runs), or the two
   values are equal (no difference to give back). Otherwise withheld;
4. the with-PIP and rollout figures are also held to rules 2 and 3
   against the health-element run, since the difference between two
   published paths gives back the PIP-only (or unreached) movers.

The script refuses to write if any private count is missing, if the runs'
model builds (build, dataset hash, engine, policyengine) differ, or if an
everyone-moves run differs from its static before April 2029. The static
runs are read from their staged copies with private counts
(`~/milburn-runs/2026-11-18-floor/`), byte-identical to `public/`.

Published figures per year and path: the share, the movers, the Exchequer
effect, the absolute (before housing costs) and relative (after housing
costs) poverty changes in points and people, and the share of 16 to
24-year-olds in losing households. Averages are not published.

**Decisions (Vahid, 18 November).** Scaling as designed; 9% read as points
with the caveat on the page; beside the central path: (a) flat 9% from
2029-30, (b) PIP recipients too (own all-move run), (c) the review's
rollout on the phased package (own all-move run, among those reached; the
share is a flat 9% of them, the timing comes from reach); the share applied
to non-workers directly; the 25% linearity check run; the old 25% run's
files kept; the unrebased path in Methodology only.

Runs: `milburn_report_package_entry_all_uc_health`,
`milburn_report_package_entry_all_with_pip`,
`milburn_report_package_phased_entry_all_uc_health`, and the check
`milburn_report_package_entry_check_with_pip` (a seeded 25% draw on the
with-PIP selection) with its complement
`milburn_report_package_entry_check_complement_with_pip`.

**Cost and time.** Each run is one Modal container (2 CPUs, 32 GB) at about
$0.35 a container-hour (`src/uk_budget_data/modal_limits.py`). At about 25
minutes a run that is about $0.15 a run: $0.30 for the two, $0.45 with the
linearity check. Runs go in parallel (up to 16 containers), so the wall time
is about 30 minutes, plus the summary and measures regeneration (minutes,
local). Modal needs a committed, clean tree (`CodeRevision.tree_clean`), so
the code lands first. The rollout-based path (open question 4) would add
one run on the phased package with everyone reached moving (another $0.15).

## 6. Code and UI changes

Python:

- `milburn_design.py`: the constants and `report_entry_share` above; checks
  in `check_report_design`.
- `milburn_variants.py`: a selection option on `_employment_response`
  (UC claimant test on baseline, pre-removal status; self-employment income
  counted as work; PIP optional); the share stays one number (1 for the
  everyone-moves runs, 0.25 for the check). The default keeps today's
  selection so the published runs do not change.
- `milburn_report.py`: `milburn_report_package_with_entry_all(sim,
  include_pip=False)` (share 1 from `REPORT_START_YEAR`).
- `reforms.py`: reserved ids and factories next to `MILBURN_REPORT_ENTRY_ID`;
  **not** in `MILBURN_PROMOTED_IDS`.
- New `scripts/milburn_entry_path.py`: reads the static run from
  `public/data/milburn/milburn_report_package/` and the everyone-moves runs
  from the staging folder, and writes `public/data/milburn_entry_path.json`:
  for each year 2027 to 2031 and each path (Table 3 central, flat 9%,
  unrebased), the share, the movers and the scaled additive figures
  (Exchequer, total net income change, poverty headcounts, people in losing
  and gaining households), with the static figures beside them, applying
  the flat floor to every figure. Every year, not `YEAR = 2029` only
  (consistent with item 6). Recorded in the file: both runs' `model_build.json`
  hashes, so the derived figures are traceable.
- Tests: `tests/test_milburn_design.py` (reserved ids at lines 80, 577 and
  822; shares 0 before 2029, rising, never above 9%; a PIP-only 20-year-old
  does not move in the central run; selection uses baseline claimant status
  and no income-dependent variable is left cached from before the move);
  `tests/test_milburn_measures.py` (lines 291, 474-480 test the 2027 run);
  a test of the scaling arithmetic.

Frontend:

- `src/utils/milburn/summary.js`: `ENTRY_RUN` and `ENTRY_ASSUMPTION` → the
  new file and wording; the static comparator becomes
  `milburn_report_package`.
- `src/components/milburn/BehaviouralScenarios.jsx`:
  - follows the header's year selector over 2027-28 to 2031-32 (today it is
    fixed to 2029-30 and says so);
  - a new first card, "Share assumed in work, by year": the central and
    flat 9% shares and the movers by year, with Table 3's gap beside it,
    labelled as the review's whole-package figure;
  - the comparison card: static report package beside the scenario for the
    selected year (Exchequer, poverty headcount, people in losing
    households); the note for 2027-28 and 2028-29;
  - strings: `entryRunsNote` ("applied from April 2027" → "from April
    2029"), `SCENARIOS_LABEL`, `entryDescription`, `entryRunPoints`,
    `OUR_SCENARIO_TITLE` ("assumed move into work (25%)"),
    `ASSUMED_NOT_ESTIMATED_SENTENCE`;
  - the average loss row goes (not linear in the share);
  - Break-even stays: arithmetic on the static run and the household case.
    Its comparator becomes `milburn_report_package`.
- `src/components/MethodologyTab.jsx` (lines 455-480): "Microsimulated",
  "Why 25%" and "Who moves" rewritten (section 8); "The report's assumption"
  rewritten with the caveat in section 7 (the current text has the same
  issues: "expects", and the whole-package reading cited to paragraph 111).
- `src/utils/milburn/measureGroups.js`: drop `milburn_package_entry_25pct`
  from the label map and hidden group (lines 37 and 119); the new ids are not
  added (they are not published).
- Tests and fixtures: `summary.test.jsx`, `MethodologyTab.test.jsx`,
  `src/test/fixtures/milburn/summary/milburn_summary.json`, the
  BehaviouralScenarios tests, a fixture for the new file.
- Docs: README (tab row), `docs/milburn-local-run.md` (lines 323, 362, 440),
  `docs/milburn-analysis.md`; and `docs/report-day/05-report-measures.md`
  line 42, which still says `REPORT_REASSESSED_EACH_YEAR = 0.25` (the code
  has 0.45).

**Retiring the 25% run.** `milburn_package_entry_25pct` leaves the tab, the
summary and the hidden selector group. Its registry entry and its folder
under `public/data/milburn/` stay, like the other pre-report runs, loadable
by link and not offered (the trim list notes it must stay only while the tab
uses it). Deleting the folder instead is open question 6.

## 7. The caveat on the 440,000

Shown on the tab, beside our figures, and in Methodology:

> The review's modelling puts around 440,000 more young people in sustained
> work by 2036 (paragraph 111). In its analytical annex that figure is the
> employment effect of the whole package of recommendations, including the
> benefit changes, employment support, the guarantees and education
> measures, and it counts effects beyond age 24 (section 8); section 2 gives
> around 400,000 more 16 to 24-year-olds in work in 2036. The review gives no
> figure for the benefit changes on their own, so this scenario does not use
> the 440,000.

## 8. Wording for the tab

Neutral: what is assumed, for whom, and what it is not. No "would",
"expected" or "likely" applied to our figures; no judgement of the policy.

- **Tab and heading:** "Moves into work (illustrative)" (unchanged).
- **Subtitle:** "The report's benefit changes from April 2029, with an
  assumed move into work for young Universal Credit health claimants. The
  assumption is ours; it combines two figures the review publishes."
- **Selector label** (hidden group, for links): "Health element and PIP
  removal from April 2029, with an assumed phased move into work".
- **What the scenario changes:**
  - "Who moves: non-working 18 to 24-year-olds whose Universal Credit health
    element the package removes. None before April 2029; then {1.3%} of them
    in 2029-30, {2.8%} in 2030-31 and {4.4%} in 2031-32 (about {n} people in
    {year}); or 9% from 2029-30 with no ramp."
  - "Each moves from no work into 16 hours a week at the minimum wage for
    their age. Each year's figure is that year's share of that year's
    group in work."
  - "The Exchequer figure counts the taxes on their earnings and the fall in
    their benefits."
  - "Figures are arithmetic on two runs (the package alone, and the package
    with everyone in the group moving into work), scaled by the share."
- **Methodology, "Why this path"** (replaces "Why 25%"): "The share is an
  assumption, not an estimate of how people respond. Its level is the 9%
  employment effect the analytical annex assumes for Universal Credit health
  claimants (section 1), read here as 9 percentage points; the annex does
  not say whether it is points or per cent, and the figures scale with it.
  The annex gives the 9% no time path. The central path takes its timing
  from the review's NEET path (data tables, table 3), counted from 2028-29,
  the year before the benefit changes start, and reaches 9% in 2036-37; by
  2031-32 it is about half way. That pairing is ours: the review's NEET path
  reflects its whole package, and the review phases its welfare savings by
  when claimants are reassessed. The flat path applies 9% from 2029-30. The
  review's 9% sits in a scenario with replacement awards, which ours does
  not model."
- **Rounding:** "Table 3 is rounded to one decimal place, so the 2029-30
  share could be between about 0.9% and 1.6%."
- **Years without change:** "No change before April 2029: the report's
  benefit changes start then. The review's own NEET path falls before then,
  from measures this scenario does not model."
- **PIP sensitivity (if published):** "Also applying the same shares to
  non-working 18 to 24-year-olds who have PIP but not the health element.
  The annex states its 9% for Universal Credit health claimants; it gives no
  figure for PIP recipients."

## 9. Open questions

0. **Method:** publish figures that are arithmetic on two runs (an
   everyone-moves run scaled by the share, as designed), or a direct seeded
   run of the scenario despite resting on about 8 to 30 records a year? The
   design recommends the arithmetic; it is the biggest departure from a
   literal reading of item 7.
1. Is the annex's 9% a rise of 9 percentage points in the group's employment
   rate, or 9% of it? The design reads points but the page says it is not
   settled. (Could be asked of DWP analysts.)
2. Apply the share to non-workers as a plain share (as designed), or add an
   output for the group's total so the arithmetic can use `share / (1 − e)`?
3. Publish the PIP-inclusive sensitivity, or the central group alone?
4. Add a third path following the review's rollout: 9% among those the
   phased package has reached (one more run on `milburn_report_package_phased`
   with everyone reached moving)? The Fable reviewer favoured this as the
   most faithful timing; the design keeps Table 3 as central because item 7
   asks for it.
5. Run the one linearity check (a direct 25% run on the same selection,
   against the scaled figure; one more run, about $0.15), or rely on the
   arithmetic?
6. Keep `milburn_package_entry_25pct`'s files under `public/data/milburn/`
   (loadable by link) or delete them?
7. Rebased (central) or unrebased timing?

## 10. Review (Fable 5.2) and what changed

Verified by the reviewer: the arithmetic, the citations (9%, 400,000,
500,000, 440,000, 314,000), that `people_directly_affected` counts movers,
and that the data tables give no NEET split by measure.

Folded in:

- Table 3 timing with a full removal is our pairing, not the review's: now
  stated, with a flat 9% companion and a rollout path as open question 4.
- One seeded draw of a handful of records would be noise: replaced by two
  everyone-moves runs and linear scaling for additive figures (the
  reviewer's suggestion); averages among movers or losers dropped. The
  scaling design (section 5) was written after the review and has not been
  re-reviewed.
- Annex section 3 (non-benefit cases) was about fiscal offsets, not who
  moves: no longer cited for excluding PIP recipients.
- "Set from the review's published figures" and the id `…_review_path`
  overstated the review's part: subtitle and ids changed.
- The 9% reading is presented as unsettled; publication waits on it or on
  the caveat.
- Rounding band widened (four rounded rates, not two); "steady state"
  replaced by "the level at 2036-37"; replacement awards caveat added; 16
  hours called our assumption; the 440,000 caveat cites annex section 8 for
  the whole-package reading, includes the welfare changes and avoids
  "expects"; "sustained" and "stays in work" reworded; pre-2029 note added;
  a caching test added; the age edge, `share / (1 − e)`, self-employment
  income, the stale doc line and the extra design checks taken up.

## 11. Results (runs of 18 November, commit 22748260)

Five runs on Modal from a clean checkout of 22748260 (build fcfac709,
policyengine 6.20.2), staged in `~/milburn-runs/2026-11-18-phased/`; the
static runs from `~/milburn-runs/2026-11-18-floor/`. Written to
`public/data/milburn_entry_path.json` by `scripts/milburn_entry_path.py`.

Linearity check (25% plus its complement against everyone moving, with
PIP): residual 0% of the increment for the Exchequer, absolute poverty
before housing costs and the 16 to 24s in losing households in every year;
relative poverty after housing costs 2%, 7% and 9% in 2029-30 to 2031-32,
so it fails the 5% tolerance and is withheld on every path.

| Path | Year | Share | Movers | Exchequer saving £bn (static → scenario) | Absolute poverty BHC, pp (static → scenario) | 16–24s in losing households % |
|---|---|---|---|---|---|---|
| Phased (central) | 2029-30 | 1.26% | 2,000 | 4.67 → 4.67 | 0.490 → 0.487 | 7.75 → 7.75 |
| Phased (central) | 2030-31 | 2.84% | 5,000 | 4.78 → 4.79 | 0.491 → 0.484 | 7.75 → 7.74 |
| Phased (central) | 2031-32 | 4.42% | 8,000 | 4.89 → 4.90 | 0.491 → 0.481 | 7.75 → 7.73 |
| Flat 9% | 2029-30 | 9% | 17,000 | 4.67 → 4.69 | 0.490 → 0.470 | 7.75 → 7.70 |
| Flat 9% | 2030-31 | 9% | 17,000 | 4.78 → 4.81 | 0.491 → 0.471 | 7.75 → 7.70 |
| Flat 9% | 2031-32 | 9% | 17,000 | 4.89 → 4.92 | 0.491 → 0.470 | 7.75 → 7.70 |
| With PIP | 2029-30 | 1.26% | 4,000 | 4.67 → 4.67 | 0.490 → 0.484 | 7.75 → 7.74 |
| With PIP | 2030-31 | 2.84% | 8,000 | 4.78 → 4.80 | 0.491 → 0.478 | 7.75 → 7.72 |
| With PIP | 2031-32 | 4.42% | 13,000 | 4.89 → 4.91 | 0.491 → 0.470 | 7.75 → 7.70 |
| Rollout (phased package) | 2029-30 | 9% of reached | 9,000 | 2.77 → 2.78 | 0.223 → 0.212 | 4.56 → 4.53 |
| Rollout (phased package) | 2030-31 | 9% of reached | 14,000 | 4.01 → 4.03 | 0.339 → 0.326 | 6.40 → 6.35 |
| Rollout (phased package) | 2031-32 | 9% of reached | 15,000 | 4.56 → 4.59 | 0.408 → withheld | 7.18 → 7.13 |
| Unrebased (Methodology only) | 2029-30 to 2031-32 | 2.32%, 3.68%, 5.05% | 4,000, 7,000, 9,000 | 4.67 → 4.67, 4.78 → 4.80, 4.89 → 4.90 | 0.490 → 0.485, 0.491 → 0.482, 0.491 → 0.479 | 7.75 → 7.74, 7.73, 7.72 |

Withheld: relative poverty after housing costs on every path and year
(linearity check); the rollout path's 2031-32 absolute poverty (its
difference from the health element run rests on fewer than 3 survey
households). Nothing before April 2029 (no change).
