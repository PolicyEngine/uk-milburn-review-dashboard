# Milburn review: pre-publication analysis (draft, 15 November 2026)

> **Historical.** This note was written before the final report, on the
> uncertified Microcosm build 6f918b81, with the pre-report packages, 2027-28
> start dates and the netted average loss. None of its figures is current.
> The dashboard now runs on build fcfac709 (pre-report runs first made on
> policyengine 6.20.1, report runs on 6.20.2, same engine and data; every run
> now records 6.20.2; see docs/milburn-local-run.md) with the report's
> measures from April 2029; current figures are in
> `public/data/milburn_summary.json` and `public/data/milburn/<run>/`, and the
> design choices in `src/uk_budget_data/budget_measures/milburn_design.py`.
> Kept as a record of the pre-publication analysis.

Internal working note. Not for publication: figures come from a local build
(Microcosm build 6f918b81, policyengine-uk 2.177.7, not in a policyengine.py
release) and will be re-run on the report's actual proposals on 17 November.
The build also carries an HMRC SPI licence condition (analyses to HMRC ten
working days before publication); confirm with María before anything goes
public.

## What is expected on 17 November

From briefings (Times and BBC 12 Nov, Guardian 12–13 Nov, BBC 14 Nov, PA
15 Nov); nothing below is confirmed text.

- UC health (LCWRA) element abolished for under-25s.
- PIP replaced for under-25s: a discretionary local fund for most, an
  additional cost allowance for the most disabled, a higher insurance-type
  payment for those who can never work.
- A youth allowance at "the standard UC rate" (briefings imply the under-25
  rate, so no change in the allowance itself).
- Existing claimants move across when reassessed (natural migration); no
  transitional protection mentioned.
- A legal "opportunity guarantee" of a job, training or support, with
  benefits at risk if refused.
- Not addressed: Scotland (Adult Disability Payment), Northern Ireland, the
  exact age band (16–24 or 18–24).

## Static results, 2027-28

Saving is the static Exchequer effect (positive = saving). "Young people in
losing households" counts 16–24-year-olds living in a household whose net
income falls, siblings and partners included. Poverty: absolute after housing
costs (fixed real line) and relative after housing costs (60% of a median
that the measures themselves move).

| Measure | Saving 2027-28 | 16-24s in losing households | Avg loss (losing hh) | Absolute AHC poverty | Break-even 16h / 25h |
|---|---|---|---|---|---|
| employer_nics_zero_under_25 | £-4.43bn | 2843k (38.1%) | £-2,706 | -0.12pp (-83k) | –% / –% |
| milburn_package | £4.49bn | 578k (7.8%) | £12,622 | +0.59pp (410k) | 160.5% / 125.4% |
| milburn_package_central | £2.54bn | 578k (7.8%) | £6,994 | +0.45pp (314k) | 89.0% / 69.5% |
| milburn_package_entry_25pct | £4.61bn | 560k (7.5%) | £11,305 | +0.39pp (272k) | 143.8% / 112.3% |
| milburn_package_phased | £2.01bn | 239k (3.2%) | £12,462 | +0.21pp (143k) | 158.5% / 123.8% |
| pip_halved_under_25 | £1.72bn | 555k (7.5%) | £4,718 | +0.29pp (200k) | 60.0% / 46.9% |
| pip_removed_16_to_24 | £4.42bn | 647k (8.7%) | £10,728 | +0.72pp (499k) | 136.4% / 106.6% |
| pip_removed_under_25 | £3.44bn | 555k (7.5%) | £9,954 | +0.44pp (306k) | 126.6% / 98.9% |
| uc_health_element_removed_under_22 | £0.60bn | 235k (3.2%) | £4,983 | +0.05pp (38k) | 63.4% / 49.5% |
| uc_health_element_removed_under_25 | £1.15bn | 406k (5.4%) | £5,011 | +0.12pp (85k) | 63.7% / 49.8% |
| uc_health_element_removed_under_25_new_claims | £0.06bn | 30k (0.4%) | £2,720 | +0.00pp (3k) | 34.6% / 27.0% |
| uc_health_element_removed_under_25_severe_kept | £0.83bn | 286k (3.8%) | £4,975 | +0.10pp (70k) | 63.3% / 49.4% |
| youth_allowance_at_25_plus_rate | £-0.80bn | 1157k (15.5%) | £-1,116 | -0.16pp (-114k) | –% / –% |

Negative saving = a cost; for gain measures the loss columns are gains (negative loss). Break-even only applies to loss measures. Table from `scripts/milburn_summary.py`.

## Reading the numbers

- **The package is an upper bound.** Full abolition with no replacement fund,
  cost allowance or insurance payment, reaching everyone in April 2027. The
  phased variant (existing claimants reached as reassessed, about 36% in
  2027-28) and the central variant (severe cases keep the element; PIP at
  half rate standing in for the cost allowance) bracket the briefed design.
