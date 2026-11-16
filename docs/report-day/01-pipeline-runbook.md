# Report day (17 November 2026): pipeline runbook

Written 16 November 2026 from a read-only review. Internal: figures come from
Microcosm build 6f918b81 on policyengine-uk 2.177.7 (not certified), stay in
private repos, and carry the HMRC SPI condition (confirm with María before
anything is public). Nothing here has been run except the unit tests noted in
section 4. Line numbers are at commit `0287c2d7`.

## 0. Five things to know first

- **No Hugging Face token.** This build needs the token *unset* (`HUGGING_FACE_TOKEN`,
  `HF_TOKEN`, `HUGGINGFACE_HUB_TOKEN`). `.claude/CLAUDE.md:42` and `README.md:57`
  say the opposite; they describe the Budget dashboard and are stale here. Do not
  run `uv lock --upgrade-package policyengine` (`.claude/CLAUDE.md:36`): the engine
  is pinned by `pyproject.toml:83-85` and must stay 2.177.7 / core 3.34.10.
- **Only changed runs need re-running, if the smoke run reproduces.** Build,
  engine and seeds are fixed, so a run whose definition does not change (the
  comparators, the upper bound) should still be valid from 15 November. This
  is not yet shown: section 4's smoke run tests it. Re-run only ids whose code
  changes once that diff is empty.
- **A national run takes about 6.5 to 9.5 minutes** (five years, one measure;
  inferred from the 15 November file times, section 2). All 13 in series took
  about 1 h 40 min.
- **UC health is never a parameter edit.** The engine stores `uc_LCWRA_element`
  as an input for 2026-27 to 2032-33 (`policyengine_uk/scenarios/uc_reform.py:307-350`),
  and its rate parameters are not split by age. Every UC health change goes
  through the modifier in `budget_measures/uc_health_element_removed_under_25.py`.
- **The lock is held by another session right now** (`/tmp/pe-heavy.lock`:
  `56348 uk-ai-study phase1-states6`, PID alive at 20:10 on 16 November) and swap
  was 8.9 of 10 GB used. Agree the handover with that session before report day.

## 1. Design elements: where to change, and what we cannot model

Paths are under `src/uk_budget_data/`. "Edit" = change a constant or argument;
"code" = new function plus a registry entry in `reforms.py` (and the frontend
lists in section 5). Every edit also needs the measure's published name and
description rewritten: each `Reform` in `reforms.py:1334-1612` states its age
band and "From April 2027" in fixed text, and the page shows that text.

### Age band (16-24 or 18-24)

| Part | Where | Kind |
|---|---|---|
| PIP lower and upper age | `budget_measures/pip_removed_ages_18_to_24.py:15-16` (`lowest_age=18`, `age_limit=25`); 16-24 already registered as `pip_removed_16_to_24` (`:66-68`) | Edit |
| UC health upper age | `budget_measures/uc_health_element_removed_under_25.py:23` (`age_limit=25`) | Edit |
| UC health lower age (16-17s keep it) | Not there: the modifier removes it for everyone under `age_limit` (`:56-60`). Add `lowest_age` and keep where `age < lowest_age` | Small code |
| A 16-24 package | None registered: `MILBURN_PACKAGE_COMPONENTS` is health element + PIP 18-24 (`reforms.py:1506`). Add a package of `uc_health_element_removed_under_25` + `pip_removed_16_to_24` through `_create_milburn_package` (`reforms.py:1637-1668`, used at `:1688-1701`) | Small code |
| Phased and entry variants | Ages hard-coded: `budget_measures/milburn_variants.py:41` (`age - 18`), `:59` (`age >= 25`), `:79`, `:106-107` | Code (make them arguments) |

Cannot model: 16-17-year-olds on DLA for children moving to PIP at 16, or
Scotland's Child Disability Payment to 18; the data hold PIP points only.

### Youth allowance rate

