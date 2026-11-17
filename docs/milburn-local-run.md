# Milburn review: local run

How to go from the Milburn measures in `src/uk_budget_data/reforms.py` to a
local page that shows them. Read "What does not work on this build" first:
the Autumn Budget dashboard's verified publication route cannot run on the
data build the review uses.

## The build

> **Since 16 November 2026 the runs use a certified build.** policyengine
> 6.20.1 (policyengine.py PR 759) certifies Microcosm build `fcfac709` with
> policyengine-uk 2.177.7 and core 3.34.10, so `pyproject.toml` depends on
> `policyengine[uk]>=6.20.1` with no engine override, and
> `local_build.bundle_certifies()` checks the file against the installed
> bundle. Sections below that describe the uncertified build `6f918b81`
> (engine override, "not in a policyengine.py release", refused bundle) are
> history; the token, environment and command steps still hold.

| | |
|---|---|
| Data | Microcosm build `uk-frs-calibration-attempt-20261115T104657Z-fcfac709`, `microcosm_uk_2024_25.h5`, SHA-256 `301d2fe5e7805c5a6242b37843cb118445aefd59a0593833362ab5a6e2f9ba90` |
| Engine | policyengine-uk 2.177.7, policyengine-core 3.34.10 (pinned by the bundle) |
| Bundle | policyengine 6.20.1, whose UK data release certifies this build |
| Label carried into outputs | `build fcfac709, policyengine-uk 2.177.7, certified in policyengine 6.20.1` |

Fetch the file once (it reads the Hugging Face CLI token; nothing is printed):

```bash
.venv/bin/python - <<'PY'
import shutil; from pathlib import Path
from huggingface_hub import hf_hub_download
path = "releases/microcosm-uk-2024-25-national/uk-frs-calibration-attempt-20261115T104657Z-fcfac709/microcosm_uk_2024_25.h5"
f = hf_hub_download("policyengine/populace-uk-private", path, repo_type="dataset", revision="ad84c0602ed28f694ef52662eb9b063779e4e923")
dest = Path("/Users/vahid/data/microcosm") / path; dest.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(f, dest)
PY
```
`src/uk_budget_data/local_build.py` holds the build id, hash, engine and
label, and every national simulation goes through it
(`pipeline.build_microsimulation`):

- it refuses any other policyengine-uk or policyengine-core version;
- it refuses any file whose SHA-256 is not the build's (the default path is
  `/Users/vahid/data/microcosm/releases/microcosm-uk-2024-25-national/<build>/microcosm_uk_2024_25.h5`;
  `MILBURN_DATASET` points elsewhere, with the same hash);
- it never loads the bundle's eeb6093e dataset: the living standards
  projections, which only run on the bundle's dataset, refuse on this
  engine;
- `uk_budget_data` drops `HUGGING_FACE_TOKEN`, `HF_TOKEN` and
  `HUGGINGFACE_HUB_TOKEN` when it is imported on this engine. With a token
  set, importing policyengine 6.19.0 fetches its data certificate and raises
  `Data release manifest is not certified for the runtime model version
  2.177.7`. No download is needed. Do not export the token in the shell
  running these commands either (the pytest main process and other tools
  import policyengine directly).

`MILBURN_ALLOW_TEST_DATASET=1` lets the plumbing run on the invented
`synthetic_dataset`, for tests only. Never set it for a real run.

## What does not work on this build