- **Variants (2027-28).** Phased: £2.01bn, rising to £4.74bn by 2031-32
  (full abolition £4.89bn); absolute AHC poverty +0.21pp rising to +0.53pp.
  Central (severe cases keep the element on 24+ PIP daily living points;
  PIP at half rate): £2.54bn; the same 578k young people in losing
  households but an average household loss of about £7,000 rather than
  £12,600; absolute AHC poverty +0.45pp (~314k) against +0.59pp (~410k). PIP at half
  rate alone saves £1.72bn, more than half of direct PIP (£1.46bn): half an
  award can fall below the amounts that some disability rules read (such
  as severe disability status), so the proxy may overstate losses relative
  to a new allowance with its own passports. Carer's Allowance does not
  change in the model: policyengine-uk 2.177.7 does not link a carer's
  entitlement to the PIP of the person cared for.
  Severe cases kept: the health element removal saves £0.83bn rather than
  £1.15bn. PIP from 16: £4.42bn rather than £3.44bn (87k recipients aged
  16–17).
- **Overlap.** In the data, limited capability for work among under-25s
  mostly coincides with PIP receipt (about nine in ten young LCWRA claimants
  also get PIP). The package therefore stacks both losses on largely the
  same people: per-person losses are an upper bound and headcounts a lower
  bound.
- **Caseloads.** The model's ~233k young LCWRA awards match the Resolution
  Foundation's 260k on UC health, not the 62,570 figure in press coverage
  (a subgroup). The model has ~345k PIP recipients aged 18–24 (UK) at an
  average of ~£8,300; the press figure of ~430k aged 16–24 is England and
  Wales, so the model's caseload is low and its award mix high (more
  enhanced awards), roughly offsetting in cost.
- **Caseload check (baseline, 2027-28, this build).** PIP: 347k recipients
  aged 18–24 (£2.91bn direct), 435k aged 16–24 (£3.72bn), 4.29m in all
  (£32.8bn). UC: 232k benefit units with the LCWRA element in which every
  adult is under 25 (RF: 260k young people on UC health); 2.79m LCWRA units
  in all, about 23% above DWP's 2.27m paid households, so the all-age LCWRA
  stock runs high. PIP removal saves £3.44bn against £2.91bn of direct PIP:
  the other ~£0.5bn is Universal Credit amounts that follow the PIP award
  (such as the disabled child element, entitlement while in education and
  the shared accommodation rate exemption). Carer's Allowance and the UC
  carer element do not change: the model does not link a carer's
  entitlement to the PIP of the person cared for (in reality a carer could
  lose it, a limitation). For the report's 18–24 run in 2029-30: about
  £3.09bn of PIP and £0.56bn of knock-on effects.
- **Health element rate.** The engine pays the new-claimant rate (£217.26 a
  month) to a random 13% of awards in 2027-28, regardless of age. Young
  claimants turn over fast, so more of them are likely on the lower rate;
  the removal's saving would be about £0.9bn at a 50% mix rather than
  £1.15bn.
- **Sample size.** Roughly 500–650 survey records of young claimants drive
  these results; patterns across individual deciles or single years of age
  are noise.

## Second-round effects (for Max Mosley and others)

The main figures are static. The dashboard's Behavioural scenarios tab and
the `milburn_package_entry_25pct` run give illustrative second-round
numbers:

- A 22-year-old with LCWRA moving from no work to 16 hours a week at the
  National Living Wage gains about £7,900 a year net (25 hours: about
  £10,100) and the Exchequer gains about £4,000 (25 hours: about £8,900).
  The gain from work is the same under current law and the package, because
  the element is a fixed amount while UC stays in payment.
- Break-even arithmetic: for the average income of young people in losing
  households to recover, the share moving into work would have to be
  loss ÷ gain. For the health element alone that is about 64% (16 hours) or
  50% (25 hours); for the full package it exceeds 100%, so no entry rate at
  these hours restores the average, because PIP is not means-tested and
  work does not bring it back.
- Entrants whose gains would match the package's total income loss: about
  570k at 16 hours (450k at 25 hours), against ~233k young LCWRA awards and
  the review's claim of 440,000 "opportunities" by 2036 (placements and
  education, not additional jobs).
- Microsimulated scenario (`milburn_package_entry_25pct`): if a random
  quarter of affected young people who do not work (aged 18–24, with PIP or
  LCWRA) moved into 16 hours a week at their minimum wage, the 2027-28
  saving rises only from £4.49bn to £4.61bn, because many young PIP
  recipients are not on UC (they live with parents), so the Exchequer gains
  little beyond employer NICs. The rise in absolute poverty after housing
  costs falls by about a third (+0.39pp, ~272k people, against +0.59pp,
  ~410k) and the average loss in losing households from about £12.6k to
  £11.3k. The fiscal second-round effect is small; the distributional one
  is not.
- Unverified figures heard in conversation (450,000 more in work; 45% of
  about 1m affected; an average loss over £3,000) were not found in any
  published source as of 15 November.

## Comparators (not review proposals)

- Under-25 UC standard allowance at the 25-and-over rate: costs about
  £0.8bn; 1.16m 16–24-year-olds in gaining households, about £1,100 a year.
- Employer NICs zero rate extended to under-25s: costs about £4.4bn (the
  Resolution Foundation estimates £5.1bn; the model has about 11% fewer
  young employees than HMRC). Absolute poverty falls slightly; relative
  poverty rises because the median rises.

## To do on 17 November

1. Re-parameterise to the report: age band, youth allowance rate,
   replacement benefits, start date and migration path, Scotland/NI.
2. Re-run the package and its parts on the same pair; check caseloads again.
3. Confirm the SPI condition before any publication.