- At the under-25 UC rate (as briefed): no change to awards, nothing to run.
  `youth_allowance_at_25_plus_rate` stays as a comparator.
- A different amount: parameter edit on
  `gov.dwp.universal_credit.standard_allowance.amount.SINGLE_YOUNG` and
  `.COUPLE_YOUNG` (monthly). `youth_allowance_rates()` (`reforms.py:1278-1299`)
  copies the 25-and-over amounts; to set given amounts, replace the lookup at
  `:1293-1295` with the report's monthly figures. Give every year 2027 to 2031
  (the amounts are uprated). Keep the `protected_health_element` pin
  (`reforms.py:1400-1405`, `current_law_protected_health_element()` `:1302-1331`),
  or the s. 4 floor moves every protected claimant's element.
- A separate benefit (own means test, a rate for those living with parents,
  paid from 16): new code, a modifier on the standard allowance by household
  composition. Parental income tests and anything resting on education or
  training status cannot be modelled reliably.

### UC health (LCWRA) element: abolition and who keeps it

| Design | Where | Kind |
|---|---|---|
| Removed for all under-25s | `uc_health_element_removed_under_25` (registered) | None |
| New claims only | `uc_health_element_removed_under_25_new_claims` (registered). The flag is a random 13% draw blind to age (`uc_reform.py:313-331`, `rebalancing/new_claimant_share.yaml`), so this is weak | None |
| Severe cases keep it | Proxy only: `keep_enhanced_pip_daily_living`, threshold `SEVERE_DL_POINTS = 24` (`uc_health_element_removed_under_25.py:16`, `:61-71`) | Edit (threshold); code for another proxy, e.g. enhanced rate of both components |
| Paid at a lower rate instead of nil | Not there: the modifier writes `0.0` (`:73-75`). Add a replacement monthly amount | Small code |
| LCWRA status itself removed (work allowance, conditionality group) | Not there; status is left alone by design (`:45-46`) | Code |

Cannot model: the severe conditions criteria, terminal illness and "can never
work" (no flag in the data); claim dates; new-style ESA.

### PIP replacement

| Element | What we can do | Kind |
|---|---|---|
| Discretionary local fund | Not microsimulable (no allocation rule). Report the fund's budget as an aggregate offset to the saving, with the removal as the household upper bound. A uniform share is the only stand-in: `share_kept` (`pip_removed_ages_18_to_24.py:18`), registered at 0.5 as `pip_halved_under_25` | Edit for 0.5; small code for another share |
| Additional cost allowance for the most disabled | Not there. Needs a tiered rule: who qualifies (by `pip_dl_points` / `pip_m_points` or category) and a flat weekly amount or share. `share_kept` is uniform across recipients | Code |
| Higher insurance-type payment for those who can never work | Eligibility cannot be identified; proxy as for severe cases, paying a flat amount to that group. If it rests on contribution records, not modellable (no NI history) | Code, proxy only |

State with any figure: per the modifier's docstring
(`pip_removed_ages_18_to_24.py:33-37`) and the analysis note, the engine's
passports (Carer's Allowance, disability premia, benefit cap and non-dependant
exemptions) follow the PIP amounts; `has_enhanced_pip_dl_award` in the engine
reads the amount against the enhanced rate, which confirms it for the premia.
So a stand-in paid through `pip_dl`/`pip_m` keeps or loses them by amount. Whether
the real allowance passports is the report's call and moves the saving by
about £0.5bn (analysis note, "Caseload check").

### Start date, migration, transitional protection

- **Start year** is in several places that must move together:
  `reforms.py:1254` (`MILBURN_FIRST_YEAR`); modifier defaults
  `uc_health_element_removed_under_25.py:21`, `..._new_claims.py:19`,
  `pip_removed_ages_18_to_24.py:14`, `milburn_variants.py:46, 69, 91`;
  `milburn_variants.py:28` (`START = 2026`, the cohort origin);
  `milburn_scenarios.py:32` and `scripts/milburn_summary.py:19` (`YEAR = 2027`);
  frontend `src/utils/milburn/measureVisuals.js:37, 55`; and `--years` on the
  command line. Years after 2031-32 are not available (`budget_years.json`).
