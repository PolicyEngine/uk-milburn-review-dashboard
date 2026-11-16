# Report day 03: hard-coded figures, consistency and QA

Read-only review on 16 November 2026 of `main` at `0287c2d7` (build 6f918b81,
policyengine-uk 2.177.7). Nothing in the repository was changed except this
file. Checks ran on the committed files; the test perturbation ran on a copy
outside the repository.

Contents: 1 what goes stale · 2 internal consistency · 3 plausibility ·
4 tests that will fail · 5 order of work tomorrow.

## Headlines

1. **The page's result figures are data-driven.** Key figures, Return to
   work, the break-even panel and the charts read `milburn_summary.json` and
   the per-run CSVs; no result figure (£4.49bn, 578,000, 410,000, £12,622,
   160.5%) is typed into a component. They are typed into **tests**, into
   `docs/milburn-analysis.md`, and two of them into
   `public/data/milburn_benchmarks.json` (232,000 and £4.43bn, by hand).
2. **`milburn_summary.json` matches the CSVs exactly.** Re-deriving all 13
   runs with `scripts/milburn_summary.py`'s `summarise()` gave zero
   differences. All 13 `model_build.json` carry the same build, hash and
   engine.
3. **Three things on the page do not agree with the data or the code** and
   are worth fixing with the re-run (section 3): the phased "about 36%"
   (the run's saving is 45% of full abolition), the Return to work wording
   "25% of young people who lose" (the run moves a quarter of non-working recipients aged 18–24, about
   82,000 people or 14% of the 578,000), and the break-even share (160.5%) shown beside an entrant
   count (571,000) that is 99% of the same group.
4. **Hand-typed copies of the build and engine exist in six places**
   (section 1.1). A new build tomorrow needs all six, or the footer and the
   per-view label will name different builds.

## 1. What goes stale after the re-run

"Pinned by" names the test that fails if the value is edited; section 4
lists the tests that fail when the *data* change.

### 1.1 Build, engine and dataset identifiers (change only if the build or engine changes)

| File:line | Value | Source of truth | Pinned by |
|---|---|---|---|
| `src/uk_budget_data/local_build.py:36-42` | `BUILD_ID` `uk-frs-calibration-attempt-20261112T133744Z-6f918b81`, `BUILD_SHORT`, dataset SHA-256 `e268e3af…`, `ENGINE` 2.177.7 / 3.34.10, `LABEL` | Hand edit; the pipeline refuses any other file or engine | `tests/test_milburn_measures.py:45` (skip reason), local build tests |
| `pyproject.toml:84-85` | `policyengine-uk==2.177.7`, `policyengine-core==3.34.10` overrides | Hand edit, then `uv lock` | — |
| `src/components/ReplicationLine.jsx:10-11` | `MICROCOSM_BUILD = "6f918b81"`, `POLICYENGINE_UK_VERSION = "2.177.7"` (footer, About drawer, Methodology, PyPI link) | Could read `model_build.json` (`build`, `engine`); today by hand | `ReplicationLine.test.jsx:6-9`, `MethodologyTab.test.jsx:129,220`, `landing.test.jsx:370` |
| `src/components/MethodologyTab.jsx:21,23` | `POLICYENGINE_CORE_VERSION = "3.34.10"`; `MICROCOSM_BUILD_NAME` with timestamp `20261112T133744Z` | `model_build.json` `build` and `engine`; today by hand | `MethodologyTab.test.jsx:221-222` |
| `src/utils/milburn/measureVisuals.js:36-37` | `engine: "policyengine-uk 2.177.7"`, `year: "2027-28"` | By hand | — |
| `public/data/milburn_benchmarks.json:29,114` | label `PolicyEngine, build 6f918b81, 2027-28` (twice) | By hand (file is hand-written) | `milburn.test.js:104`, `milburnTabs.test.jsx:96` |
| `public/data/milburn_measures.json:2`, `milburn_scenarios.json` `basis`, every `milburn/<id>/model_build.json`, `milburn_summary.json` `label` | `build 6f918b81, policyengine-uk 2.177.7, not in a policyengine.py release` | Written by the pipeline from `local_build.LABEL`; regenerate, do not edit | — (test fixtures carry their own copy) |
| `src/utils/milburn/localBuild.js:3-4,289-290` | Comments only | — | — |
| `docs/milburn-local-run.md:11-14` and throughout | Build, hash, engine; also says "six computable" measures (there are 13 runs) | By hand; already out of date on the measure count | — |

### 1.2 Review dates and "before the report" wording (stale tomorrow whatever the numbers do)

| File:line | Text | Fix | Pinned by |
|---|---|---|---|
| `src/components/LandingPage.jsx:56-59` | "candidate measures … Modelled before the final report on 17 November 2026; not announced policy." | By hand | `landing.test.jsx:14` (exact regex) |
| `src/app/layout.tsx:27-28` | Meta description: "candidate measures … modelled before the review is published … These are not announced policy." | By hand | none found |
| `src/components/MethodologyTab.jsx:180` | Preview "Candidates · Not announced policy · Final report 17 November 2026" | By hand | none found |
| `src/components/MethodologyTab.jsx:182-185` | "published an interim report on 28 May 2026; its final report is expected on Tuesday 17 November 2026 … modelled before it is published" | By hand | none found |
| `src/components/MethodologyTab.jsx:70` | "The measures are candidates modelled before the review's final report." | By hand | none found |
| `src/utils/publication/manifest.js:28` | `CANDIDATE_PROVISIONAL_LABEL` "Provisional: candidate measures modelled before the review is published, not announced policy" (verified route only; the local route shows `localBuildNotice`) | By hand | check `manifest` tests if edited |
| `src/App.jsx:1164,1181` | "candidate measures' results"; "Candidate measures for the Milburn review" | By hand | — |
| `src/components/milburn/NotComputableMeasures.jsx:9-10` | "Candidate measures we cannot compute" / "not yet run" | By hand | `viewTabs.test.jsx`, `localBuild.test.jsx` (by the exported constant) |
| `src/components/milburn/KeyFigures.jsx:24-29` | "Replacement support is not modelled, so the full package is an upper bound on losses." "Left out: local fund, extra-costs allowance, payment for those who can never work, conditionality." (the briefed design) | By hand, to the report's actual replacement benefits | `summary.test.jsx` (notes) |
| `src/utils/milburn/measureGroups.js:11-14` | Run names: "Full abolition, no replacement (upper bound)", "Central variant: severe cases kept, PIP at half rate", "… move into work (25%)" | By hand if the variants change | `measureCatalogue.test.jsx`, `summary.test.jsx:348-353` |
| `src/utils/milburn/notComputable.js:11-79` | Four not-computable measures; "The higher amount is not set out", "Its rules (eligibility, rates) have not been set out", "whose rules are not set out" | Mirror of `reforms.NOT_COMPUTABLE_MEASURES` by hand. The report will probably set out the additional cost allowance and the severe-conditions rate, so both the reason and the "cannot compute" status may change | `tests/test_milburn_measures.py:293-303` (ids); `MilburnVisual.test.jsx:108-109` (no digits in visuals) |
| `src/uk_budget_data/reforms.py:1247,1396-1397,1419,1466,1540-1542,1556` → `public/data/milburn_measures.json` | Descriptions: "Briefings before the report point to…", "the trailed higher-rate benefit … not yet known", "whose rules are not yet known", "briefings do not attribute it to the review" | Edit `reforms.py`, regenerate with `uk-budget-data milburn-measures` | — |
| `src/utils/policyDetails.js:822,877` | "illustrative stand-ins for rules not yet known"; "the trailed higher-rate benefit" | By hand | — |
| `src/utils/milburn/benchmarks.js:17-70` | `BENCHMARK_THEMES` and `BENCHMARK_SHORT`: card titles, icons and one-line bases keyed by the JSON's row ids ("16–24s…", "ages 18 to 24", "every adult under 25", "Cost of zero employer NICs for under-25s") | By hand. A new or renamed row in the JSON falls under "Other figures" with the file's long wording and no icon | `milburn.test.js:163-167` (every row has its own icon: a new row without an entry fails), `milburnTabs.test.jsx:99-116` |
| `src/components/milburn/BenchmarksTable.jsx:404-430` | "About these figures": "each names its build and year", the package figure's definition (16 to 24) | By hand; no figure in it | — |
| `public/data/milburn_benchmarks.json:9-13,83-87` | Interim-report figures (NEET about 1.0 million, 28 May 2026; "About £8bn a year; PIP … £6.5bn by 2031-32", 1 June 2026, press report) | By hand: replace with the final report's own figures and date | `milburn.test.js`, `milburnTabs.test.jsx:107-116` (row ids and order) |

### 1.3 Policy parameters typed into the front end (stale if the report's design or the engine's rates differ)

| File:line | Value | Source of truth | Pinned by |
|---|---|---|---|
| `src/utils/milburn/measureVisuals.js:39` | Health element £442.10 (protected, 2027-28 projection), £429.80 (2026-27), £217.26 (new claims) a month | Engine parameters; same numbers in `tests/test_milburn_measures.py:34-35`. No test keeps the JS and the engine equal | `MilburnVisual.test.jsx:26,60,63` (£442, £217.26, £786, £614) |
| `measureVisuals.js:42-43` | PIP weekly: daily living £79.38 / £118.61, mobility £31.36 / £82.80 | Engine; `test_milburn_measures.py:38-39` has two of the four | `MilburnVisual.test.jsx:45,60,64` (£79, £119, £31, £83, £344) |
| `measureVisuals.js:46` | Standard allowance a month: £353.17, £443.21, £551.11, £695.71 | Engine; `test_milburn_measures.py:36-37` (singles only) | `MilburnVisual.test.jsx:77-78` (£443, £353, £90, £696, £551, £145) |
| `measureVisuals.js:47` | Employer NICs 15%, zero rate below 21, apprentices below 25, UST £50,270 | Engine; `reforms.py:1415` repeats £50,270 | `MilburnVisual.test.jsx:83-84` |
| `measureVisuals.js:55` | `MILBURN_PHASING`: start 2026, 25% a year, ages 18–24, years 2027–2031 | Mirror of `milburn_variants.py:28-29` (`START`, `REASSESSED_EACH_YEAR`). No test compares the two files | `MilburnVisual.test.jsx:69-72` (36%, 60%, 76%, 86%, 93%) |
| `measureVisuals.js:60-61,79,114` | Age limits: upper age 25, PIP from 16 or 18, health element limit 22 or 25 | `policyDetails.js` visual specs (`limit`, `from`, `share`) | `MilburnVisual.test.jsx:27-55` (bar counts) |
| `measureVisuals.js:92-100,245,269,283` | "Claims before/from April 2026", "24+ PIP daily living points", "Turned 18 since April 2026" | By hand | `MilburnVisual.test.jsx:26,39,63` |
| `src/utils/policyDetails.js:689-917` | Every Milburn card: `starts: "Apr 2027"` and `inForce.from "2027-04"` (12 entries: lines 699-909), "16 and 17-year-olds keep it" (735), "A quarter of the remaining caseload each year" (832), "Turning 18 from April 2026" (831), "24+ PIP daily living points" (812, 868), "About a fifth of young PIP recipients" (869), age bands in every summary | By hand to the report's age band, start date and migration path. "About a fifth" is a share from this build's data: recompute | `policyDetails.test.js:142-153` (ids) |
| `src/uk_budget_data/reforms.py:1339-1606` → `milburn_measures.json:25-95` | "From April 2027" (8 descriptions), "aged 18 to 24", "(£50,270 a year)", "24 or more PIP daily living points (about a fifth of young PIP recipients)", "an assumed 25% of the remaining caseload a year: about 36% reached in 2027-28, 60% in 2028-29 and 93% by 2031-32", "a randomly chosen quarter" | `reforms.py`, then regenerate the JSON | `test_milburn_measures.py:271-290` (ids and order) |
| `src/uk_budget_data/budget_measures/milburn_variants.py:8-9,28-30` | Docstring "about 36%, 60%, 76%, 86% and 93%"; `START = 2026`, `REASSESSED_EACH_YEAR = 0.25`, `SEED = 20261117` | The rule itself; see 3.1 on 36% | `test_milburn_measures.py:417-421` |
| `src/uk_budget_data/milburn_scenarios.py:32-38,134-146` | Entry case: year 2027, age 22, rent £6,000, North West, 16 and 25 hours; basis text "on the OBR October 2026 forecast" | By hand; output `milburn_scenarios.json` regenerates | `test_milburn_measures.py:306-356` (£13.21, rent 6,000) |
| `scripts/milburn_summary.py:19` | `YEAR = 2027` | By hand if the first year moves | — |
| `src/components/milburn/KeyFigures.jsx:298` | Fallback year 2027 | `summary.year` | — |

`chartCsv.js:12`, `exportFrame.js:18` and `scripts/artifact_export.py:31` carry
only the dashboard's name in download and export credits, no build, date or
figure.

£13.21 is not typed into the page: it is read from `milburn_scenarios.json`
(`hourly_wage`), which the engine computes (the 2027-28 National Living
Wage in 2.177.7's baseline). It is pinned only in
`tests/test_milburn_measures.py:314-316`.

### 1.4 Figures from the current runs typed into copy

| File:line | Value | Should come from | Pinned by |
|---|---|---|---|
| `public/data/milburn_benchmarks.json:27` | PolicyEngine estimate "232,000" (LCWRA benefit units, every adult under 25) | **Not in any published file**: a baseline caseload query on the dataset. Recompute by hand on the new build | `milburn.test.js:107,140-141`, `milburnTabs.test.jsx:93-95,105` ("10.77% lower") |
| `public/data/milburn_benchmarks.json:112` | PolicyEngine estimate "£4.43bn a year" (employer NICs) | `milburn_summary.json` → `employer_nics_zero_under_25.saving_bn["2027"]` (−4.432). Could be a `run`/`metric` row like `package_young_people_affected` instead of a typed value | `milburn.test.js:108,144-147`, `milburnTabs.test.jsx:98,106` ("13.14% lower") |
| `src/components/MethodologyTab.jsx:63` | "£217.26 a month, £2,607 a year" and "£442.10 a month" | Engine parameters (as 1.3) | none found |
| `MethodologyTab.jsx:64` | "roughly 500 to 650 survey records of young claimants" | Sample counts on this build; by hand | none found |
| `MethodologyTab.jsx:65` | "About nine in ten young claimants with … LCWRA in the data also get PIP" | Baseline query on the build; by hand. The published runs imply 94% (see 3.4) | `MethodologyTab.test.jsx:105` |
| `MethodologyTab.jsx:66` | "all-age LCWRA stock … about 23% above DWP's figure"; "PIP caseload aged 18 to 24 is low but its award mix is high" | Baseline query; by hand. See 3.5: "is low" rests on a comparison of different age bands | `MethodologyTab.test.jsx:106` |
| `MethodologyTab.jsx:361` | "run again with a quarter of the young people it leaves worse off moving into work" | By hand; see 3.2 | — |
| `src/components/milburn/BehaviouralScenarios.jsx:46,168,170,174,178,188,200,242` | "25% of young people who lose move into work", "With a quarter moving into work", "25% move into work" | By hand; the share is `_employment_response(sim, 0.25)` in `milburn_variants.py:132`; no shared constant | `tabsSmoke.test.jsx:99`, `milburnTabs.test.jsx:55`, `summary.test.jsx:310` (heading) |
| `docs/milburn-analysis.md:39-53` | Results table, all 13 runs | Regenerate: stdout of `scripts/milburn_summary.py` | — |
| `docs/milburn-analysis.md:55-152` | Every prose figure (£2.01bn → £4.74bn, 578k, £7,000 / £12,600, 410k, £1.72bn, £1.46bn, £0.83bn, 87k, ~233k, ~345k, ~£8,300, 347k, 435k, £2.91bn, £3.72bn, 4.29m, £32.8bn, 232k, 2.79m, 23%, 13%, £0.9bn, 500–650, £7,900, £10,100, £4,000, £8,900, 64% / 50%, 570k / 450k, £4.61bn, 272k, £11.3k, £0.8bn, 1.16m, £1,100, £4.4bn, 11%) | By hand from the new summary and a fresh caseload query. Internal note, not shown on the page | — |
| `src/test/fixtures/milburn/**` | Invented figures and their own build label | Do not change: they are not the results | used by `summary.test.jsx`, `localBuild.test.jsx`, `milburnTabs.test.jsx` |
| `artifact-export/` (git-ignored, 92 MB) | A static export of the page with the current data baked in | Rebuild with `ARTIFACT_EXPORT=1` / `scripts/artifact_export.py` after the re-run; do not republish the old folder | — |

Published benchmark figures from other sources (`milburn_benchmarks.json`:
260,000; 120,000; 62,570; £1.3bn to £2.0bn; about 1 in 5; £5.1bn and
£132,000 per job) do not change with the re-run, but the Resolution
Foundation and IFS will probably publish new figures on the day. They are
pinned in `milburnTabs.test.jsx:82-83,98,117-119` and
`milburn.test.js:128-158`.

## 2. Internal consistency of the current results

### 2.1 Summary against the per-run CSVs: no mismatch

Method: imported `summarise()` from `scripts/milburn_summary.py` (without
calling `main()`, which writes the file), ran it on each
`public/data/milburn/<id>/` and compared every field with
`public/data/milburn_summary.json`.

| Check | Result |
|---|---|
| Runs in summary and folders | 13 and 13, same ids |
| Every field of every run (saving by year, young people, share, average loss, four poverty lines, two counts, child poverty, break-even, entrants, Exchequer gain) | Identical |
| `model_build.json` across the 13 folders | Same build `…6f918b81`, same dataset hash `e268e3af…`, engine 2.177.7, years 2027–2031 |
| `obr_comparison.csv` `policyengine_value` against `budgetary_impact.csv` | Identical in all 13 |
| `metrics.csv` `people_affected` against `age_impact.csv` all-ages share worse or better off | Agree (e.g. package 2.02% and 2.02%) |
| Population in `age_impact.csv` | 69.57m all ages, 7.457m aged 16–24, 14,772 records aged 16–24, the same in every run |

Two properties of the summary that are consistent but easy to misread:

| Field | What it holds | Note |
|---|---|---|
| `everyone_in_losing_households_pct` | `pct_worse_off` for all ages | For the two gain runs it is 0.0, although `young_people_in_losing_households` is switched to the gainers (8.87% and 3.90% of everyone gain). Not shown wrongly on the page, but the field is asymmetric |
| `average_loss_young_person_in_losing_household` in `milburn_package_entry_25pct` | −mean change ÷ share worse off | The mean includes the 0.24% of 16–24s whose households end up better off (some of the movers), so £11,305 is the net change divided by the share who lose, not the average loss of those who lose |

### 2.2 Scenarios file: consistent

| Check | Values |
|---|---|
| Earnings = wage × hours × 52 | £13.21 × 16 × 52 = £10,990.72; × 25 = £17,173.00: as the file |
| Exchequer gain at 16 hours = fall in UC + employer NICs | (10,990.72 − 7,862.66) + 15% × (10,990.72 − 5,000) = 3,128.06 + 898.61 = £4,026.67: as the file |
| Exchequer gain at 25 hours | (17,173.00 − 10,064.70) + 15% × 12,173.00 = 7,108.30 + 1,825.95 = £8,934.25: as the file |
| Break-even, package, 16 hours | 12,622 ÷ 7,862.66 = 160.5%: as the summary |
| Entrants, package, 16 hours | £4.4857bn ÷ 7,862.66 = 570,502: as the summary |
| `exchequer_gain_per_entrant` in every summary run | 4,026.67 and 8,934.25: as the scenarios file |

The page reads both files directly, so what it shows is what they hold.

### 2.3 Benchmarks file against the results

| Row | In the file | From the results | Match |
|---|---|---|---|
| `employer_nics_under_25` estimate | "£4.43bn a year" | −4.432 in the summary | Yes |
| `package_young_people_affected` | computed on the page from `age_impact.csv` | 7,456,567 × 7.7538% = 578,166 = the summary | Yes |
| `uc_health_no_work_requirements` estimate | "232,000" | Not derivable from published files; `docs/milburn-analysis.md:87` says 232k | Cannot verify here |

### 2.4 `docs/milburn-analysis.md`: mismatches

The results table (lines 39–53) matches the summary in all 13 rows. In the
prose:

| Line | The note says | Data or other line says | Comment |
|---|---|---|---|
| 79, 120 | "~233k young LCWRA awards" | 232k (line 87; benchmarks file 232,000) | Two figures for one thing |
| 81 | "~345k PIP recipients aged 18–24" | 347k (line 85) | Two figures for one thing |
| 82 | "average of ~£8,300" | £2.91bn ÷ 347k = £8,386 (÷ 345k = £8,435) | Rounds to £8,400 |
| 72 | "87k recipients aged 16–17" | 435k − 347k = 88k (line 85–86) | Rounding |
| 82-84 | "~430k aged 16–24 is England and Wales, so the model's caseload is low" | Model has 435k aged 16–24 in the UK (line 86) | The "low" conclusion compares 18–24 (345k) with 16–24 (430k). Like for like the model is level with an England-and-Wales figure, so low only by roughly Scotland and Northern Ireland's share |
| 61 | Phased "absolute AHC poverty +0.21pp rising to +0.53pp" | `metrics.csv` 2031: 0.5348 | "+0.53pp" is right to two places; the summary rounds the same figure to 0.535 at three |
| 58 | Phased "about 36% in 2027-28" | Phased saving ÷ full = 44.8%; young people 41.3% | See 3.1 |
| 120 | "about 570k at 16 hours (450k at 25 hours)" | 570,502 and 445,682 | 446k, not 450k |
| 125-126 | "a random quarter of affected young people who do not work" | Code: aged 18–24, with PIP or LCWRA, no earnings | Right here; the page says something else (3.2) |

## 3. Plausibility

### 3.1 Phased package: "about 36%" against 45% in the results

| Year | Rule's share reached (equal numbers at each age) | Phased saving ÷ full saving |
|---|---|---|
| 2027-28 | 35.7% | 2.009 ÷ 4.486 = 44.8% |
| 2028-29 | 59.8% | 3.338 ÷ 4.632 = 72.1% |
| 2029-30 | 75.9% | 3.770 ÷ 4.666 = 80.8% |
| 2030-31 | 86.4% | 4.316 ÷ 4.784 = 90.2% |
| 2031-32 | 93.2% | 4.741 ÷ 4.889 = 97.0% |

Also in 2027-28: young people in losing households 239,044 ÷ 578,166 =
41.3%; everyone affected 0.958% ÷ 2.022% = 47.4%.

The JS (`phasedShare`) and the Python (`reached`) implement the same rule,
and the arithmetic of 36% is right. The realised share is 4 to 12 points
higher every year. Likely causes, none checked on the dataset: one seeded
draw per person (`SEED = 20261117`) over roughly 500 to 650 records, kept
across years, so a draw that happens to pick large weights or large awards
stays high; `reached` treats everyone under 18 as a new entrant; a
household is a loser when any one member is reached. The page's card,
`milburn_measures.json:88`, `MethodologyTab` and the analysis note all say
"about 36%", which a reader will set against £2.01bn of £4.49bn. Either say
that 36% is the rule and the run's realised share differs, or quote the
realised share from the data. Tomorrow's re-run will move it again.

### 3.2 Return to work: "25% of young people who lose" is not what the run does

| Source | Says |
|---|---|
| `BehaviouralScenarios.jsx:46,174,188`, `MethodologyTab.jsx:361` | 25% of the young people (16 to 24) the package leaves worse off move into work |
| `milburn_variants.py:105-115`, `milburn_measures.json:95` | 25% of people aged 18–24 with PIP or LCWRA themselves and no earnings |
| `age_impact.csv` (`people_directly_affected`, entry run, 2027) | 82,467: people whose own earnings or taxes change (`calculators.py:1247`), which in this run is the movers; the column is 0 in the static package |

On that reading, 82,467 is 14.3% of the 578,166 young people in losing
households (and 25% of about 330,000 non-working recipients). A reader of the page would
expect about 145,000 movers. The wording should follow the measure's
description.

Order-of-magnitude check on the run itself: 82,467 movers × £10,991 =
£0.91bn of earnings; the saving rises by £0.128bn (£4.486bn → £4.614bn),
about £1,550 per mover, against £4,027 per entrant in the household case.
The analysis note's explanation (many young PIP recipients are not on UC)
is plausible; it is worth one check of how many movers are on UC.

### 3.3 Break-even: the share and the entrant count contradict each other

| Figure (package, 16 hours) | Value | Basis |
|---|---|---|
| Break-even share | 160.5% ("no entry rate restores the average") | Average *household* loss per young person in a losing household (£12,622) ÷ one entrant's gain (£7,863) |
| Entrants to match the income loss | 570,502 | Saving (£4.486bn) ÷ one entrant's gain |
| Young people in losing households | 578,166 | |

The panel shows 570,502 with a reference line at 578,000, which is 98.7%
of the group, beside a share of 160.5% of the same group. Both cannot be
read as "how many would need to move into work".

The cause: £12,622 counts a household's whole loss once for each young
person in it. 578,166 × £12,622 = £7.30bn, against a total loss of £4.49bn,
so losing households average about 1.6 people aged 16–24 on this
weighting. The gain side counts one entrant's gain once. Dividing a
per-person-weighted household loss by a per-entrant gain overstates the
share by that 1.6. On a like-for-like basis (£4.486bn ÷ 578,166 = £7,759
per young person; ÷ £7,863) the 16-hour share is about 99%, and the
25-hour share about 77%. The headline "above 100%, even if all moved into
work" for the full package therefore depends on the double count. The same
applies to every run (e.g. PIP removed 18–24: 126.6% shown; £3.441bn ÷
555,209 ÷ 7,863 = 79%). This is the figure I would least like to see quoted
tomorrow without a second look.

A second caveat already on the page: the entry case has LCWRA, no PIP and
rents alone; most young people in the package's losing households have PIP
and many live with parents.

### 3.4 Caseloads and spending against the benchmarks

| Benchmark | Published | Model (2027-28) | Reading |
|---|---|---|---|
| Young people on UC health, no work requirements (RF) | 260,000 | 232,000 benefit units, every adult under 25 | 10.8% lower. Units against people, 2027-28 against a 2026 count, UK. Plausible; if anything the model is a little low, since caseloads are rising |
| Health element saving implied | — | £1.154bn ÷ 232k = £4,974 a unit | Checks out: 87% × 12 × £442.10 + 13% × 12 × £217.26 = £4,954. At RF's 260k the same mix gives £1.29bn |
| Incapacity benefit spending, 18–24 (IFS) | £1.3bn (2022) to £2.0bn (2025) | £1.15bn health element, under 25 | Model is 42% below the 2025 figure. Not like for like (the IFS figure probably counts more than the element, e.g. ESA and the standard allowance of those claimants; no date or definition is recorded in the benchmarks file). Worth one line in the methodology if the IFS repeats the figure tomorrow, because a reader will set £2.0bn of spending beside a £1.15bn saving from abolition |
| PIP, 16–24, England and Wales (press) | about 430,000 | 435k aged 16–24, UK (£3.72bn); 347k aged 18–24 (£2.91bn) | Level with an England-and-Wales figure, so about 10% low for the UK. Average award £8,386 (18–24) and £9,205 (16–17); the maximum is £10,473 (52 × (£118.61 + £82.80)). Awards averaging 80% to 88% of the maximum are high; young awards do skew to enhanced rates, but the 16–17 average is the one to check |
| PIP removal saving ÷ direct PIP | — | 18–24: 3.441 ÷ 2.91 = 1.18; ages 16–17 only: 0.983 ÷ 0.81 = 1.21 | Knock-on of about 20% (carers, premia, cap). The marginal saving per 16–17 recipient is £11,170, above the maximum PIP award, which is possible only through the knock-ons |
| Spending on PIP and UC health for young people (interim report, as reported) | about £8bn a year; PIP £6.5bn by 2031-32 | £3.72bn PIP (16–24) + £1.15bn health element = £4.9bn; PIP removal 16–24 saves £4.91bn in 2031-32 | Model is about 40% below "about £8bn" and 25% below £6.5bn. The published figures are press reports of the interim report and may cover a wider age band or more benefits. If the final report gives a costing for under-25s, expect it to be above the model's £4.49bn; decide in advance what the page says about the gap |
| Zero employer NICs under 25 (RF) | £5.1bn | £4.43bn | 13.1% lower; the note attributes it to 11% fewer young employees than HMRC. Consistent |
| Young people kept out of poverty by UC health and/or PIP (RF) | 120,000 | Package: +409,743 people of all ages in absolute AHC poverty | Different measures (all ages, absolute line). With about 1.6 young people in a losing household of about four, 410k people is of the order of 160k young people: the same order as RF's 120k |

Other checks on the runs:

| Check | Values | Reading |
|---|---|---|
| Package against its parts | 1.154 + 3.441 = 4.595; package 4.486 | The package saves £0.11bn less than its parts sum to. A knock-on that either removal triggers on its own (a lost premium or cap exemption, say) would be counted once in the package and twice in the sum; not confirmed. Worth knowing the reason before someone asks |
| Central against its parts | 0.828 + 1.715 = 2.543; central 2.543 | Exactly additive to £1m while the full package is not. Possible, but an exact match is worth one look |
| Overlap of the two groups | 405,698 + 555,209 − 578,166 = 382,741 | 94% of young people in households losing the health element are also in households losing PIP ("about nine in ten" in the copy). Not checked against DWP's published overlap here; if the true overlap is lower, the package's average loss is overstated and its headcount understated, as the limitation says. Worth one query against DWP's figure for young claimants |
| New claims only | £0.063bn; 29,914 young people; £2,720 average | 13% × 232k = 30k units × £2,607 = £0.079bn: same order |
| Youth allowance | £0.80bn ÷ £1,080 a year = about 740,000 single-equivalent awards | No benchmark for this in the repository, and none checked here. Compare with DWP's count of UC claimants under 25 before quoting the cost |
| Employer NICs | 2,843,290 young people in gaining households, £2,706 average | Household incomes rise because the engine passes employer NICs through to pay (stated on the card and in the description). The poverty and age results for this run rest wholly on that assumption |

### 3.5 Relative poverty is not monotonic across variants

| Run | Absolute AHC | Relative AHC | People, relative AHC |
|---|---|---|---|
| Full package | +0.589pp | +0.225pp | +156,379 |
| Central (smaller cuts) | +0.452pp | +0.383pp | +266,476 |
| Phased (subset of the cuts) | +0.206pp | −0.065pp | −45,247 |
| PIP removed 18–24 | +0.439pp | +0.123pp | +85,558 |
| PIP halved 18–24 | +0.287pp | +0.240pp | +166,779 |
| Entry 25% | +0.391pp | +0.043pp | +29,665 |

A smaller cut raises relative poverty by more than a larger one, and the
phased run lowers it. The mechanism is the median moving, but the size
(100,000 people either way) says the relative line sits where a small
shift moves many records. The page leads with absolute poverty, but Key
figures' footnote (`KeyFigures.jsx:129-134`) and the poverty tiles
(`HeadlineTiles.jsx:117-127`) show the relative count for the selected run:
for the phased package that reads "45,000 people move out of" relative
poverty. Also `uc_health_element_removed_under_22` and
`…_new_claims` have identical absolute and relative AHC counts (37,857 and
2,715): the same handful of records crosses both lines, a sign of how few
records carry these results. Child relative poverty for PIP removed from 16
is +1.162pp, large because 16 and 17-year-old recipients are themselves
counted as children.

### 3.6 Model limitations the report may expose

- Scotland: ADP records are held as PIP and are removed. If the report
  excludes Scotland (devolved), the PIP runs overstate.
- Age band: the page's package removes PIP from 18 and the health element
  from every under-25. A report saying 16–24 or 18–24 for both changes the
  package (the 16–24 PIP run alone saves £4.42bn against £3.44bn).
- The new-claimant rate is assigned to a random 13% regardless of age; the
  note estimates £0.9bn rather than £1.15bn at a 50% mix (232k × the mixed
  rate = £0.92bn: consistent).

## 4. Tests that will fail when the data change

Measured, not inferred. The repository was copied outside the working tree
and the whole Vitest suite (724 suites, 2,439 tests) run three times: as
committed; with every number in `milburn_summary.json`,
`milburn_scenarios.json`, the per-run CSVs and the two typed benchmark
estimates changed by about 7%; and then also with the build id, engine
version and dataset hash changed in every data file. The copy left out
`data_inputs/`, so ten tests that read it failed in all three runs for that
reason alone; those files (the constituency map, regions, OBR notes,
`PolicyCards.test.jsx` and `publicFilesBudgetWeek.test.js`, 21 files, 253
tests) were then re-run on the perturbed copy with `data_inputs/` restored
and all passed, as they do on the committed repository. The build's
public-file gate, `scripts/check-public-files.mjs`, reports "0 problem(s)
in public/" on the committed data and on the perturbed data: it does not
bind the Milburn files' contents. The Python gate
(`scripts/check_public_data.py`) and the Python tests were not run.

### 4.1 Fail when the data change: 7 tests in 3 files

The same seven fail in both perturbed runs; no other Vitest test failed
because of the changed Milburn data.

| Test file:line | Test | Pins | Reads |
|---|---|---|---|
| `src/utils/milburn/summary.test.jsx:263-269` | the published summary › gives the packages' range | "£4.49bn", "about 410,000"; "£2.54bn", "about 314,000"; "£2.01bn", "about 143,000" | `public/data/milburn_summary.json` |
| `src/utils/milburn/summary.test.jsx:271-280` | … › leads Return to work with the 25% entry run | "£4.49bn", "£4.61bn", "+0.59pp (about 410,000 people)", "+0.39pp (about 272,000 people)", "£12,622", "£11,305" | same |
| `src/utils/milburn/summary.test.jsx:287-293` | the poverty card's direct count › reads the summary's count | 409743 | same |
| `src/utils/milburn/summary.test.jsx:295-303` | … › replaces pp × population | 0.589, −409743, "410,000" (412 is arithmetic on a literal) | same |
| `src/utils/milburn/milburn.test.js:95-121` | the benchmarks file › fills a PolicyEngine estimate only where… | label "PolicyEngine, build 6f918b81, 2027-28" (104), "232,000" (107), "£4.43bn a year" (108) | `public/data/milburn_benchmarks.json` |
| `src/utils/milburn/milburn.test.js:135-150` | the benchmark charts › pair a published figure with a fixed estimate | 260000 / 232000; 5.1 / 4.43; "£5.1bn", "£4.43bn" | same |
| `src/components/milburn/milburnTabs.test.jsx:76-130` | Benchmarks › lists every published figure | "232,000", the build label (96), "£4.43bn a year", "PolicyEngine is 10.77% lower", "PolicyEngine is 13.14% lower"; also the published "260,000", "62,570", "£5.1bn a year", "May 2026" and the order of row ids (99-116) | same |

To update: the three summary tests take their new strings straight from the
new `milburn_summary.json` (formatted by `formatBn`, `formatPeople`,
`formatPounds`, `formatSignedPp`); the benchmark tests change only if the
two typed estimates or the label in `milburn_benchmarks.json` change, and
the two "% lower" strings are (estimate − published) ÷ published to two
places.

Tests that look pinned but do **not** fail on new data (they format a
literal or read `src/test/fixtures/milburn/`, which holds invented
figures): `summary.test.jsx:105-106` (`formatBn(4.486)`,
`formatPeople(578166)`), every other test in `summary.test.jsx`,
`localBuild.test.jsx`, the Return to work tests in `milburnTabs.test.jsx`,
and `tabsSmoke.test.jsx` (reads the real `public/` but asserts headings and
no errors, not values: it passed on the perturbed data).

### 4.2 Fail only when a hand-typed constant is edited

| Edit | Tests to update |
|---|---|
| `ReplicationLine.jsx` build or engine | `ReplicationLine.test.jsx:6-9`, `MethodologyTab.test.jsx:129,220`, `landing.test.jsx:370` |
| `MethodologyTab.jsx` core version or build name | `MethodologyTab.test.jsx:221-222` |
| `MethodologyTab.jsx` limitations ("nine in ten", "about 23%") | `MethodologyTab.test.jsx:105-106` |
| `LandingPage.jsx` intro (the 17 November sentence) | `landing.test.jsx:14` |
| `measureVisuals.js` `MILBURN_RATES` or `MILBURN_PHASING` | `MilburnVisual.test.jsx:26,45,60,63-64,69-72,77-78,83` |
| Age limits or `from`/`share` in `policyDetails.js` visual specs | `MilburnVisual.test.jsx:27-28,33-34,40,46,49-50,53-55,84` (bar counts) |
| "With a quarter moving into work" heading, `SCENARIOS_LABEL` | `tabsSmoke.test.jsx:99`, `milburnTabs.test.jsx:55`, `summary.test.jsx:310` (the heading; no test names `SCENARIOS_LABEL`'s text) |
| Run names in `measureGroups.js` | `summary.test.jsx:154,332`, `measureCatalogue.test.jsx` |
| `KeyFigures.jsx` replacement notes | `summary.test.jsx` |
| `CANDIDATE_PROVISIONAL_LABEL` | `utils/publication/manifest.test.js`, `components/publication/publication.test.jsx` |
| `local_build.py` build, hash, engine | `localBuild.test.jsx:30,92,227` only if the fixture is changed too (it need not be) |

### 4.3 Fail when measures are added, dropped or renamed

| Change | Tests |
|---|---|
| The registry's ids or order (`reforms.py`) | `tests/test_milburn_measures.py:271-290` (exact list of 13), `:293-303` (the four not computable), `:408` (central registered) |
| Card entries | `src/utils/policyDetails.test.js:142-153` (12 ids), `MilburnVisual.test.jsx:14-21` |
| Groups and hidden runs | `summary.test.jsx:330-359`, `measureCatalogue.test.jsx:285` |
| Not-computable list | `milburn.test.js:170-183` ("lists the four") |
| Benchmark rows | `milburn.test.js:84-121,163-168`, `milburnTabs.test.jsx:99-116` |

### 4.4 Python tests: pin the engine and the rules, not the results

No Python test reads `public/data/milburn*`. `tests/test_milburn_measures.py`
(not run here; it needs the engine and a few minutes) fails when the rules
or the engine's parameters change:

| Lines | Pins |
|---|---|
| 34-41, 98-125 | 2027-28 amounts: £442.103151, £217.26, £353.170149, £443.209866, £79.384373, £82.799868, 15%, £5,000; the s. 4 floor from £429.80 + £338.58 |
| 129-171, 358-376 | Health element lost under 25 (£5,305.24), kept at 26, new-claimant rate (£2,607.12), under 22 at 21 but not 23 |
| 181-199, 403-414 | PIP: £8,433.58 lost at 20, kept at 17; half rate; from 16 |
| 203-248 | Employer NICs £2,250 on £20,000 and £1,620 net; youth allowance £1,080.48 |
| 254-268 | Package for a 20-year-old: £14,799.86, with the housing element falling to £4,938.96 |
| 306-356 | Entry scenario: year 2027, £13.21, rent £6,000 |
| 391-398, 417-421 | 24 or more daily living points; an 18-year-old reached at once by the phased package |

If the report changes the age band, start date or rates, these change with
`reforms.py`; if only the dataset build changes, they do not.

## 5. Order of work tomorrow, to avoid stale numbers

The risks are structural, not in the copy:

1. **`milburn_summary.json` is written by a separate script.** Key figures,
   Return to work and the break-even panel read it; the charts read the
   CSVs. Nothing on the page or in the tests checks that the two agree, and
   seven tests will go red *only* if the summary changes. Regenerate
   `milburn_scenarios.json` first (the summary reads it for the break-even),
   then every run, then `scripts/milburn_summary.py`.
2. **A folder that is not re-run still shows.** A run is displayed whenever
   its folder has a `model_build.json`. If a measure is renamed or dropped,
   delete its folder; if any run is skipped, its old figures stay beside
   new ones. The page joins differing labels with "; "
   (`localBuild.js:185`), which is the only visible sign. Check that all
   folders carry one build, hash and engine before publishing.
3. **Two benchmark estimates are typed by hand** (232,000 and £4.43bn) and
   the first needs a baseline caseload query on the new build.
4. **Six hand-typed copies of the build and engine** (1.1) if the build
   changes.
5. Then the copy in 1.2 to 1.4, the seven tests in 4.1, `bun run test`,
   `bun scripts/check-public-files.mjs`, and a rebuild of
   `artifact-export/` if the private artifact is republished.

Worth deciding before the numbers land: the wording of the phased share
(3.1), the "25%" wording (3.2), and whether the break-even share stays on
the page in its current form (3.3).
