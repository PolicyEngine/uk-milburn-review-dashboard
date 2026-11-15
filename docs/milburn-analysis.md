# Milburn review: pre-publication analysis (draft, 15 November 2026)

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

FILLED FROM `public/data/milburn_summary.json` BY `scripts/milburn_summary.py`.

## Reading the numbers

- **The package is an upper bound.** Full abolition with no replacement fund,
  cost allowance or insurance payment, reaching everyone in April 2027. The
  phased variant (existing claimants reached as reassessed, about 36% in
  2027-28) and the central variant (severe cases keep the element; PIP at
  half rate standing in for the cost allowance) bracket the briefed design.
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
  the other ~£0.5bn is carer benefits, disability premia and benefit cap
  exemptions that follow the PIP award.
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