- **Mid-year start**: the modifiers work in whole fiscal years. Pro-rating is
  new code; otherwise report the first full year.
- **Natural migration**: `milburn_package_phased`. The rate is
  `REASSESSED_EACH_YEAR = 0.25` (`milburn_variants.py:29`), one edit. A
  year-by-year schedule from the report is small code in `reached()` (`:37-43`).
- **Transitional protection** (existing claimants keep their cash): set the
  reassessment rate to 0, which leaves new entrants only. Limits: a "new
  entrant" is someone turning 18 (`:41`), so new claims at 19 to 24 are missed,
  and erosion of protection is not modelled.
- **Phased central variant**: does not exist; the phased functions hard-code
  full removal (`:59-66`, `:79-80`). Code.

### Scotland (ADP) and Northern Ireland

- PIP: `include_scotland` exists (`pip_removed_ages_18_to_24.py:17, 48-52`) but no
  registered run uses it; every PIP run reaches Scottish ADP records. An
  England-and-Wales (or GB excluding Scotland) run is a wrapper plus a registry
  entry. Excluding Northern Ireland needs a country list in place of the flag.
- UC health: no country switch in either UC modifier. UC is reserved in
  Scotland, so only Northern Ireland would need one. Small code.
- Cannot model: block grant adjustments, any Scottish Government response, and
  small-sample noise (Scotland and NI are a small share of ~500-650 records).

### Opportunity guarantee and conditionality

- Not modellable: listed as `youth_conditionality` and
  `youth_guarantee_expansion` with reasons (`reforms.py:1468-1491`). Update the
  wording there on the day; no figure.
- Illustrative only: `_employment_response(sim, share, hours=16)`
  (`milburn_variants.py:91-119`); only the 25% wrapper is registered (`:122-134`).
  Another share or hours is a wrapper plus a registry entry. Household entry
  cases: `milburn_scenarios.py:32-38` (`AGE`, rent, `ENTRY_HOURS`).
- Sanctions ("benefits at risk if refused"): no code. An illustrative scenario
  would be new code; programme costs are arithmetic outside the model.

## 2. Commands, in order

All from the repository root. Use `.venv/bin/...`, not `uv run`: `uv run` can
resync the shared venv under a running job.

### 2.0 Shell

```bash
cd /Users/vahid/uk-milburn-review-dashboard
unset HUGGING_FACE_TOKEN HF_TOKEN HUGGINGFACE_HUB_TOKEN
.venv/bin/python -c "from uk_budget_data import local_build as b; b.check_engine(); print(b.check_dataset())"
```

Only `MILBURN_DATASET` (optional, same SHA-256) is read. Never set
`MILBURN_ALLOW_TEST_DATASET`.

### 2.1 After editing measures: tests (light, no lock)

```bash
.venv/bin/python -m pytest tests/test_milburn_measures.py -n 2 -q
.venv/bin/uk-budget-data generate --list-reforms
```

27 tests passed on 16 November in about 6 minutes at `-n 2` (machine under
load). `test_the_registry_holds_the_milburn_measures_only`
(`tests/test_milburn_measures.py:271-290`) lists the ids and must be edited
with the registry.

### 2.2 Household-only files (light, no lock, a minute or two each)

```bash
.venv/bin/uk-budget-data milburn-measures  --output public/data/milburn_measures.json
.venv/bin/uk-budget-data milburn-scenarios --output public/data/milburn_scenarios.json
```

- `milburn_measures.json`: the catalogue the page reads. Its presence switches
  the page to the local route (`next.config.ts:42-44`).
- `milburn_scenarios.json`: entry-to-work cases under `MILBURN_PACKAGE_ID`
  (`milburn_scenarios.py:110`). Must be regenerated **before** the summary.
