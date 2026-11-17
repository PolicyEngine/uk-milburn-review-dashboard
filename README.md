# Milburn review dashboard: young people and work

PolicyEngine's dashboard for the independent review of young people and work led by Alan Milburn. Its final report, [From a Welfare State to a Working State: a new settlement for the next generation](https://www.gov.uk/government/publications/from-a-welfare-state-to-a-working-state-a-new-settlement-for-the-next-generation), was published by the Department for Work and Pensions on 17 November 2026. The dashboard estimates how the report's tax and benefit measures that a static model can represent would change the public finances and household incomes, by age.

Private repository. Figures are PolicyEngine UK static microsimulation estimates on certified data; they are not for publication until the HMRC SPI licence condition is confirmed (see [Status](#status)).

| | |
|---|---|
| Team test (Claude artifact, link-shared) | https://claude.ai/artifact/U2qwazGPbFJL6qS39AfFvT |
| Local | `bun run dev`, then http://localhost:3000/uk/milburn-review |
| Report-day runbook and reviews | [`docs/report-day/`](docs/report-day/) |
| What the report proposes, and what we model | [`docs/report-day/05-report-measures.md`](docs/report-day/05-report-measures.md) |
| Running the measures | [`docs/milburn-local-run.md`](docs/milburn-local-run.md) |

## What the dashboard shows

| Tab | Content |
|---|---|
| Impact: Young people | Key figures, average change by age, change by year, effect of each measure, winners and losers |
| Impact: Poverty | Absolute and relative poverty, before and after housing costs |
| Impact: Public finances | Exchequer effect by year |
| Impact: Return to work | An illustrative move into work (25% of non-working 18 to 24-year-olds with PIP or the health element), beside the review's own estimate of 440,000 into sustained work by 2036 |
| Impact: Benchmarks | Published figures (the review, its annex and data tables, the Resolution Foundation, ONS, IFS) beside our estimates |
| Measures | Each modelled measure, and the report's proposals we cannot compute, with the reason |
| Methodology | Data, model, what is modelled, limitations |

Every PolicyEngine figure is labelled "PolicyEngine estimate"; published figures carry their source. Each person counts their whole household's change, so ages outside a measure's target change only through shared households.

## The measures

The report's measures, from April 2029, when the report's welfare savings start (analytical annex, section 1). Static estimates for 2029-30, against current law.

| Run id | Measure | Exchequer, 2029-30 | 16–24s in affected households |
|---|---|---|---|
| `milburn_report_package` | UC health element removed for under-25s and PIP removed for 18 to 24-year-olds, together; no replacement payments modelled, so losses are an upper bound | £4.67bn saving | 580,000 (lose) |
| `milburn_report_uc_health` | UC health element removed for under-25s (para 748) | £1.13bn saving | 404,000 (lose) |
| `milburn_report_pip` | PIP removed for 18 to 24-year-olds (paras 752–757) | £3.64bn saving | 557,000 (lose) |
| `milburn_report_employer_nics_threshold` | Employer NI threshold £5,000 → £10,000 for 21 to 24-year-olds in retail and hospitality (SIC 47, 55, 56), end state (paras 269–270) | £0.22bn cost | 766,000 (gain) |
| `milburn_report_youth_allowance_independent` | Higher Youth Allowance for under-25s living independently: the 25-and-over rate where the claim has a housing element, the review's own proxy (annex, section 8) | running | |
| `milburn_report_package_phased` | The package phased in: new 18-year-olds at once, existing claimants at an assumed 45% a year (about 95% within five years, para 773) | running | |
| `milburn_report_employer_nics_threshold_glide_path` | The NI threshold in assumed equal steps, £6,000 in 2027-28 to £10,000 in 2031-32 | running | |

Comparators modelled before the report (from April 2027): `pip_halved_under_25` (a stand-in for the Additional Cost Allowance, whose rates the report does not set) and `employer_nics_zero_under_25` (the option the report considers and does not propose, para 268). The other pre-report runs stay in `public/data/milburn/` and load by link, but the selector does not offer them.

Not computable, listed on the Measures tab with the reason: the Additional Cost Allowance, Severe and Complex Needs Insurance, the local Health and Disability Fund, the Youth Allowance higher rate's amount and work allowance as the report states them, the duty to engage, the Care Leaver Transition Allowance, the Opportunity Guarantee, employer hiring payments, the apprenticeship target and further education places.

Definitions are in [`src/uk_budget_data/reforms.py`](src/uk_budget_data/reforms.py) (Milburn section; the report runs are reserved ids promoted by `MILBURN_PROMOTED_IDS`), with modifiers in [`src/uk_budget_data/budget_measures/`](src/uk_budget_data/budget_measures/) and the report's design choices in `milburn_design.py` (`REPORT_*` constants).

## Data and engine

- **policyengine 6.20.2** (`pyproject.toml`, `uv.lock`), whose bundle certifies **Microcosm UK build `fcfac709`** with policyengine-uk 2.177.7 and policyengine-core 3.34.10. Upgrade the bundle, never policyengine-uk alone.
- Runs load the certified file from the location the bundle pins, checked by SHA-256 and `local_build.bundle_certifies()` ([`src/uk_budget_data/local_build.py`](src/uk_budget_data/local_build.py)). Fetch it once with the command in [`docs/milburn-local-run.md`](docs/milburn-local-run.md).
- Every run writes `model_build.json` (build, dataset SHA-256, engine, `certified`, policyengine version) beside its tables in `public/data/milburn/<id>/`.

## Running

```bash
uv sync --locked --extra dev
bun install --frozen-lockfile
bun run dev                                   # http://localhost:3000/uk/milburn-review
```

Re-running measures (about 8 minutes each; one heavy run at a time under `/tmp/pe-heavy.lock`):

```bash
STAGE=~/milburn-runs/<date> bash scripts/milburn_rerun_all.sh <id> [<id> ...]   # stages outside the repo
rsync -a --delete ~/milburn-runs/<date>/<id>/ public/data/milburn/<id>/          # copy in
.venv/bin/python scripts/milburn_summary.py                                       # regenerate milburn_summary.json
.venv/bin/uk-budget-data milburn-measures --output public/data/milburn_measures.json
```

Tests and lint: `bunx vitest run --pool=forks`, `bunx eslint src`, `.venv/bin/pytest tests/test_milburn_design.py tests/test_milburn_measures.py -n 2`.

Claude artifact build: `python3 scripts/artifact_export.py` stages a static copy in `artifact-export/publish/`.

## Page switches

| Switch | Effect |
|---|---|
| `REPORT_PUBLISHED` in `src/utils/milburn/reportStatus.js` (on) | The wording for after the final report |
| `REPORT_DAY` in `src/utils/milburn/reportDay.js` (off) | Hides Return to work and Benchmarks |
| `DEFAULT_DISPLAY_YEAR` in `src/utils/displayYears.js` (2029) | The year the page opens on |

## Status

- Not for publication: the HMRC SPI licence condition on the data is not yet confirmed with María, and the deploy target, disclosure floor and CI are open ([`docs/report-day/04-publication-readiness.md`](docs/report-day/04-publication-readiness.md)).
- The review's own figures (£3.6bn welfare saving in 2036-37, £13.7bn over 2029-30 to 2036-37, 50,000 fewer in relative poverty) include replacement payments and employment effects; ours are static, without replacements. The dashboard says so beside each one.

## Origin

Forked from PolicyEngine's UK Autumn Budget 2026 dashboard; its README, covering the verified publication route, the household API and Budget-day operations, is kept at [`docs/autumn-budget-template-README.md`](docs/autumn-budget-template-README.md). Code and writing conventions are in [`.claude/CLAUDE.md`](.claude/CLAUDE.md): British English, sentence case, colours from the design tokens.

Data and analysis powered by PolicyEngine UK.
