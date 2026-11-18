# Milburn review dashboard: young people and work

PolicyEngine's dashboard for the independent review of young people and work led by Alan Milburn. Its final report, [From a Welfare State to a Working State: a new settlement for the next generation](https://www.gov.uk/government/publications/from-a-welfare-state-to-a-working-state-a-new-settlement-for-the-next-generation), was published by the Department for Work and Pensions on 17 November 2026. The dashboard estimates how the report's tax and benefit measures that a static model can represent would change the public finances and household incomes, by age.

Public repository. Figures are PolicyEngine UK static microsimulation estimates on certified data; the HMRC SPI licence condition was confirmed as met on 17 November 2026; the public deploy is still open (see [Status](#status)).

| | |
|---|---|
| Team test (Claude artifact; share from its Share menu) | https://claude.ai/artifact/QfSsGU9tLmREcbgGFHmcUB |
| Household API (Modal app `uk-milburn-household`) | https://policyengine--uk-milburn-household-web.us-east.modal.run/api/household-impact |
| Local | `bun run dev`, then http://localhost:3000/uk/milburn-review |
| Report-day runbook and reviews | [`docs/report-day/`](docs/report-day/) |
| What the report proposes, and what we model | [`docs/report-day/05-report-measures.md`](docs/report-day/05-report-measures.md) |
| Running the measures | [`docs/milburn-local-run.md`](docs/milburn-local-run.md) |

## What the dashboard shows

| Tab | Content |
|---|---|
| Impact: Young people | Key figures, average change by age, change by year, effect of each measure, gains and losses |
| Impact: Poverty | Absolute and relative poverty, before and after housing costs |
| Impact: Public finances | Exchequer effect by year |
| Impact: Moves into work (illustrative) | An assumed move into work (25% of non-working 18 to 24-year-olds with PIP or the health element, an assumption, not an estimate), set apart from the review's own estimate of 440,000 into sustained work by 2036 |
| Impact: Benchmarks | Published figures (the review, its annex and data tables, the Resolution Foundation, ONS, IFS) beside our estimates on the same basis (ages, area, year and measure), with our savings shown apart |
| Household impact (`?tab=household`) | One young person's household in 2029-30 under current law and under the report's runs: the package (with its health element and PIP parts) and, separately, the higher Youth Allowance, the work allowance (illustrative) and the employer NI threshold, with a breakdown by programme. Eight stored examples load from `public/data/milburn_household_presets.json` with no API; a custom household needs the household API |
| Measures | Each modelled measure, and the report's proposals we cannot compute, with the reason |
| Methodology | Data, model, what is modelled, limitations |

Every PolicyEngine figure is labelled "PolicyEngine estimate"; published figures carry their source. Each person counts their whole household's change, so ages outside a measure's target change only through shared households.

## The measures

The report's measures, from April 2029, when the report's welfare savings start (analytical annex, section 1). Static estimates for 2029-30, against current law.

| Run id | Measure | Exchequer, 2029-30 (cash terms) | 16–24s in households whose income changes |
|---|---|---|---|
| `milburn_report_package` | UC health element removed for under-25s and PIP removed for 18 to 24-year-olds, together; no replacement payments modelled, so losses are an upper bound | £4.67bn saving | 580,000 |
| `milburn_report_uc_health` | UC health element removed for under-25s (para 745) | £1.13bn saving | 404,000 |
| `milburn_report_pip` | PIP removed for 18 to 24-year-olds (paras 750–757) | £3.64bn saving | 557,000 |
| `milburn_report_employer_nics_threshold` | Employer NI threshold £5,000 → £10,000 for 21 to 24-year-olds in retail and hospitality (SIC 47, 55, 56), end state from an assumed April 2027, cost net of tax on the higher pay (paras 269–270) | £0.22bn cost | 766,000 |
| `milburn_report_youth_allowance_independent` | Higher Youth Allowance for under-25s living independently: the 25-and-over rate where the claim has a housing element, the review's own proxy (annex, section 8) | £0.13bn cost | 159,000 |
| `milburn_report_package_phased` | The package phased in: new 18-year-olds at once, existing claimants at an assumed 45% a year (about 95% within five years, para 773) | £2.77bn saving | 341,000 |
| `milburn_report_employer_nics_threshold_glide_path` | The NI threshold in assumed equal steps, £6,000 in 2027-28 to £10,000 in 2031-32 | £0.14bn cost | 766,000 |
| `milburn_report_employer_nics_threshold_all_sectors` | Illustrative: the £10,000 end state for every 21 to 24-year-old employee in every sector, an upper bound: para 270 says the government should consider extending the relief to other sectors, "focusing on those with the biggest potential to create more entry level jobs", and names none, from an assumed April 2027, cost net of tax on the higher pay | £0.91bn cost | 2,857,000 |
| `milburn_report_youth_allowance_work_allowance` | Illustrative: a work allowance for every under-25 UC claim (para 749 gives no amount), at the current UC work allowance amounts, the lower with a housing element: our assumption | £0.46bn cost | 422,000 |
| `milburn_report_youth_allowance_work_allowance_15h` | Illustrative sensitivity at the report's hours (para 749: "10 or 15 hours a week"): a work allowance of 15 hours a week at the minimum wage for 21 and over, 52 weeks over 12 months (about £900 a month in 2029-30), the same with or without a housing element; claims with a statutory work allowance today (a child or limited capability for work) get the higher of the two, which the current-amount run leaves alone: our assumptions | £0.88bn cost | 752,000 |
| `milburn_report_youth_allowance_combined` | Our combination: the higher Youth Allowance and the illustrative work allowance, simulated together (separately −£0.13bn and −£0.46bn) | £0.63bn cost | 548,000 |
| `milburn_report_package_with_youth_allowance` | Our combination: the health element and PIP removal plus both Youth Allowance changes, simulated together; no replacement payments modelled | £4.05bn saving | 1,043,000 |

Child DLA extended to 18 (para 760) is listed as not computable: DLA and PIP pay the same amounts, so the swap changes no payment for those who move; about 77% of child DLA claimants move to PIP by 17 (para 759), so some who would lose an award at 16 would keep DLA longer, and the data cannot identify them (its reserved run, `milburn_report_child_dla_to_18`, is all zeros and is not published).

Comparators modelled before the report (from April 2027): `pip_halved_under_25` (a stand-in for the Additional Cost Allowance, whose rates the report does not set) and `employer_nics_zero_under_25` (the option the report considers and does not propose, para 268). The other pre-report runs stay in `public/data/milburn/` and load by link, but the selector does not offer them.

Not computable, listed on the Measures tab with the reason: the Additional Cost Allowance, Severe and Complex Needs Insurance, the local Health and Disability Fund, the Youth Allowance higher rate's amount and work allowance as the report states them, the duty to engage, income protection during serious illness (paras 716, 746, 782; our runs remove the health element from these people too), the Care Leaver Transition Allowance, the Opportunity Guarantee, the civic service programme (para 684), employer hiring payments (with the apprenticeship payment rising from £2,000 to £2,500, paras 51, 280, 472), the Flexible Jobs Scheme and supported paid jobs (paras 689–690, 780), start-up support for young entrepreneurs (chapter 6.4, after para 681), the apprenticeship target and further education places. No change proposed, so nothing to model: the automatic-enrolment age should not fall to 18, nor the lower earnings limit be removed for under-25s, before 2031 at the earliest (paras 287–288), and the pace at which the 18 to 20 rate of the minimum wage converges on the National Living Wage stays with the Low Pay Commission (paras 285–286).

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
rsync -a --delete --exclude=income_curve.csv --exclude=household_scatter_binned.csv --exclude=obr_comparison.csv \
  ~/milburn-runs/<date>/<id>/ public/data/milburn/<id>/                          # copy in (not the tables the page never reads)
.venv/bin/python scripts/milburn_summary.py                                       # regenerate milburn_summary.json
.venv/bin/uk-budget-data milburn-measures --output public/data/milburn_measures.json
```

Household impact tab: the eight stored examples are precomputed through the household API's own code path (`src/uk_budget_data/milburn_household.py`, about five minutes, no Hugging Face token):

```bash
.venv/bin/python scripts/precompute_milburn_household_presets.py   # writes public/data/milburn_household_presets.json
HOUSEHOLD_WORKERS=2 PORT=8010 uv run uk-budget-api                  # a local API for custom households
NEXT_PUBLIC_HOUSEHOLD_API_URL=http://localhost:8010/api/household-impact bun run dev
```

Custom households on a deployed page use the Modal app `uk-milburn-household` (no warm schedule, scales to zero, at most 10 workers; see the docstring of `src/uk_budget_data/modal_household.py`). Deployed on 17 November 2026 from b8a7b490; redeploy after any change to the household code:

```bash
HOUSEHOLD_MODAL_APP=uk-milburn-household uv run --with modal modal deploy src/uk_budget_data/modal_household.py
uv run --with modal modal app stop -y uk-milburn-household          # stop it
```

Then build the page with `NEXT_PUBLIC_HOUSEHOLD_API_URL=https://policyengine--uk-milburn-household-web.us-east.modal.run/api/household-impact` (confirmed by the deploy). The first request after an idle spell takes one to two minutes while containers start; the page retries. Without the variable the build passes with a warning: the tab shows the stored examples only and says custom households are not available yet.

Tests and lint: `bunx vitest run --pool=forks`, `bunx eslint src`, `.venv/bin/pytest tests/test_milburn_design.py tests/test_milburn_measures.py -n 2`.

Claude artifact build: `python3 scripts/artifact_export.py` stages a static copy in `artifact-export/publish/`.

## Page switches

| Switch | Effect |
|---|---|
| `REPORT_PUBLISHED` in `src/utils/milburn/reportStatus.js` (on) | The wording for after the final report |
| `REPORT_DAY` in `src/utils/milburn/reportDay.js` (off) | Hides Moves into work (illustrative) and Benchmarks |
| `DEFAULT_DISPLAY_YEAR` in `src/utils/displayYears.js` (2029) | The year the page opens on |

## Status

- The HMRC SPI licence condition was confirmed as met on 17 November 2026. Still open before the public deploy: the deploy target, the disclosure floor review and CI (issue #2) ([`docs/report-day/04-publication-readiness.md`](docs/report-day/04-publication-readiness.md)).
- The review's own figures (£3.6bn welfare saving in 2036-37, £13.7bn over 2029-30 to 2036-37, 50,000 fewer in relative poverty) include replacement payments and employment effects; ours are static, without replacements. The dashboard says so beside each one.

## Origin

Forked from PolicyEngine's UK Autumn Budget 2026 dashboard; its README, covering the verified publication route, the household API and Budget-day operations, is kept at [`docs/autumn-budget-template-README.md`](docs/autumn-budget-template-README.md). Code and writing conventions are in [`.claude/CLAUDE.md`](.claude/CLAUDE.md): British English, sentence case, colours from the design tokens.

Data and analysis powered by PolicyEngine UK.