- Skip the `income-curve` step in `docs/milburn-local-run.md:88`: every
  national run already writes `income_curve.csv` into its folder, and that
  command would write `public/data/income_curve.csv`, which nothing on the
  local route reads.

### 2.3 National runs (heavy; serial; hold `/tmp/pe-heavy.lock`)

One measure per process and per folder. Write to a staging folder outside the
repo and `/tmp`, then copy, so the page never reads a half-written folder (the
old `model_build.json` stays in place during an in-place re-run).

```bash
setopt pipefail                      # zsh: a failed generate fails the pipe through tee
STAGE=~/milburn-runs/20261117
LOCK=/tmp/pe-heavy.lock
take_lock() {  # take_lock <job>: wait until free or its holder is dead, then write "<pid> <project> <job>"
  while [ -e "$LOCK" ] && ps -p "$(cut -d' ' -f1 "$LOCK")" >/dev/null 2>&1; do sleep 30; done
  echo "$$ uk-milburn $1" > "$LOCK"
}
run() {  # run <measure id>
  rm -rf "$STAGE/$1"                 # never reuse an earlier attempt's model_build.json
  /usr/bin/time -l .venv/bin/uk-budget-data generate --skip-input-check \
    --reforms "$1" --years 2027 2028 2029 2030 2031 \
    --output-dir "$STAGE/$1" 2>&1 | tee "$STAGE/$1.log" \
  && test -f "$STAGE/$1/model_build.json" \
  && rsync -a --delete "$STAGE/$1/" "public/data/milburn/$1/"
}
mkdir -p "$STAGE"
take_lock report-day; trap 'rm -f "$LOCK"' EXIT INT TERM
for id in milburn_package uc_health_element_removed_under_25 pip_removed_under_25 \
          milburn_package_phased milburn_package_central milburn_package_entry_25pct; do
  run "$id" || break
done
```

- Replace the id list with the ids that changed, report-faithful package first.
- Each run writes `budgetary_impact.csv`, `distributional_impact.csv`,
  `winners_losers.csv`, `metrics.csv`, `age_impact.csv` (the five the page
  requires, `src/utils/milburn/localBuild.js:37-43`),
  `household_scatter_binned.csv` (optional on the page), `income_curve.csv`,
  `obr_comparison.csv` and, last, `model_build.json`.
- Lock: `take_lock` is inferred from the file's contents today
  (`56348 uk-ai-study phase1-states6`); no helper script exists in this repo
  and macOS has no `flock`. The check-then-write is not atomic, so do not
  start two loops at once, and message the owning session before touching its
  job. Untested.
- Time (inferred from 15 November file times, runs back to back):
  12:41 package, then 9, 9.5, 9.5, 7, 7, 8.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5
  minutes. Budget 8 minutes a run: package plus two parts about 25 minutes,
  six runs about 50 minutes.
- Memory: about 23 GB footprint per run is the doc's estimate
  (`docs/milburn-local-run.md:124-130`), not measured on this build.
- Parallel: `--jobs N` exists (`parallel.py:411-432`) but puts every measure in
  one folder, which the page's one-folder-per-run layout does not read. Under
  the one-heavy-job rule, run serially. Do not use `--backend modal`: the
  build is a local file and results stay private.
- Light steps (2.1, 2.2, 2.4, the frontend) can run beside a national run.

### 2.4 Summary, then the hand-edited files (light)

```bash
python3 scripts/milburn_summary.py > "$STAGE/summary-table.md"   # writes public/data/milburn_summary.json
```

- The script reads every folder under `public/data/milburn/` that has a
  `model_build.json` (`scripts/milburn_summary.py:118-122`). Delete the folder
  of any run you drop, or it stays in the summary and the table.
