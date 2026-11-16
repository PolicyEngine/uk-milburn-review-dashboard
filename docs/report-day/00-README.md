# Report day (17 November 2026): runbook

Internal. Four reviews (16 Nov) sit beside this file; this page is the order of work. Details, file:line references and commands are in:

- [01-pipeline-runbook.md](01-pipeline-runbook.md): re-parameterising and re-running
- [02-trim-list.md](02-trim-list.md): what to remove or hide
- [03-figures-and-qa.md](03-figures-and-qa.md): stale figures, consistency, tests that pin data
- [04-publication-readiness.md](04-publication-readiness.md): blockers, deploy, neutrality, go/no-go

## Status

**No-go for a public deploy as things stand.** Three blockers, none of them code:

1. **HMRC SPI condition** (build 6f918b81): analyses to HMRC ten working days before publication. Asked María on 16 Nov; no answer yet. If it applies as worded, the earliest publication date is about 1 December, not 17 November. Any Vercel deploy, previews included, serves `public/data/`; making the repo public publishes every earlier run from git history.
2. **No Milburn deploy target.** `vercel.json`, README, `cloudbuild.yaml` and CI still point at the Autumn Budget project. policyengine-app-v2 has no `/uk/milburn-review` zone route. CI is red on `main`.
3. **Uncertified build, no disclosure gate.** The public-file check passes only because the flat Milburn CSVs carry no receipts. `age_impact.csv` ships single-year-of-age rows with no sample floor. Sign-off is off.

## Errors on the page now (fix before anyone else sees it)

Checked against the code on 16 Nov:

- **Return to work, "25% of young people who lose".** The run moves 25% of non-working 18–24-year-olds who themselves have PIP or LCWRA (about 82,000 people), not a quarter of the 578,000 young people in losing households (`milburn_variants.py:105-115`; label at `BehaviouralScenarios.jsx:46,174,188`).
- **Break-even "160.5% / 125.4%".** It divides a household loss counted once per young person (578,166 × £12,622 = £7.3bn) by one entrant's gain, while "entrants needed" (570,502) uses the £4.49bn saving. Like for like the share is about 99% (16 hours) and 77% (25 hours), so "no entry rate restores the average" does not hold as stated (`scripts/milburn_summary.py`).
- **Phased "about 36% reached".** The rule gives 36%, but the run's 2027-28 saving is 44.8% of full abolition (one seeded draw over ~500–650 records). Say "about 45% of the full saving in 2027-28" or drop the 36%.

Also: the year pill does not move Key figures, Poverty at a glance or Return to work; "Package range" shows when a non-package is selected; Methodology says "13 published" while Measures shows 11.

## Decisions for Vahid (tonight)

1. **Headline id.** Recommended: the report's design gets a new id (for example `milburn_report_package`); `milburn_package` stays as the upper bound with its 15 Nov results. The other way overwrites the upper bound and needs no repointing (about seven places, 01 §3).
2. **What ships tomorrow.** Recommended minimum: Impact (Young people, Poverty, Public finances), Measures cut to the report's proposals, Methodology with four passages rewritten. Hide Return to work and Benchmarks until the errors above are fixed and the benchmarks are re-sourced (02 §5).
3. **Lock.** `/tmp/pe-heavy.lock` is held by another session (uk-ai-study). Agree the handover for tomorrow.

## Tonight (prep, so tomorrow is parameter edits)

1. Fix the three page errors above (copy and `milburn_summary.py`), with tests.
2. Smoke run: re-run one unchanged id under the lock and `diff -r` against the committed folder. It proves re-runs are reproducible and measures time and memory (01 §4).
3. Prepare arguments instead of hard-coded ages and dates in `milburn_variants.py`, one set of design constants, and reserved ids (01 §3).
4. Pre-run the likely alternatives: a 16–24 package and a PIP run excluding Scotland.
5. Safe trims (02 §1, "tonight"): stop the head script fetching Budget artifacts on the local route, stop fetching the unused scatter, stop the reload on every window focus, and skip Budget leftovers in `scripts/artifact_export.py` `stage()`. Keep `living_standards_outlook.json` and `policy_parameters.json`: Poverty and Measures read them.
6. Write a caseload-check script (no script produced the 232k / 347k figures; 01 §4 has a sketch).

Environment: this build runs with `HUGGING_FACE_TOKEN` unset and must not take `uv lock --upgrade-package policyengine`. `.claude/CLAUDE.md` and README say the opposite for the Budget; they do not apply here (01).

## Tomorrow, once the report is out

1. Read the report; map each design element to a parameter or "not modellable" with the table in 01 §1. UC health is never a parameter edit: it goes through the modifier.
2. Rewrite each changed measure's name and description (each states its age band and "From April 2027").
3. Run under the lock, staging outside the repo: changed ids only (about 8 minutes each; package and two parts about 25 minutes).
4. Regenerate in this order (03 §5): `milburn_scenarios.json`, run folders, `scripts/milburn_summary.py`. Delete folders of dropped ids (any folder with a `model_build.json` shows on the page). Check one build and hash across folders.
5. Hand edits: the two benchmark estimates in `milburn_benchmarks.json` (232,000; £4.43bn) and the build constants if the build changes (six places, 03 §1).
6. Copy: the "before the report / candidate / not announced policy" sentences (`LandingPage.jsx`, `layout.tsx`, `MethodologyTab.jsx`, `manifest.js`, `reforms.py` descriptions), and policy values typed in `measureVisuals.js` and `policyDetails.js`.
7. Update the 7 tests that pin data (03 §4), then `bun run test`, `bun scripts/check-public-files.mjs`, eslint.
8. Caseload checks and plausibility against the benchmarks (03 §3).
9. Neutrality pass on new copy (04 §3).
10. Private review: rebuild `python3 scripts/artifact_export.py` and republish the private artifact to the same link.

## Publish (only after the blockers clear)

Go/no-go list in 04 §5. In short: SPI cleared in writing; choose a path (certified policyengine.py release with receipts, or a labelled local build with a manual sample floor and a recorded decision); create the Vercel project and zone route; set or drop `NEXT_PUBLIC_HOUSEHOLD_API_URL`; flip noindex (`next.config.ts`, `layout.tsx`); fix CI; trim `public/` to the ~85 files the page reads.