The page's figures come only through the verified route: `generate
--artifacts` writes a receipted artifact per measure, `publish
stage/approve/index/check` binds them into `public/data/manifest.json`, and
the page checks each receipt. The receipts come from policyengine.py
6.19.0's `build_execution_receipt_for_microsimulation`. It resolves the file
by its name to the bundle's `microcosm_uk_2024_25` and refuses any other
bytes:

```
REFUSED: The file is not the bundle's 'microcosm_uk_2024_25': it hashes to
<sha>, but hf://policyengine/populace-uk-private/microcosm_uk_2024_25.h5@
microcosm-uk-2024-25-national-20261107T020434Z-eeb6093e is 0a9b77db...
```

(checked with `generate_artifacts` on the synthetic dataset saved as
`microcosm_uk_2024_25.h5`; under another name it refuses because the name is
not a bundle dataset). So on build 6f918b81:

- `generate --artifacts`, `generate --combined`, `publish stage`,
  `approve`, `index` and `check` cannot produce entries, and
  `scripts/precompute_household_presets.py`, which records each published
  measure's receipt, has nothing to bind to;
- relaxing this is not a flag: the receipt, its certificate check
  (`publication/receipt.py` `certificate_problems`) and the page's receipt
  checks (`src/utils/publication/`) all assume a policyengine.py bundle.
  Replacing them means a receipt of this repository's own for the local
  build, on both sides. That is not done.

What does run on this build: the flat route (CSVs plus `model_build.json`
with the label) and the household-only files. The page has to read those
for the Milburn view (the frontend's side).

## Environment: no token, no bundle upgrade

This route is the opposite of what `.claude/CLAUDE.md` and most of
`README.md` say; those describe the Autumn Budget dashboard.

- **`HUGGING_FACE_TOKEN`, `HF_TOKEN` and `HUGGINGFACE_HUB_TOKEN` must be
  unset** in the shell that runs these commands. `uk_budget_data` drops them
  when it is imported on this engine, but pytest's main process and other
  tools import policyengine directly, and with a token set that import
  fetches policyengine.py's data certificate and refuses the engine.
- **Upgrade the bundle, never policyengine-uk alone**
  (`uv lock --upgrade-package policyengine && uv sync --all-extras`), and
  only to a release that certifies the build in `local_build.py`;
  `local_build.check_engine()` refuses any other engine.
- **Use `.venv/bin/...`, not `uv run`, once the venv is synced.** `uv run`
  can resync the shared venv under a running job.
- Only `MILBURN_DATASET` (optional; same SHA-256) is read. Never set
  `MILBURN_ALLOW_TEST_DATASET` for a real run.

## Commands

From the repository root.

```bash
unset HUGGING_FACE_TOKEN HF_TOKEN HUGGINGFACE_HUB_TOKEN
uv sync --locked --extra dev        # once, and never while a run is going
.venv/bin/python -c "from uk_budget_data import local_build as b; b.check_engine(); print(b.check_dataset())"
.venv/bin/uk-budget-data generate --list-reforms   # the listed registry (13 ids on 16 November)
```

### Order of regeneration

The files depend on each other, so regenerate in this order (each step is
below):

1. `milburn_measures.json` and `milburn_scenarios.json` (household-only;
   the scenarios must be current **before** the summary reads them);
2. the run folders, changed ids only, staged outside the repository;
3. `scripts/milburn_summary.py` (reads every run folder and the scenarios);
4. delete the folder of every id that was dropped (a folder with a
   `model_build.json` shows on the page and in the summary whether or not
   the registry still lists it), then run the summary again;
5. check that every folder is one build and one hash (step 4 below).

### 1. Household-only files (no dataset, no lock; a minute or two each)

```bash
.venv/bin/uk-budget-data milburn-measures  --output public/data/milburn_measures.json
.venv/bin/uk-budget-data milburn-scenarios --output public/data/milburn_scenarios.json
```

`milburn_measures.json` lists every measure of the listed registry: the
computable ones with their descriptions and the four not-computable ones
with their reasons (no figure). A not-computable measure has no reform to
run, so it cannot be a manifest entry (`publication.manifest.Entry` requires
an artifact whose run touched a data limit); this file is where the page
finds them. Its presence switches the page to the local route.

There is no `income-curve` step: every national run writes
`income_curve.csv` into its own folder, and the standalone command would
write `public/data/income_curve.csv`, which nothing on the local route
reads.

### 2. National results, one measure at a time

Heavy (about 23 GB and 6.5 to 9.5 minutes a run, estimated). Run serially,
holding the shared heavy-run lock `/tmp/pe-heavy.lock` (one text line,
`<pid> <project> <job>`; never remove a live holder's lock). Write to a
staging folder outside the repository and `/tmp`, then copy, so the page
never reads a half-written folder. The loop takes every id in the listed
registry; replace `IDS` with the changed ids on a re-run (reserved ids such
as `milburn_report_package` are not in the listed registry and must be
named).

```bash
setopt pipefail                      # zsh: a failed generate fails the pipe through tee
unset HUGGING_FACE_TOKEN HF_TOKEN HUGGINGFACE_HUB_TOKEN
STAGE=~/milburn-runs/$(date +%Y%m%d)
LOCK=/tmp/pe-heavy.lock
IDS=($(.venv/bin/python -c "import warnings; warnings.simplefilter('ignore'); from uk_budget_data.reforms import list_reform_ids; print(' '.join(list_reform_ids()))" 2>/dev/null | tail -1))
take_lock() {  # take_lock <job>: wait until free (or its holder is dead), then create it
  until ( set -o noclobber; echo "$$ uk-milburn $1" > "$LOCK" ) 2>/dev/null; do
    ps -p "$(cut -d' ' -f1 "$LOCK")" >/dev/null 2>&1 || rm -f "$LOCK"   # stale: holder is gone
    sleep 30
  done
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
take_lock national-runs
trap 'grep -q "^$$ " "$LOCK" 2>/dev/null && rm -f "$LOCK"' EXIT INT TERM
for id in $IDS; do run "$id" || break; done
```

`scripts/milburn_rerun_all.sh` does the same without copying: it waits for
the lock, runs the listed ids (or the ids given) into `$STAGE`, writes
`$STAGE/milburn_scenarios.json`, releases the lock and prints the `rsync`
and summary commands to run by hand. `--dry-run` shows the plan and touches
nothing.

Neither the loop nor the script has been run past the dry run (the lock was held on 16 November);
check `echo $IDS` prints the ids before starting.

To check that a run reproduces (after any change to the measure code), run
one unchanged id to staging only (the `generate` line without the `rsync`)
and compare:

```bash
diff -r "$STAGE/$id" "public/data/milburn/$id" && echo identical
```

Each run writes `budgetary_impact.csv`, `distributional_impact.csv`,
`winners_losers.csv`, `metrics.csv`, `age_impact.csv` and the household
curves, plus `model_build.json` (label, build, hash, engine, measures,
years, `"certified": false`). `generate` with no dataset argument loads the
local build file. `milburn_package` is one simulation of its two members
(`combine_measures`), so it carries their interactions. 2026-27 is left out:
every measure starts in April 2027 (pass it and its rows are zero, by
construction). The flat CSVs carry no disclosure control beyond the
pipeline's own; do not publish them outside the local page.

Peak memory per measure, estimated from the Autumn Budget runs on the
previous Microcosm national dataset (runbook, "Measured on 24 October"):
about 19 GB footprint over two years and 22.5 GB over six, about 6.5 GB
resident at peak. The 6f918b81 file is 414 MB, so expect the same order:
budget about 23 GB for a single measure over 2027 to 2031 and a little more
for `milburn_package` (both modifiers). Not measured on this build. Run one
at a time unless more than about 40 GB is free.

Results by area (`geography`, `constituencies`) are not covered: the
local-area cut is a different build.

### 3. Summary

```bash
python3 scripts/milburn_summary.py > "$STAGE/summary-table.md"   # writes public/data/milburn_summary.json
```

It reads every folder under `public/data/milburn/` that has a
`model_build.json`, and `milburn_scenarios.json`. Delete the folder of any
dropped id first (or delete it now and run the summary again). Paste the
table into `docs/milburn-analysis.md`.

### 4. One build, one hash

```bash
.venv/bin/python - <<'EOF'
import json, pathlib
from uk_budget_data import local_build as b
from uk_budget_data.reforms import list_reform_ids
seen = set()
for path in sorted(pathlib.Path("public/data/milburn").glob("*/model_build.json")):
    record = json.loads(path.read_text())
    assert record["build"] == b.BUILD_ID and record["dataset_sha256"] == b.DATASET_SHA256, path
    assert record["engine"] == b.ENGINE and record["certified"] is False, path
    assert record["measures"] == [path.parent.name], path
    seen.add(path.parent.name)
print("folders not in the listed registry:", sorted(seen - set(list_reform_ids())))
print("listed ids with no folder:", sorted(set(list_reform_ids()) - seen))
EOF
bun scripts/check-public-files.mjs
.venv/bin/python scripts/check_public_data.py
```

### 5. Baseline caseloads

```bash
.venv/bin/python scripts/milburn_caseload_check.py --year 2027   # --help for the options
```

One baseline simulation (heavy: it takes the lock itself and refuses while
another live process holds it; `--no-lock` when the calling shell holds it).
Prints PIP recipients aged 18 to 24 and 16 to 24 with spend, benefit units
with the LCWRA element in which every adult is under 25, and all LCWRA
units, beside the figures in `docs/milburn-analysis.md`. `--check-only`
checks the engine, the dataset's hash and the lock without building.

## Report day: re-parameterising

The design choices are in one module,
`src/uk_budget_data/budget_measures/milburn_design.py`, in two groups:

- the **15 November designs** (`START_YEAR`, `PIP_LOWER_AGE`, ...): the
  defaults of every listed measure. Do not edit them: the committed run
  folders record no code version, so a change would silently redefine runs
  that stay on the page, the upper bound `milburn_package` among them;
- the **report's design** (`REPORT_*`): edit these. Only the reserved
  `milburn_report_*` ids read them, and their names and descriptions are
  written from them.

| Report says | Edit in `milburn_design.py` |
|---|---|
| PIP from 16 (16 to 24) | `REPORT_PIP_LOWER_AGE = 16` |
| Another upper age for PIP or the health element | `REPORT_PIP_UPPER_AGE`, `REPORT_UC_HEALTH_UPPER_AGE` |
| 16 and 17-year-olds keep the health element | `REPORT_UC_HEALTH_LOWER_AGE = 18` |
| Severe cases keep the health element (points proxy) | `REPORT_UC_HEALTH_SEVERE_KEPT = True`, `REPORT_SEVERE_DL_POINTS` |
| Scottish ADP not affected | `REPORT_PIP_INCLUDE_SCOTLAND = False` |
| A uniform share of PIP kept as a stand-in for the replacement | `REPORT_PIP_REPLACEMENT_SHARE` (e.g. `0.5`) |
| PIP replaced by tiered support (e.g. only "enduring severe needs" keep it) | `REPORT_PIP_REPLACEMENT_SHARES = {"daily_living_enhanced": 1.0, "daily_living_standard": 0.0, "mobility_enhanced": 1.0, "mobility_standard": 0.0}`: the share of each component kept at each award level, all four keys. When set it replaces the uniform share in `milburn_report_pip` and every report package. A share above 1 pays more than now |
| The replacement has a name (e.g. an "additional cost allowance") | `REPORT_PIP_REPLACEMENT_NAME = "additional cost allowance"` with a share above: text only, the measure is then named "PIP replaced by an additional cost allowance for ..." |
| PIP ends in England and Wales only | `REPORT_PIP_INCLUDE_SCOTLAND = False` (with `REPORT_PIP_LOWER_AGE = 16` for "under 25"). Northern Ireland records are still reached: no constant leaves them out |
| A lower employer NICs rate for young employees | `REPORT_EMPLOYER_NICS_UNDER_25_RATE` (e.g. `0.075` against the main 15%; `0.0` is the zero-rate comparator) and `REPORT_EMPLOYER_NICS_AGE_LIMIT` (default `25`). Creates `milburn_report_employer_nics` and adds it to `milburn_report_package` |
| Starts April 2028 (or later, to 2031) | `REPORT_START_YEAR` (a mid-year start is refused: use the first full year) |
| Natural migration at another rate; transitional protection | `REPORT_REASSESSED_EACH_YEAR` (`0`: new entrants only) |
| Youth allowance at given amounts | `REPORT_YOUTH_ALLOWANCE_MONTHLY = {2027: (single, couple), ..., 2031: (...)}` |

Then test, read the text the constants now write, and run the report ids
with the loop in step 2:

```bash
.venv/bin/python -m pytest tests/test_milburn_design.py tests/test_milburn_measures.py -n 2 -q
.venv/bin/python -c "import warnings; warnings.simplefilter('ignore'); from uk_budget_data.reforms import get_reserved_reforms; [print(r.id, '|', r.name, '|', r.description, chr(10)) for r in get_reserved_reforms()]"
IDS=(milburn_report_package milburn_report_uc_health milburn_report_pip milburn_report_package_phased milburn_report_package_entry_25pct)
# With REPORT_EMPLOYER_NICS_UNDER_25_RATE set, also run its part:
IDS+=(milburn_report_employer_nics)
```

The two options added on 17 November:

- **Tiered PIP** (`REPORT_PIP_REPLACEMENT_SHARES`) scales the `pip_dl` and
  `pip_m` amounts by the person's award level (`pip_dl_category`,
  `pip_m_category`), as the uniform share does. Entitlements that passport
  off a component (carer's benefits, disability premia, benefit cap
  exceptions, non-dependant deductions) therefore stay where any of it is
  still paid and go where none is: all `1.0` is current law, all `0.0` is
  `pip_removed_under_25`, all `0.5` is `pip_halved_under_25`. The
  replacement is not a separate payment, and the local health and
  disability fund is not modelled. The award level stands in for "enduring
  severe needs", which the data cannot identify.
- **Employer NICs at a reduced rate** is a modifier
  (`budget_measures/employer_nics_reduced_rate_under_25.py`), not a
  parameter: the zero-rate comparator moves one parameter (the under-21
  age limit) and no parameter holds a second rate for an age band. It
  charges the reduced rate between the secondary and upper secondary
  thresholds and passes the saving through to pay as the engine does for
  the comparator, so `0.0` equals `employer_nics_zero_under_25` and the
  main rate changes nothing. Under-21s and apprentices under 25 keep their
  zero rate. It is in `milburn_report_package` only: the phased and
  move-into-work variants leave it out (their descriptions say so).

Reserved ids (all resolvable by `generate --reforms`, none listed on the
page until promoted):

| Id | What |
|---|---|
| `milburn_report_package` | The report's health element and PIP changes together (`combine_measures` of the two below), with `milburn_report_employer_nics` when a rate is set |
| `milburn_report_uc_health`, `milburn_report_pip` | Its parts |
| `milburn_report_package_phased` | The report package by natural migration |
| `milburn_report_package_entry_25pct` | The report package with the illustrative move into work |
| `milburn_report_youth_allowance` | Exists only while `REPORT_YOUTH_ALLOWANCE_MONTHLY` is set (not part of the report package) |
| `milburn_report_employer_nics` | Exists only while `REPORT_EMPLOYER_NICS_UNDER_25_RATE` is set; then also a member of `milburn_report_package` |
| `milburn_package_16_to_24` | 15 November health element removal with PIP removed from 16 |
| `pip_removed_under_25_excluding_scotland`, `pip_removed_16_to_24_excluding_scotland` | PIP removal leaving Scottish ADP records alone |

To show a reserved id on the page: run it, add its id to
`MILBURN_PROMOTED_IDS` in `reforms.py`, regenerate `milburn_measures.json`,
update `test_the_registry_holds_the_milburn_measures_only`, and edit the
frontend lists (`docs/report-day/01-pipeline-runbook.md`, sections 3 and 5:
a new id shows as an ungrouped single measure until then, and
`milburn_measures.py` writes package members for `milburn_package` only).
A design the constants cannot express (a PIP replacement paid as a new
benefit with its own eligibility, a lower rate of the health element, a
country list) is new code: see the runbook's section 1.

### 6. Household API and page

```bash
HOUSEHOLD_WORKERS=2 PORT=8010 .venv/bin/uk-budget-api  # household calculations on 2.177.7
bun run dev                                            # http://localhost:3000/uk/milburn-review
```

The page reads the flat files above through its local build route
(`src/utils/milburn/localBuild.js`), not the verified route. `next.config.ts`
sets `NEXT_PUBLIC_DATA_ROUTE=local-build` when
`public/data/milburn_measures.json` exists (set `NEXT_PUBLIC_DATA_ROUTE=verified`
to use the verified route instead). The catalogue comes from
`milburn_measures.json`; each listed measure and package is a
single run, selected one at a time and never summed on the page. A run shows
once its folder has a `model_build.json` (written after the tables); until
then it is listed as "Not yet run", with no figure. Every view carries the
label from `model_build.json` ("not certified"). Results by area and the
household scatter are not on the flat route and show as unavailable.

The household API answers on the installed engine, but the page's Household
calculator checks every answer against a receipt's engine and approved
definitions, and none exist on this build, so on the local route the tab
shows that it is unavailable.

## The release id

The page's catalogue comes from `public/data/manifest.json`, which must name
`release: uk-autumn-budget-2026` and `budget: {id: uk-autumn-budget-2026,
date: 2026-10-28}`. Two constants set it and must change together:

- Python: `CURRENT_RELEASE` and `CURRENT_BUDGET` in
  `src/uk_budget_data/publication/manifest.py` (the manifest writer; also
  read by `publication/release_index.py`);
- frontend: `CURRENT_RELEASE` and `CURRENT_BUDGET` in
  `src/utils/publication/release.js` (the loader refuses a manifest with
  another id), and the IndexedDB name `uk-autumn-budget-2026-verified` in
  `src/utils/publication/cache.js` (otherwise cached Budget snapshots are
  reused).

For a new id such as `milburn-review-2026`, set both to
`{id: "milburn-review-2026", date: "2026-11-17"}` in one commit and start
from an empty manifest. Since no manifest entry can be made on this build
(above), the id changes nothing yet; keep `uk-autumn-budget-2026` until the
receipt question is settled, and decide the id with it. No other config
file holds it.

## Measures

| Id | Implementation |
|---|---|
| `uc_health_element_removed_under_25` | Modifier `budget_measures/uc_health_element_removed_under_25.py`: rewrites the stored `uc_LCWRA_element` (the engine's UC rebalancing stores it every year 2026 to 2032, so a formula wrapper moves nothing), keeping it where an assessed claimant with LCWRA is 25 or over |
| `uc_health_element_removed_under_25_new_claims` | Same, only where `uc_receives_new_claimant_health_element` is true. On survey data that flag is the engine's seeded draw at the new-claimant share, blind to age |
| `pip_removed_under_25` | Modifier `budget_measures/pip_removed_ages_18_to_24.py`: wraps `pip_dl` and `pip_m` (ages 18 to 24; 16 and 17-year-olds keep PIP). The build stores only PIP points, so Scottish records (ADP, held as PIP) are reached |
| `youth_allowance_at_25_plus_rate` | Parameters `gov.dwp.universal_credit.standard_allowance.amount.SINGLE_YOUNG` and `.COUPLE_YOUNG` set to the 25-and-over amounts, 2027 to 2031, plus `rebalancing.protected_health_element` pinned at current law's 2027 to 2029 amounts (the s. 4 floor would otherwise fall with the higher under-25 allowance) |
| `employer_nics_zero_under_25` | Parameter `gov.hmrc.national_insurance.class_1.secondary_zero_rate_age_limits.under_21_group` = 25, 2027 to 2031. The engine passes employer NICs through to pay, so household incomes rise |
| `milburn_package` | `combine_measures` of the health element removal (all claimants) and the PIP removal |
| `milburn_package_central` | `combine_measures` of `uc_health_element_removed_under_25_severe_kept` and `pip_halved_under_25` |
| `uc_health_element_removed_under_22` | The health element modifier with `age_limit=22` |
| `uc_health_element_removed_under_25_severe_kept` | The same modifier with `keep_enhanced_pip_daily_living=True`: 24 or more PIP daily living points keeps the element |
| `pip_halved_under_25` | The PIP modifier with `share_kept=0.5` |
| `pip_removed_16_to_24` | The PIP modifier with `lowest_age=16` |
| `milburn_package_phased` | `budget_measures/milburn_variants.py`: both removals reaching new entrants at once and the stock at 25% a year (seeded draw) |
| `milburn_package_entry_25pct` | `milburn_variants.py`: the package with a seeded quarter of affected non-working 18 to 24-year-olds moved into 16 hours a week |

Every age, year and rate above is a default read from
`budget_measures/milburn_design.py` (the 15 November designs). The reserved
ids and the report's constants are under "Report day" above.

Not computable (listed with a reason, never a figure):
`severe_conditions_higher_rate`, `additional_cost_allowance`,
`youth_conditionality`, `youth_guarantee_expansion`.

Tests: `.venv/bin/python -m pytest tests/test_milburn_measures.py tests/test_milburn_design.py -n 2 -q`
(no dataset, no lock).