- Paste the table into `docs/milburn-analysis.md`.
- `public/data/milburn_benchmarks.json` has no writer. Two PolicyEngine figures
  are typed in by hand: line 27 (`232,000`, the caseload figure) and line 112
  (`£4.43bn a year`, the employer NICs cost), with their labels at lines 29
  and 114. The `package_young_people_affected` row reads the package run.

### 2.5 Frontend and export

```bash
bun run test            # vitest; several tests read public/data/milburn_*.json
bun run dev             # http://localhost:3000/uk/milburn-review
python3 scripts/artifact_export.py   # only for a private artifact; copies public/data
```

## 3. What to drop, keep and prepare

**Keep without re-running** (definitions will not change): `employer_nics_zero_under_25`
and `youth_allowance_at_25_plus_rate` (comparators), `uc_health_element_removed_under_22`
(the 2025 green paper age), and `milburn_package` with its two parts as the
upper bound if the report's age band matches.

**Re-run on the day**: the report-faithful package, its parts, its phased
version, and `milburn_package_entry_25pct` if the package changes (Return to
work reads it, `src/utils/milburn/summary.js:36`).

**Drop candidates**: `uc_health_element_removed_under_25_new_claims` (hidden on
the page, rests on a random flag); `pip_halved_under_25` and
`milburn_package_central` once the report gives the allowance's real rules;
whichever of `pip_removed_under_25` / `pip_removed_16_to_24` is the wrong band.

**Which id is the headline.** Recommended: the report's design takes a new
id (for example `milburn_report`) and `milburn_package` stays as the upper
bound with its 15 November results. `milburn_package` is wired in as "the"
package in these places, which must then be repointed together:

- `reforms.py:1262` (`MILBURN_PACKAGE_ID`), `:1506` (components), `:1615-1616`
  (`COMBINED_ID`, `COMBINED_COMPONENTS`);
- `milburn_scenarios.py:110` (the package the entry cases run under) and its
  basis text and notes (`:133-163`);
- `milburn_measures.py:38-42` (the one run given members);
- `src/utils/milburn/localBuild.js:193` (first run with members is the package);
- `src/utils/milburn/summary.js:33` (`DEFAULT_SUMMARY_RUN`), `:36` (`ENTRY_RUN`);
- `src/utils/milburn/measureGroups.js:10-57` (names, groups, parts);
- `public/data/milburn_benchmarks.json` row `package_young_people_affected`
  (`"run": "package"`).

The alternative (the report design takes over `milburn_package`) needs none of
these edits but overwrites the upper bound and leaves no trace in
`model_build.json` of which design a folder holds.

**Prepare tonight so the day is a parameter change:**

1. One set of design constants read by every modifier: lower and upper age,
   start year, severe threshold, PIP share or tiers, countries, reassessment
   rate. Today these are spread over three modules.
2. Arguments in place of the hard-coded ages in `milburn_variants.py`.
3. New options, each with a household test: `lowest_age` and a replacement
   amount on the UC modifier; a tiered PIP replacement (points threshold plus
   flat amount); a country list on both modifiers; a new-entrants-only
   (transitional protection) variant; a phased version of any package.
4. Registry ids reserved now, so the frontend lists are edited once:
   a report package, its phased version, a 16-24 package, an
   England-and-Wales PIP run.
5. `milburn_measures.py:38-42` writing members for every package, not only
   `milburn_package`.
6. A caseload script (section 4) and the run loop above as a script.
7. Runs that are safe to make tonight because the report cannot change them:
   the 16-24 package and the PIP run excluding Scotland (about 8 minutes
   each), so both age bands and both Scottish treatments are in hand.

## 4. Checks

### Pre-flight (tonight)

