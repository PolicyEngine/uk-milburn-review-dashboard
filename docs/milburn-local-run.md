# Milburn review: local run

How to go from the Milburn measures in `src/uk_budget_data/reforms.py` to a
local page that shows them. Read "What does not work on this build" first:
the Autumn Budget dashboard's verified publication route cannot run on the
data build the review uses.

## The build

| | |
|---|---|
| Data | Microcosm build `uk-frs-calibration-attempt-20261112T133744Z-6f918b81`, `microcosm_uk_2024_25.h5`, SHA-256 `e268e3af7932784ad4471f008097a5acc6c3c5bc15c4c54fbb5a489b2a0ac9ae` |
| Engine | policyengine-uk 2.177.7, policyengine-core 3.34.10 (the build's own) |
| Wrapper | policyengine 6.19.0, used for its API only (it pins 2.174.1 and build eeb6093e) |
| Label carried into outputs | `build 6f918b81, policyengine-uk 2.177.7, not in a policyengine.py release` |

`pyproject.toml` overrides the engine (`[tool.uv] override-dependencies`).
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

## Commands

From the repository root, in a shell with no Hugging Face token exported.

```bash
uv sync --locked --extra dev
uv run python -c "from uk_budget_data import local_build as b; b.check_engine(); print(b.check_dataset())"
```

### 1. Household-only files (no dataset; minutes, under 1 GB)

```bash
uv run uk-budget-data milburn-measures  --output public/data/milburn_measures.json
uv run uk-budget-data milburn-scenarios --output public/data/milburn_scenarios.json
uv run uk-budget-data income-curve --reforms milburn_package \
  uc_health_element_removed_under_25 uc_health_element_removed_under_25_new_claims \
  pip_removed_under_25 youth_allowance_at_25_plus_rate employer_nics_zero_under_25 \
  --years 2027 2028 2029 2030 2031
```

`milburn_measures.json` lists every measure: the six computable ones with
their descriptions and the four not-computable ones with their reasons (no
figure). A not-computable measure has no reform to run, so it cannot be a
manifest entry (`publication.manifest.Entry` requires an artifact whose run
touched a data limit); this file is where the page finds them.

### 2. National results, one measure at a time

Run these while holding the shared heavy-run lock (`/tmp/pe-heavy.lock`), one at a time.

```bash
for id in uc_health_element_removed_under_25 uc_health_element_removed_under_25_new_claims \
          pip_removed_under_25 youth_allowance_at_25_plus_rate employer_nics_zero_under_25 \
          milburn_package; do
  uv run uk-budget-data generate --skip-input-check \
    --reforms "$id" --years 2027 2028 2029 2030 2031 \
    --output-dir "public/data/milburn/$id"
done
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

### 3. Household API and page

```bash
HOUSEHOLD_WORKERS=2 PORT=8010 uv run uk-budget-api     # household calculations on 2.177.7
bun run dev                                            # http://localhost:3000/uk/autumn-budget-2026
```

The household API answers on the installed engine, but the page's Household
impact tab only offers measures the manifest approves, and refuses answers
whose engine differs from the receipts' (none exist on this build). Until
the frontend reads the flat files above, the page will show no Milburn
figures.

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

Not computable (listed with a reason, never a figure):
`severe_conditions_higher_rate`, `additional_cost_allowance`,
`youth_conditionality`, `youth_guarantee_expansion`.

Tests: `uv run pytest tests/test_milburn_measures.py -n 4`.
