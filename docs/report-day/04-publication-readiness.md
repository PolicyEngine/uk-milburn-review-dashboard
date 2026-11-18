# Report day 04: publication readiness

Read-only review, 16 November 2026, of `main` at `0287c2d7`. Nothing was
edited, committed, deployed or posted. No result figure is repeated here.

## Verdict

**No-go for a public deploy on 17 November as the repository stands.** Three
things block it, in this order:

1. **Licence.** The HMRC SPI condition is unconfirmed. If it applies as the
   analysis note words it, 17 November is not reachable.
2. **No deploy target.** The repository is still wired to the Autumn Budget's
   Vercel project, Cloud Run service and base path. Nothing Milburn-specific
   was found in the repository, in GitHub settings or in policyengine.org's
   zone routes; Vercel itself could not be checked.
3. **Uncertified build, and no gate that knows it.** The figures are flat files
   on a build outside any policyengine.py release. Every automated disclosure
   check passes on them, because none of those checks looks at flat files.

Everything else (copy, noindex, CI, trimming) is hours of work, not a blocker
of principle.

## 1. Licensing and data

### 1.1 HMRC SPI condition (blocker, unconfirmed)

- The only source in the repository is `docs/milburn-analysis.md:6-8` ("analyses
  to HMRC ten working days before publication; confirm with María before
  anything goes public") and its to-do at line 151, plus commit `d8b32bfe`
  ("private repo only, SPI condition"). No licence text is in the repository,
  so the exact terms were not checked.
- Arithmetic, if the condition applies as worded: analyses sent on Monday
  16 November give a tenth working day of Monday 30 November. Figures re-run on
  the report's actual proposals on 17 November could go to HMRC that day at the
  earliest, which gives 1 December. **Publication on 17 November is possible
  only if María confirms the condition is already met, does not apply to this
  build, or has been waived in writing.**
- Until then, results stay in private repositories. That rules out more than
  making this repository public:
  - **Any Vercel deployment serves `public/data/`**, previews included, even
    while the repository is private. A preview URL is public unless Vercel
    deployment protection is on.
  - **Git history holds the results** (`d8b32bfe` onwards, 13 run folders under
    `public/data/milburn/` and four `milburn_*.json` files). Making the
    repository public publishes every earlier run, including pre-report
    variants. Decide between a fresh public repository and a history rewrite
    before any visibility change.
  - **The Claude artifact export** (`0287c2d7`, `scripts/artifact_export.py`)
    bundles the same data. Whether an artifact was published or shared could
    not be checked from here; confirm it stayed private.
- Checked, read-only: the repository is private; GitHub lists no deployments,
  no Pages site, no repository secrets or variables; there is no `.vercel/`
  link directory (`.env.local` holds a Vercel CLI OIDC token, so the CLI has
  been used here at some point).

### 1.2 What this repository's own rules require

The README's "Review and sign-off" section and `src/uk_budget_data/sign_off.py`:

- "Every file under `public/` is a publication" (README, Review and sign-off).
- Sign-off is **off** (`REQUIRED = False`, `sign_off.py`): no review rows, no
  two-person attestation, no second signer. No person has to sign anything.
- The automated checks always block: no record ids or weights, the survey
  household floor, `validate_public` on area tables, the area-code guard, file
  digests, certification, completeness, reconciliation.

**The gap:** those rules were written for the verified route. On the local
build route they do not bite:

| Check | Result today | Why it does not cover the Milburn files |
|---|---|---|
| `bun scripts/check-public-files.mjs` (run by `bun run build`) | `0 problem(s) in public/.` | The household floor is read from a receipt's `dashboard.disclosure_floor` (`check-public-files.mjs:247-286`). Flat CSVs have no receipt, so no floor is applied to them. |
| CI "Public data check" (`scripts/check_public_data.py`) | passes | Same: the floor is a receipt property (`check_public_data.py:260-277`). |
| CI "Publication gate" (`publish check`) | fails (exit 1; cause not read from the log) | It checks the manifest, which is still the Autumn Budget's, so it says nothing about the Milburn files either way. |
| Certification | not checked | `model_build.json` records `"certified": false`; nothing reads that as a gate. |

`docs/milburn-local-run.md:121-122` says so directly: "The flat CSVs carry no
disclosure control beyond the pipeline's own; do not publish them outside the
local page."

Specific files to look at before any publication:

- `public/data/milburn/*/age_impact.csv` carries a `sample_size` column and
  rows for single years of age (98 age bands, 6,370 rows across the runs). The
  page's own Methodology says single years of age are noisy and that the
  results rest on roughly 500 to 650 records of young claimants
  (`src/components/MethodologyTab.jsx:64`). The smallest `sample_size` in the
  files is in the hundreds, but that counts everyone in the age band, not the
  affected claimants in it. No floor has been applied to these cells.
- `public/data/milburn/*/household_scatter_binned.csv` and `income_curve.csv`
  ship although the page shows the scatter as unavailable on this route.
- `public/data/milburn/*/obr_comparison.csv` ships with every run; there is no
  OBR costing of these measures.

### 1.3 The two paths

**Path A: certified release (the repository's intended route).**

1. A policyengine.py release that pins the engine and a certified Microcosm
   build. None pins 2.177.7 with 6f918b81 (`src/uk_budget_data/local_build.py`;
   policyengine 6.19.0 pins 2.174.1 with build eeb6093e).
2. `uv lock --upgrade-package policyengine && uv sync`; remove the
   `[tool.uv] override-dependencies` block (`pyproject.toml:83-85`) and the
   local-build path through `pipeline.build_microsimulation`.
3. `generate --artifacts`, `publish reconcile/stage/approve`, `generate
   --combined`, `publish index`, `publish check`. Each measure also needs an
   expected-effects row.
4. Change the release id on both sides in one commit
   (`docs/milburn-local-run.md`, "The release id"): `CURRENT_RELEASE` and
   `CURRENT_BUDGET` in `src/uk_budget_data/publication/manifest.py` and
   `src/utils/publication/release.js`, and the IndexedDB name in
   `src/utils/publication/cache.js`. Start from an empty manifest.
5. Remove `public/data/milburn_measures.json`-driven routing or set
   `NEXT_PUBLIC_DATA_ROUTE=verified` (`next.config.ts:41-45`).
6. Needs `HUGGING_FACE_TOKEN` locally and the organisation secret
   `PE_UK_PRIVATE_HF_READ_TOKEN` available to this repository (CI's "Certified
   data" job fails today because it is not).

This gives receipts, the household floor, the Household tab and the page's
own verification. It is not achievable on 17 November unless a certified
release with this engine already exists, and figures would move with the
build.

**Path B: publish the local build (what the page does today).**

- Figures come through `src/utils/milburn/localBuild.js` from flat files; each
  view carries the label "not certified". The Household calculator and results
  by area are unavailable on this route (`docs/milburn-local-run.md`,
  "Household API and page").
- Nothing in the repository forbids it mechanically: sign-off is off and the
  checks pass. It contradicts the README's premise that figures come from "the
  certified Microcosm dataset", the instruction in `milburn-local-run.md` not to
  publish the flat CSVs, and principle 1 of `.claude/CLAUDE.md` ("Data accuracy
  first").
- If this path is chosen, it needs an explicit, recorded decision, plus by hand
  what the gates would have done: a floor on thin cells (drop single years of
  age and `sample_size`), ship only the files the page reads, and wording for
  "not certified" that a public reader can understand ("build 6f918b81 ... not
  in a policyengine.py release" is internal vocabulary).

The repository offers no third route: a receipt of its own for a local build
is described as "not done" (`docs/milburn-local-run.md:64-68`).

## 2. Deploy path

### 2.1 What exists

| Item | State |
|---|---|
| Web app host | Vercel, per `vercel.json` (`framework: nextjs`, `buildCommand: bun run build`). README "Deployment" names the project `uk-autumn-budget-2026` and says a merge to `main` publishes. **That is the Budget's project.** No Milburn project is named anywhere, and none is linked locally. |
| Multizone | `basePath` defaults to `/uk/milburn-review` (`next.config.ts:52-56`); no `assetPrefix` (assets are served under the base path, which works with a path rewrite). policyengine.org's `website/src/data/appZoneRoutes.ts` has `/uk/autumn-budget-2026` and **no `/uk/milburn-review` entry**; neither `apps.json` (`app/src/data/apps/` or `website/src/data/`) lists either dashboard. |
| `vercel.json` headers | All four rules target `/uk/autumn-budget-2026/data/...`. Under `/uk/milburn-review` they match nothing. `next.config.ts` sets the artifacts cache header itself; the manifest and geography rules are lost. |
| Household API | `cloudbuild.yaml` and `.github/workflows/deploy-api.yml` deploy `uk-budget-api-2026` (the Budget's Cloud Run service). Push deploys are off unless the repository variable `API_DEPLOY_ON_PUSH` is `true`; this repository has no variables, so a push to `main` deploys nothing, and a manual run would most likely fail at authentication. The workflow targets the Budget's service: do not give this repository the credentials to run it as it is. |
| Analytics | GA property `G-2YHG89FY0N` with `tool_name` `milburn-review` loads in any production build (`src/app/layout.tsx:116-123`, `src/utils/analytics.js`). |
| Branch protection | None on `main`, no rulesets. The README's "six required checks" do not exist here. |
| CI on `main` | Failing on every recent push. See 2.4. |

### 2.2 Environment variables

| Variable | Where | Needed |
|---|---|---|
| `NEXT_PUBLIC_HOUSEHOLD_API_URL` | Vercel, Production and Preview | A Vercel production build **fails without it** (`scripts/household-api-env.mjs`). Confirmed by calling `householdApiUrlProblem`: `VERCEL_ENV=production` and unset gives an error; preview or local gives a warning; a URL not ending `/api/household-impact` fails every build. The Household tab is removed from this dashboard (`src/App.jsx:114-117`), so the variable gates the build for a tab that no longer exists. Either set it to a well-formed URL or change the check; setting it to the Budget API would pass the check. |
| `NEXT_PUBLIC_DATA_ROUTE` | build | Optional. Defaults to `local-build` while `public/data/milburn_measures.json` exists. |
| `NEXT_PUBLIC_BASE_PATH` | build | Leave unset (`/uk/milburn-review`). |
| `NEXT_PUBLIC_MOCK` | build | Must be unset in production. |
| `HUGGING_FACE_TOKEN` | data runs, CI | Path A only. On the local build the token must be **absent** from the shell (`docs/milburn-local-run.md`). |
| `MILBURN_DATASET` | data runs | Optional path to the build file; default is `~/data/microcosm/releases/...` (`local_build.py`, `docs/milburn-local-run.md` fetches it there); a missing file fails with an error naming both. |
| `MILBURN_ALLOW_TEST_DATASET` | never | Must not be set for a real run. |

### 2.3 Steps to a public deploy

1. Clear section 1 (licence, path decision).
2. Re-run on the report's proposals (`docs/milburn-local-run.md`, "Commands";
   `docs/milburn-analysis.md`, "To do on 17 November"). One measure at a time,
   about 23 GB each by the note's estimate, holding `/tmp/pe-heavy.lock`.
   Then `scripts/milburn_summary.py`, `milburn-measures`, `milburn-scenarios`.
3. Trim `public/` (2.5) and the measure list.
4. Flip noindex in both places: `next.config.ts:90-96` (the `X-Robots-Tag`
   header on `/:path*`) and `src/app/layout.tsx:71`
   (`robots: { index: false, follow: false }`). Both comments call this "a local
   review build".
5. Rewrite the pre-publication copy (section 3.1).
6. Fix `vercel.json` header paths, and the CI smoke step's base path.
7. Create a Vercel project for this repository in the PolicyEngine team, with
   deployment protection on previews, and set the variables in 2.2.
8. Build: `bun run build`. Deploy to a preview and check it.
9. Add `/uk/milburn-review` to `website/src/data/appZoneRoutes.ts` in
   policyengine-app-v2 (a pull request to a separate repository, with its own
   review and deploy), and to `apps.json` if it should appear in the Tools
   menu. Until that merges, only the `*.vercel.app` address works. Run
   `/audit-multizone` once the Vercel project exists; a full audit was not
   run because there is no host entry or deployment to audit yet.
10. Promote to production; check the page, the data files and the headers
    (`curl -I` for `X-Robots-Tag`).
11. Decide the repository's visibility separately (1.1).

### 2.4 Build and CI

`bun run build` was **not run locally**: it would write `.next` under the dev
server in use on port 3100. Evidence instead:

- `bun scripts/check-public-files.mjs` run on its own: `0 problem(s) in public/.`
- CI's "Frontend build" job on `40bf57bb`: the check and `next build` both
  succeed. The job then fails in its smoke step, which still requests
  `http://127.0.0.1:3000/uk/autumn-budget-2026` (`.github/workflows/ci.yml`,
  `app-build`): 10 checks fail, for example "not under the base path
  /uk/autumn-budget-2026".

Other jobs on that run:

| Job | Result | Cause |
|---|---|---|
| Frontend tests, Frontend lint, Public data check | pass | |
| Frontend build | fail | Smoke step's Budget base path (above) |
| Python lint | fail | `black` would reformat `budget_measures/milburn_variants.py`, `reforms.py`, `tests/test_milburn_measures.py` |
| Certified data | fail | `HUGGING_FACE_TOKEN` not set; the organisation secret is not available to this repository |
| Publication gate | fail | Exit 1; cause not read from the log |
| Python tests | fail or cancelled at the 30-minute limit | Not investigated |

A Vercel deploy does not wait for CI unless that is configured, so red CI
does not stop a deploy; it means nothing vouches for one.

### 2.5 Trim list: Budget leftovers that would ship

250 files are tracked under `public/`. These are the Autumn Budget's and are
served by any deploy:

- `public/data/manifest.json` (release `uk-autumn-budget-2026`, 8 measures, 2
  combined) and `public/data/artifacts/` (83 files)
- `public/data/constituency.csv`, `area_provenance.json`, `release-index.json`,
  `area-routing.json`
- `public/data/blog_charts/` (27 files)
- `public/reports/policyengine-autumn-budget-2026-policies-explained.pdf`
- `income_distribution.csv`, `income_growth_with_measures.csv`,
  `income_mobility.csv`, `household_presets.json`, `official_costings.json`,
  `obr_price_categories*.json`, `policy_parameters.json`,
  `living_standards_outlook.json`
- Milburn runs not offered on the page or made obsolete by the report.

Check each against what the page fetches before removing; `publicationBoot.ts`
and the build check read the manifest.

Also stale: `README.md` (still the Budget's throughout, apart from one URL),
`.env.example` ("defaults to /uk/autumn-budget-2026"), the `.claude/CLAUDE.md`
title, and `src/utils/explainers.js:13` (a Budget briefing slug).

## 3. Neutrality and style

Overall the visible copy is descriptive and hedged; no advocacy verbs, no
recommendations, sentence case throughout, British spelling throughout the
dashboard's own text. The points below are ordered by weight.

### 3.1 Wording that becomes false on publication (must change)

- `src/app/layout.tsx:27-28` (`DESCRIPTION`): "candidate measures for the Milburn review ...
  modelled before the review is published ... These are not announced policy."
- `src/components/LandingPage.jsx:54-58`: "candidate measures modelled";
  "Modelled before the final report on 17 November 2026; not announced policy."
- `src/components/MethodologyTab.jsx:70`: "The measures are candidates modelled
  before the review's final report."
- `src/components/MethodologyTab.jsx:180-185`: "its final report is expected on
  Tuesday 17 November 2026. The measures here are candidates drawn from public
  discussion of the review".
- `src/utils/publication/manifest.js:28`: "Provisional: candidate measures
  modelled before the review is published, not announced policy".
- `src/components/milburn/NotComputableMeasures.jsx:9-10`, `src/App.jsx:1164`
  and `:1181`: "Candidate measures ...".

After the report, each measure should say whether it is a recommendation of
the review, a variant of one, or PolicyEngine's own comparator, with a link to
the report's text. "Drawn from public discussion" is not a citable source.

### 3.2 Attribution

- **"Milburn package"** is PolicyEngine's construction, not the review's:
  `public/data/milburn_measures.json` names `milburn_package` "Milburn package
  (combined)", and that name is the `reform_name` in every CSV and download.
  The page relabels it "Full abolition, no replacement (upper bound)"
  (`src/utils/milburn/measureGroups.js:11`), which is accurate; the data files
  and downloads still attribute a full abolition with no replacement to the
  review. Rename unless the report recommends exactly that.
- **"Milburn review"** in the title (`layout.tsx:26`): confirm the report's
  official name and use it at least once.
- **The lead result is an upper bound.** The default selection is the full
  abolition package, and its tiles are the first figures a reader sees. The
  caveat ("Replacement support is not modelled, so the full package is an upper
  bound on losses", `src/components/milburn/KeyFigures.jsx:25`) sits behind
  "Notes and caveats". If the report includes replacement support, leading with
  a package it did not propose is one-sided framing; lead with the closest
  variant, or state the caveat beside the figure.

### 3.3 Framing

- **"Return to work"** (`src/components/PopulationImpactView.jsx:18`,
  `src/components/LandingPage.jsx:42`, `BehaviouralScenarios.jsx:605`): assumes
  prior work, and echoes policy language. Many of the group have not worked.
  "Moving into work", which the body copy already uses, is neutral.
- **The 25% entry scenario** (`BehaviouralScenarios.jsx:46`: "Assumption: 25% of
  young people who lose move into work"): the share has no cited source. It is
  labelled an assumption and "illustrative" in the data, which is right; say
  on the page that it is not an estimate or forecast of behaviour.
- **"Why the effect is small"** (`BehaviouralScenarios.jsx:218`): an evaluative
  heading over one arbitrary scenario. "Why the saving changes little" states
  the same thing as a finding.
- **Break-even charts** show shares above 100%, with the line "Everyone moves
  into work". Arithmetically sound and explained in the notes, but it reads as
  a verdict on the policy. Keep the explanation next to the chart, not behind
  a disclosure.
- **Benchmarks sources** (`public/data/milburn_benchmarks.json`): two rows cite
  "Benefits and Work", an advice and campaigning site, for DWP and
  interim-report figures; one row has an empty `source`. Cite DWP and the
  report directly.
- "Comparators, not review proposals" is a clear, good label; keep it.

### 3.4 Style

- **US spelling:** `src/utils/siteNav.js:32`, "Behavioral responses". It
  mirrors policyengine.org's own menu, so it is consistent with the site but
  is the one US spelling a reader sees. Not a blocker.
- **Number formats:** the style guide asks for percentages to two decimals
  (`XX.XX%`). The key-figure tiles (`KeyFigures.jsx`) use two; the winners and
  losers chart, the break-even chart (`BehaviouralScenarios.jsx`) and the
  phasing visual on Measures use one or none.
- **Internal vocabulary shown to readers:** "Figures from build 6f918b81,
  policyengine-uk 2.177.7, not in a policyengine.py release: not certified."
  on every view; "Local build 6f918b81 ..." in the Measures subtitle
  (`src/App.jsx:1181`).
- **Category eyebrows** ("BENEFITS", "AT A GLANCE") render in capitals; if that
  is CSS `text-transform`, the source is sentence case and this is fine.
- No title-case headings found.

## 4. Accessibility basics

Checked in the built-in browser on `http://localhost:3100/uk/milburn-review`
(landing, Impact, Return to work, Measures, Methodology). Automated probes
only; no screen reader and no manual keyboard pass.

| Area | Finding |
|---|---|
| Language | `lang="en-GB"`. |
| Landmarks | One `main`, one `nav`, one `footer`. No skip link found. |
| Headings | **Impact skips a level:** `h1`, then `h3` "Key figures" and `h4` "Package range", then the first `h2`. Landing is `h1`, `h2`. |
| Images | Three images, all with `alt` (the decorative one empty). |
| Charts | Each chart SVG has a labelled ancestor; "Figures as a table" is offered beside the Milburn charts. Note that some chart `aria-label`s embed the figures, so they change with every re-run. |
| Tabs | Two `tablist`s, labelled ("Views", "Impact sections"), one selected tab each, roving `tabindex`, matching `tabpanel`s. |
| Controls | No unnamed buttons, links or inputs in `main`; no click handlers on `div`s; no positive `tabindex`. Eight controls on Impact are under 24px in one dimension (WCAG 2.2 target size, AA). |
| Focus | `:focus-visible` rules exist in `globals.css`, `SubTabs.css`, `PolicySelector.css`, `milburn.css`, `SeriesToggle.css`; **none in `ChartDownloadMenu.css`**. A scripted focus test could not confirm visible rings (script focus does not trigger `:focus-visible` reliably), so **tab through the page by hand**. |
| Contrast | Inconclusive. The probe's failures were artefacts (white title text over a gradient band it could not read; `color(srgb ...)` backgrounds it misparsed). `chartTheme.test.js` and the colour guard keep tokens consistent, but neither measures contrast. Check the series-toggle chips (12.5px text on tinted backgrounds) and white on the teal band by hand. |
| Motion | `prefers-reduced-motion` rules are present. |
| Loading | "Loading results…" has one live region. Benchmarks was still showing "Loading results…" five seconds after a direct link in the dev server; check it in a production build. |
| Metadata | No canonical link and no Open Graph tags: shared links will have no preview card. Not accessibility, but a publication gap. |

## 5. Go/no-go checklist for report day

Owners are named only where the repository names them. Max Mosley appears in
the repository only as a reader of the second-round section
(`docs/milburn-analysis.md`), so no step is assigned to him. Blank owners need
assigning.

**Before the report (16 November)**

| # | Step | Owner | Go if |
|---|---|---|---|
| 1 | Confirm the HMRC SPI condition for build 6f918b81: does it apply, is it met, earliest publication date | María | Written answer. No answer is a no-go for anything public, previews included |
| 2 | Decide Path A (certified) or Path B (local build, labelled) and record who decided | ____ | Recorded in the repository |
| 3 | Confirm the Claude artifact export was not shared outside | Vahid | Confirmed |
| 4 | Decide repository visibility: stay private, or fresh public repository without result history | ____ | Decided |
| 5 | Create the Vercel project with preview protection; set `NEXT_PUBLIC_HOUSEHOLD_API_URL` or change the check | ____ | A protected preview builds |
| 6 | Draft the `appZoneRoutes.ts` pull request in policyengine-app-v2 | ____ | Open, not merged |
| 7 | Fix CI: smoke base path, `black`, the Certified data and Publication gate jobs (make them fit this route or remove them) | ____ | `main` green |

**When the report is out (17 November)**

| # | Step | Owner | Go if |
|---|---|---|---|
| 8 | Read the report; list each recommendation with page reference; map to measures (age band, allowance rate, replacement benefits, start date, migration, Scotland and Northern Ireland) | ____ | Mapping written down |
| 9 | Re-parameterise `reforms.py`; `uv run pytest tests/test_milburn_measures.py -n 4` | ____ | Tests pass |
| 10 | Re-run each measure on the build file (no Hugging Face token in the shell; one at a time) | Vahid (the build file's default path is on his machine) | Every run folder has `model_build.json` |
| 11 | Regenerate `milburn_summary.json`, `milburn_measures.json`, `milburn_scenarios.json`; re-check caseloads | ____ | Caseload check repeated |
| 12 | Send analyses to HMRC if step 1 says so; start the clock | María | Sent, or confirmed not needed |
| 13 | Trim `public/` (2.5) and the measure list to what the report supports | ____ | Only files the page reads remain |
| 14 | Apply a floor by hand on Path B: drop single years of age and `sample_size` from shipped files | ____ | Reviewed by a second person |
| 15 | Rewrite copy (3.1 to 3.3); rename `milburn_package`; cite the report | ____ | Second reader for neutrality |
| 16 | `bun run test`, `bun run lint`, `bun run build`; deploy to the protected preview | ____ | All pass; preview checked on phone and desktop |
| 17 | Accessibility by hand: tab through, heading order on Impact, contrast on chips | ____ | No keyboard trap, visible focus |

**Publish (only when step 1 allows)**

| # | Step | Owner | Go if |
|---|---|---|---|
| 18 | Flip noindex in `next.config.ts` and `layout.tsx`; fix `vercel.json` paths | ____ | `curl -I` shows no `X-Robots-Tag: noindex` |
| 19 | Promote to production | ____ | Page and data files return 200 under `/uk/milburn-review` |
| 20 | Merge the policyengine-app-v2 route | ____ | `policyengine.org/uk/milburn-review` serves the page |
| 21 | Update README, `.env.example`, analytics check (`tool_name` `milburn-review` arriving) | ____ | Done |
| 22 | Rollback route agreed: Vercel instant rollback to the previous deployment, and re-adding noindex | ____ | Named person can do it |

## Not checked

- The SPI licence text itself, and whether any results have already been shared
  outside private repositories by other means.
- Vercel: the plugin is not authorised in this session, so whether a project
  already exists for this repository is unknown. GitHub shows no deployments.
- `next build` locally, the Python test failures in CI, and a full
  `/audit-multizone` run.
- Screen reader behaviour, manual keyboard use and measured contrast.
- The accuracy of any figure or of the benchmark sources' numbers.