```bash
cd /Users/vahid/uk-milburn-review-dashboard
git status --short && git log -1 --oneline                    # clean, 0287c2d7 or later
env | grep -ci 'hugging\|^HF_'                                # 0
.venv/bin/python -c "from uk_budget_data import local_build as b; b.check_engine(); print(b.check_dataset())"
shasum -a 256 /Users/vahid/data/microcosm/releases/microcosm-uk-2024-25-national/uk-frs-calibration-attempt-20261112T133744Z-6f918b81/microcosm_uk_2024_25.h5
#   e268e3af7932784ad4471f008097a5acc6c3c5bc15c4c54fbb5a489b2a0ac9ae
cat /tmp/pe-heavy.lock; ps -p "$(cut -d' ' -f1 /tmp/pe-heavy.lock)"   # who holds it, still alive?
sysctl vm.swapusage; vm_stat | head -5; df -h /System/Volumes/Data
.venv/bin/uk-budget-data generate --list-reforms              # 13 ids today
.venv/bin/python -m pytest tests/test_milburn_measures.py -n 2 -q
gh repo view --json visibility                                # PRIVATE
```

Smoke run tonight, under the lock (about 8 minutes): re-run one unchanged id
to staging and compare with the committed folder. An empty diff shows runs
reproduce, and gives a measured time and peak memory for this build. Repeat it
after any refactor from section 3.

```bash
STAGE=~/milburn-runs/20261116; mkdir -p "$STAGE"; setopt pipefail   # hold /tmp/pe-heavy.lock first (2.3)
run_only() { rm -rf "$STAGE/$1"; /usr/bin/time -l .venv/bin/uk-budget-data generate --skip-input-check \
  --reforms "$1" --years 2027 2028 2029 2030 2031 --output-dir "$STAGE/$1" 2>&1 | tee "$STAGE/$1.log"; }
run_only uc_health_element_removed_under_22
diff -r "$STAGE/uc_health_element_removed_under_22" public/data/milburn/uc_health_element_removed_under_22 && echo identical
```

Seen on 16 November: engine 2.177.7 / core 3.34.10 / policyengine 6.19.0
installed; dataset present (414 MB); no token in the environment; 601 GB free;
64 GB RAM, 18 cores; repo private; lock held by another session; swap nearly
full. `~/.cache/huggingface/token` exists; the 15 November runs worked with it
there, so it is not expected to matter.

### After re-running

- Every re-run folder has all nine files and a `model_build.json` with
  `"certified": false`, the build id, the SHA-256 and years 2027 to 2031.
- **Caseloads** (baseline, 2027-28; analysis note): PIP 347k aged 18-24
  (£2.91bn), 435k aged 16-24 (£3.72bn), 4.29m in all (£32.8bn); 232k benefit
  units with LCWRA in which every adult is under 25; 2.79m LCWRA units in all.
  The baseline does not change with the report, so these should reproduce
  exactly. No script in the repo produced them. Untested sketch (one baseline
  simulation, so run it under the lock):

  ```python
  from uk_budget_data import local_build
  sim = local_build.build_microsimulation(); Y = 2027
  age, pip = sim.calculate("age", Y), sim.calculate("pip", Y)
  for lo in (18, 16):
      m = (age >= lo) & (age < 25) & (pip > 0)
      print(lo, m.sum(), pip[m].sum() / 1e9)
  print((pip > 0).sum(), pip.sum() / 1e9)
  el, eldest = sim.calculate("uc_LCWRA_element", Y), sim.calculate("eldest_adult_age", Y)
  print(((el > 0) & (eldest < 25)).sum(), (el > 0).sum())
  ```

  Add the same counts by `country` if the report splits Scotland or NI.
- **Summary consistency**: package saving is no more than the sum of its parts
  (15 November: £4.49bn against £1.15bn + £3.44bn); phased is below full in
  every year and approaches it by 2031-32; a severe-kept or reduced-rate run
  saves less than full removal; the same 16-24 headcount in losing households
  for a package and its reduced-rate version; break-even shares present only
  for loss runs; `milburn_summary.json` lists exactly the folders intended.
- PIP removal saving against direct PIP for the band: the gap (about £0.5bn at
  18-24) is passported benefits; a much larger gap needs explaining.
