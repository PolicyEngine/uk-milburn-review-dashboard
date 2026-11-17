# Morning report, 17 November 2026

## Update, early 17 Nov: certified build done

- Upgraded to **policyengine 6.20.1** (approved by Vahid): `pyproject.toml` depends on the bundle with no engine override; `local_build.py` runs on certified build **fcfac709** (SHA-256 `301d2fe5…`, same file the bundle pins, checked by `bundle_certifies()`); the page says "Figures from build fcfac709, policyengine-uk 2.177.7, certified in policyengine 6.20.1." with no "not certified".
- **All 13 runs re-ran on fcfac709** (lock freed at about 23:50; done 01:27). Every results table is **byte-identical** to the 6f918b81 runs: the two builds differ only in `main_residence_value` for 131 of 78,164 households (same mean), which no Milburn measure uses. So every figure on the page stands, now on certified data; only labels changed.
- Commits `318e3189` (upgrade) and `3c6a34a5` (re-run); `main` is 5 ahead of origin, not pushed.
- **The shared artifact was not refreshed**: updating a link-shared artifact was refused by the permission system. The rebuilt export is staged in `artifact-export/publish/` (144 files); it still shows version 3 (6f918b81 labels, same figures) until you allow the update.

What happened overnight on the Milburn dashboard, and what to do first. Nothing was pushed, posted or deployed. `main` is 2 commits ahead of `origin` (`0287c2d7` artifact export, `d4854826` report-day prep).

## Do first (needs you)

1. **Approve the move to the certified data.** policyengine 6.20.1 (PyPI, 16 Nov 20:23) bundles the certified build `fcfac709` (policyengine-uk 2.177.7, core 3.34.10). The upgrade was refused by the permission system when an agent ran `uv lock --upgrade-package policyengine`, so I did not run it. Run it yourself or allow it:

   ```bash
   uv lock --upgrade-package policyengine && uv sync
   ```

   Also needed (about an hour of work after that): drop the `policyengine-uk==2.177.7` / `policyengine-core==3.34.10` pins in `pyproject.toml`; point `local_build.py` at `managed_microsimulation()` (token from `~/.cache/huggingface/token`); stop `uk_budget_data/__init__.py` dropping the token; let the front end accept `"certified": true` in `model_build.json` (`src/utils/milburn/localBuild.js` `parseBuildRecord`, `localBuildParts`) and hide the "not certified" label then. Every published figure is a 6f918b81 result, so all 13 runs and the two typed benchmark estimates must be redone on fcfac709.
2. **The heavy-run lock** `/tmp/pe-heavy.lock` was held all night by `uk-ai-study phase2-B` (PID 4555). No national run was made. Agree the handover; the full set is about 1 h 45 min.
3. **The artifact is shared as "Anyone with the link".** Version 3 (with the fixes below) is live: https://claude.ai/artifact/U2qwazGPbFJL6qS39AfFvT. It still carries 6f918b81 results and the SPI condition is not confirmed (María asked on 16 Nov, no reply seen). Consider restricting it until she answers.
4. **Push** the two local commits when you are happy: `git push origin main` (private repo).

## Fixed overnight (commit `d4854826`)

Accuracy (checked against the code and in the browser):

- **Return to work** now names who the run moves: 25% of non-working 18 to 24-year-olds with PIP or the health element, into 16 hours' work at their minimum wage, about 82,000 people (count read from the run, `people_directly_affected`). It said "25% of the young people who lose".
- **Break-even** is now consistent: entrants needed (saving ÷ one entrant's gain) as a share of 16–24s in losing households. Full package 98.7% at 16 hours, 77.1% at 25 hours (was 160.5% / 125.4%, which counted household losses once per young person). `milburn_summary.json` regenerated; only that field changed, plus `people_directly_affected` added.
- **Phased package** shows the rule in words and the run's saving as a share of full abolition from data (45%, 72%, 81%, 90%, 97% for 2027-28 to 2031-32), not a typed "about 36%".
- **Methodology** counts the measures the Measures tab shows (11), not 13.
- **Package range** highlights a selection only when a package is selected.
- **Year selector:** Key figures, Poverty at a glance and Return to work carry a "2027-28 only" chip (they do not follow the selector).
- **Neutral wording:** "Why the effect is small" is now "What the run changes", with four factual points; "arithmetic, not a new incentive" replaced.

Pipeline (Python):

- `src/uk_budget_data/budget_measures/milburn_design.py` holds the design choices. The 15 November constants are pinned (13 published runs unchanged; 23 new tests). Tomorrow's edits go in the `REPORT_*` constants only, read by reserved ids `milburn_report_package`, `milburn_report_package_phased`, `milburn_report_package_entry_25pct`, `milburn_report_youth_allowance`. Also ready without edits: `milburn_package_16_to_24`, `pip_removed_under_25_excluding_scotland`, `pip_removed_16_to_24_excluding_scotland`. Reserved ids do not show on the page until added to `MILBURN_PROMOTED_IDS` in `reforms.py`.
- `scripts/milburn_rerun_all.sh` (waits for the lock, stages runs outside the repo, prints the copy commands) and `scripts/milburn_caseload_check.py` (never run on national data yet).
- `docs/milburn-local-run.md` rewritten for the full registry and the regeneration order. It and the README note still describe the 6f918b81 build (token unset); update both with the bundle move.

Trims and layout:

- The local route no longer loads the Budget manifest and artifacts or the unused scatter, and does not refetch on window focus: first load 81 data requests instead of 160.
- The artifact export ships 144 files (5.1 MB) instead of 309 (46 MB).
- About 340 lines of unused CSS removed from `milburn.css`.
- At 375px: policy pill no longer clipped, age-axis labels no longer collide, break-even label not cut off.
- **Report-day switch:** set `REPORT_DAY = true` in `src/utils/milburn/reportDay.js` to hide Return to work and Benchmarks (sub-tabs, landing box, placeholders). Tests pass in both states.

Checks at commit: Vitest 199 files, all pass except the known flaky Household focus test; eslint 0 errors (9 old warnings); `check-public-files` 0 problems. Python: `tests/test_milburn_design.py` passes; `tests/test_milburn_measures.py` passed in full before three late edits and a 13-test subset passed after them (not re-run end to end). `tests/test_budget_measures.py` gains 4 failures from the two new modules (the same one-modifier-per-module check already failed for `milburn_variants`); exempt them or restructure.

## Still open

- `docs/milburn-analysis.md` still has the old break-even (160.5%) and phased (36%) figures; all its numbers change on fcfac709 anyway.
- `src/uk_budget_data/*` still says "a quarter of affected young people" in places; `reforms.py` descriptions keep the "Briefings before the report…" sentences as named constants to rewrite once the report is out.
- The publication blockers in `04-publication-readiness.md` stand: SPI, no Milburn deploy target (Vercel/zone route), disclosure floor for `age_impact.csv`, CI red.

## When the report lands

Follow `00-README.md`, "Tomorrow". In short: set the `REPORT_*` constants (table in `01-pipeline-runbook.md` §1 and the pipeline section above), rewrite the briefing sentences, run `scripts/milburn_rerun_all.sh <ids>` under the lock, copy the staged folders in, run `scripts/milburn_summary.py`, update the 7 data-pinned tests, flip `REPORT_DAY` if Return to work and Benchmarks are not re-checked, rebuild the artifact with `python3 scripts/artifact_export.py`.