- **Public-file checks**: both pass on today's `public/` (run 16 November):

  ```bash
  bun scripts/check-public-files.mjs            # "0 problem(s) in public/"; `bun run build` runs it first
  .venv/bin/python scripts/check_public_data.py # "0 problem(s), 0 file(s) pending a decision."
  ```

  Run both after new folders land. `node` is not on the PATH in a plain shell
  on this machine; `bun` runs the script.
- Page: each run shows the "not certified" label; no run is "Not yet run"
  unless intended; Return to work reads the entry run.

## 5. Risks and fragile points

- **Lock and memory**: `/tmp/pe-heavy.lock` held by a live uk-ai-study job and
  swap 8.9/10 GB at 20:10 on 16 November. A national run needs about 23 GB.
- **Token and stale instructions**: `.claude/CLAUDE.md:36-42`, `README.md:57`
  (and the README title and links) describe the Budget dashboard. Following
  them breaks this build.
- **`docs/milburn-local-run.md:105-111`** loops over 6 ids; 13 are registered.
  `:88` income-curve step is redundant.
- **No record of the code behind a run**: `local_build.py:167-177` writes no
  commit or definition hash, so a re-parameterised run under an old id looks
  identical to the 15 November one. Use new ids for changed designs, or note
  the commit in the log.
- **Stale folders**: `scripts/milburn_summary.py:118-122` sweeps every folder;
  the page shows a folder as soon as `model_build.json` exists
  (`src/utils/milburn/localBuild.js:227-246`), including an old one during an
  in-place re-run.
- **One reform per folder assumed**: `scripts/milburn_summary.py:30-33` keys
  the saving by year only.
- **Hard-coded year**: `scripts/milburn_summary.py:19`, `milburn_scenarios.py:32`.
  With a later start the 2027 headline is zero.
- **Break-even uses one household case for every run**
  (`scripts/milburn_summary.py:91-112`): a single 22-year-old renter under
  `milburn_package`, whatever the run or age band.
- **Hard-coded ages and years in variants**: `milburn_variants.py:28-29, 41,
  59, 79, 91, 106-107`. Changing the band in the PIP or UC module does not
  reach the phased or entry runs.
- **Phased cohort rule** (`milburn_variants.py:37-43`): new entrants are those
  turning 18 only; the reassessment rate is an assumption, not a DWP figure.
- **New-claims flag is random and blind to age** (`uc_reform.py:313-331`); the
  health element mix (13% on the new rate) probably understates young new
  claimants (analysis note, "Health element rate").
- **Package members written for one id only**: `milburn_measures.py:38-42`;
  the page takes the first run with members as "the" package
  (`localBuild.js:193`), and parts for other packages are typed in
  `src/utils/milburn/measureGroups.js:54-57`.
- **Ids typed into the frontend**: `measureGroups.js:10-47`,
  `src/utils/milburn/summary.js:33, 36`, `src/utils/policyDetails.js:689-902`,
  and rates typed into `measureVisuals.js:37-55`. A new id shows as an
  ungrouped single measure with no detail entry until these are edited.
- **Default package description is fixed text** (`reforms.py:1658-1662`).
- **Benchmarks are hand-typed** (`public/data/milburn_benchmarks.json:27, 112`).
- **Scenario text is fixed**: `milburn_scenarios.py:133-163` describes the
  package and its notes ("no PIP", "health element removed for under-25s and
  PIP removed for 18 to 24-year-olds") whatever the package becomes.
- **PIP from 16 looks large**: `pip_removed_16_to_24` adds £0.98bn and about
  190k people in absolute AHC poverty for 87k more recipients than the 18-24
  run. Check before quoting; the sample is small.
- **Private data**: `public/data/milburn/` is committed (private repo,
  `d8b32bfe`); `scripts/artifact_export.py` copies `data/` into the export
  (`:90-119`). Keep both private and confirm the SPI condition first.
- **`/tmp` is cleaned by macOS**: keep staging and logs outside it.
