# 05. The final report's measures and how they map to the model

Read on 17 November 2026 from the GOV.UK publication "From a Welfare State to a
Working State: a new settlement for the next generation" (published 11:30).
Nothing in the code, constants or data was changed to write this note.

Sources, and how they are cited below:

- **Report** (HTML): paragraph numbers, e.g. "para 748". Chapter 6.5 (paras
  720-783) is the benefits design; 3.5 (paras 263-289) the employer measures;
  8.2-8.4 (paras 928-942 and the implementation timetable) the money and dates.
- **Annex** (HTML analytical annex): section numbers, e.g. "annex s.1, welfare
  savings".
- **ODS** (accompanying data tables): sheets `Cover`, `Contents`, `Notes`,
  `Guidance`, `1`, `2`, `3`. Only three tables, all headline.
- Local copies: `/private/tmp/claude-501/-Users-vahid-uk-milburn-review-dashboard/f8da878b-2210-4265-bae9-de88c7db72c3/scratchpad/report/`
  (`report.txt`, `annex.txt`, `tables.ods`). The PDFs were not read: the HTML
  is the full report.

Three things to know first:

1. **The report gives almost no rates.** No amount for the higher Youth
   Allowance, the work allowance, the Additional Cost Allowance or the Severe
   and Complex Needs Insurance; no eligibility rule beyond principles. Para 751:
   "this review sets the principle and the intended protection, not a new
   assessment regime in full." The annex calls its own PIP split "illustrative
   assumptions" and does not publish it.
2. **Welfare changes start in 2029-30, not April 2027**, and reach existing
   claimants at their scheduled reassessment, within five years.
3. **The only published costing year is 2036-37** (2026-27 prices). Our model
   stops at 2031-32, so no figure is like for like.

## Summary

| Measure | What the report says | Modellable | Constants or new code |
|---|---|---|---|
| UC health (LCWRA) element, under 25 | Abolished with the Work Capability Assessment "for most people aged under 25" (para 745); new claims by 18 to 24-year-olds go to the new system (timetable, "2029 onwards") | Y | `REPORT_UC_HEALTH_UPPER_AGE = 25`, `REPORT_UC_HEALTH_LOWER_AGE = 0` (or 18), `REPORT_UC_HEALTH_SEVERE_KEPT = False` (or `True` as a stand-in for the insurance); `REPORT_START_YEAR = 2029` |
| PIP, 18 to 24 | Replaced by a local Health and Disability Fund, an Additional Cost Allowance and a Severe and Complex Needs Insurance (paras 750-757). Child DLA extended to 18 (para 760) | Partly | `REPORT_PIP_LOWER_AGE = 18`, `REPORT_PIP_UPPER_AGE = 25`; `REPORT_PIP_REPLACEMENT_NAME = "additional cost allowance"` once a share is chosen. Shares: none published. `0.0` is the upper bound; any tier is our stand-in |
| Youth Allowance, base rate | "set at the current UC rate for people under 25" (para 748) | Y (no change) | `REPORT_YOUTH_ALLOWANCE_MONTHLY = None`: nothing to run |
| Youth Allowance, higher rate for those living independently | "higher for young people living independently, including care leavers and those who have experienced family estrangement" (para 748). Annex s.8 models it as the 25-and-over rate, proxied by receipt of the UC housing element | Partly | **New code**: 25-and-over standard allowance where an under-25 benefit unit has `uc_housing_costs_element > 0`. The constant cannot do it (it moves every under-25). `youth_allowance_at_25_plus_rate` is an upper bound |
| Work allowance for under-25s | "available for everyone in receipt of the Youth Allowance who is in employment" (para 749); annex s.8: "extended to all claimants aged under 25 and is set at a level to allow for part-time work". No amount | Partly | **New code**: make under-25 benefit units eligible (`is_uc_work_allowance_eligible`) at an assumed level, labelled as ours |
| Timing and transition | New claims once the local service exists (every area by end 2029); stock at scheduled reassessment after a six-month preparation; "a maximum period of no more than 5 years" (para 773); savings "from 2029/30" | Partly | `REPORT_START_YEAR = 2029`, `REPORT_REASSESSED_EACH_YEAR = 0.25` (see limits), `REPORT_NEW_ENTRANT_AGE = 18`. The phased package is the closest fit |
| Employer NICs | Not a rate. The secondary threshold for 21 to 24-year-olds in retail and hospitality to "double and rise progressively from the current £5,000 threshold to a new one of £10,000", on a "5-year glide path", "when fiscal conditions allow" (paras 269-270). Uncosted, undated | Partly | `REPORT_EMPLOYER_NICS_UNDER_25_RATE = None`. **New code**: a zero-rate band from £5,000 to a rising ceiling for ages 21 to 24 in chosen SIC divisions (`sic_industry_division` is in the data) |
| Youth Jobs Grant | £3,000 core grant for hiring a 16 to 24-year-old NEET for six months; plus £2,000 premium (greater barriers); plus £2,000 small business premium (under 50 employees); about 60,000 a year (paras 275-277) | N | Employer grant, no household rule. Arithmetic only |
| Apprenticeship incentive | Employer payment from £2,000 to £2,500 and extended to Levy payers; new £2,000 provider incentive (para 280); 270,000 under-25 starts a year by 2036-37 | N | Programme spending |
| Jobs Guarantee | From 18 months to 12 months out of work (para 279) | N | Programme |
| Severe and Complex Needs Insurance | "a stable, long-term income set above the maximum benefit rates available today", "a very high bar" (para 756). No rate, no test | N (proxy only) | Stays listed as not computable (`severe_conditions_higher_rate`), or new code paying a flat amount to a points proxy |
| Health and Disability Fund | Local, discretionary, one-off or changing costs (paras 752-753). Annex: "illustratively modelled as a set portion of yearly savings from reforms to PIP"; portion not published | N | Aggregate offset only |
| Care Leaver Transition Allowance | "£50 a week for 6 months for care leavers who are NEET or at serious risk" (paras 71, and chapter 4 "Care-experienced young people") | N | No care leaver flag in the data. Arithmetic if a caseload is supplied |
| Civic service payment | "additional financial support" for 8 to 24 hours a week (para 684). No amount | N | - |
| FE places | "over 150,000 additional young people aged 18 to 24 participating in FE each year" (para 450), England, reached in 2036-37 | N | Programme spending |
| Minimum wage, pensions auto-enrolment | No change proposed; auto-enrolment age not to fall to 18 "before 2031 at the earliest" (para 288) | - | Current law |

## Proposed `REPORT_*` settings

```python
REPORT_START_YEAR = 2029            # savings "from 2029/30"; was 2027
REPORT_START_MONTH = 4
REPORT_UC_HEALTH_LOWER_AGE = 0      # "under 25"; 18 if following the timetable's "18 to 24"
REPORT_UC_HEALTH_UPPER_AGE = 25
REPORT_UC_HEALTH_SEVERE_KEPT = False  # abolished outright; True only as a stand-in for the insurance
REPORT_SEVERE_DL_POINTS = 24
REPORT_PIP_LOWER_AGE = 18           # Child DLA extended to 18; annex: "PIP inflows aged 18 to 24"
REPORT_PIP_UPPER_AGE = 25
REPORT_PIP_INCLUDE_SCOTLAND = True  # decision for the caller: see "Scotland and Northern Ireland"
REPORT_PIP_REPLACEMENT_SHARE = 0.0  # upper bound; the report publishes no share
REPORT_PIP_REPLACEMENT_SHARES = None  # or a stand-in tier, labelled as ours
REPORT_PIP_REPLACEMENT_NAME = None  # "additional cost allowance" once a share above 0 is chosen (text only)
REPORT_REASSESSED_EACH_YEAR = 0.25  # "no more than 5 years"; see limits
REPORT_NEW_ENTRANT_AGE = 18
REPORT_YOUTH_ALLOWANCE_MONTHLY = None   # base rate is the under-25 UC rate
REPORT_EMPLOYER_NICS_UNDER_25_RATE = None  # the proposal is a threshold, not a rate
REPORT_EMPLOYER_NICS_AGE_LIMIT = 25
```

Only `REPORT_START_YEAR` must change from the committed values (and the
replacement name, if a share is used; the validator accepts a name with a
share of 0 but the text then ignores it). With `LAST_POLICY_YEAR = 2031`, a 2029
start leaves three modelled years: 2029-30, 2030-31, 2031-32.

## New code needed, most important first

1. **Higher Youth Allowance for those living independently.** A modifier that
   pays `standard_allowance.amount.SINGLE_OLD` / `COUPLE_OLD` to benefit units
   whose claimants are under 25 and whose `uc_housing_costs_element` is above 0
   (the annex's proxy). 2026-27 amounts in the engine: £338.58 a month under 25,
   £424.90 at 25 and over, so £86.32 a month for a single claimant. Keep the
   `protected_health_element` pin used by `youth_allowance_at_25_plus_rate`.
   This is a cost, and it is inside the review's £3.6bn net saving.
2. **Work allowance for all under-25 claimants.** Override
   `is_uc_work_allowance_eligible` to be true where the claimants are under 25
   (today it needs a child or limited capability for work). The level is not
   given. Options to label as ours: the current allowances (£427 a month with
   housing support, £710 without, 2026-27), or 15 hours a week at the minimum
   wage (the report's "10 or 15 hours a week", para 749). A cost, also inside
   the £3.6bn. Note that removing the health element does not remove LCW or
   LCWRA status in our modifier, so those claimants keep today's work allowance
   either way.
3. **Phased package for the report's timetable.** Mostly there
   (`milburn_report_package_phased`). Gaps against the report: (a) a "new
   entrant" is someone turning 18, so new claims at 19 to 24 are missed, though
   the report sends all new claims to the new system; (b) 0.25 of the remaining
   stock a year leaves about 24% of an unaged stock after five years, where the
   report completes in five (ageing out at 25 removes most of that); (c) the
   Youth Allowance and work allowance changes (items 1 and 2) are not in it.
4. **Employer NICs threshold for 21 to 24-year-olds in retail and
   hospitality.** `employer_nics_reduced_rate_under_25` already computes relief
   as `(main rate - rate) x clip(earnings - threshold, 0, width)`. The proposal
   is that with `rate = 0`, a band top of £5,000 rising to £10,000 (in place of
   the upper secondary threshold), ages 21 to 24, and a filter on
   `sic_industry_division`. So: add a band-top-by-year argument, a lowest age
   and a set of SIC divisions. The glide path's years and steps are not given
   (para 271: "set at each fiscal event"); £1,000 a year over five years is our
   reading. Illustrative only: the report attaches no date or costing.
5. **Severe and Complex Needs Insurance stand-in** (optional). A flat amount
   above current maximum awards to a points proxy. No rate and no test are
   published, so any figure is ours.

Not needed: a Northern Ireland switch (the annex's savings are UK-wide).

## Details, with quotes

### 1. Youth Allowance and Universal Credit

The press line that under-25s "no longer qualify for Universal Credit" is not
in the text. The report proposes "a new single Youth Allowance for young
people, set at the standard under 25 rate of Universal Credit with a higher
amount for those living independently. This involves abolishing the Universal
Credit Health top up, removing the need for the Work Capability Assessment"
(para 732; same wording at para 107).

- **What it is**: "a common means-tested income floor for eligible people aged
  under 25 while they engage with their Participation Plan, whether or not they
  have a health condition. The allowance should be set at the current UC rate
  for people under 25. It should be higher for young people living
  independently, including care leavers and those who have experienced family
  estrangement" (para 748). The report quotes the current rate as "£339 per
  month" (para 744).
- **Ages**: "under 25" throughout chapter 6; the timetable says "all new claims
  for benefits for 18 to 24 year-olds will be to Youth Allowance, Additional
  Costs Allowance and the Severe and Complex Needs Insurance in that area".
- **Housing, child and carer elements, the benefit cap, Carer's Allowance,
  passporting, Motability: not stated.** The report does not say how the new
  benefits interact with any of them (a case-insensitive search of both texts
  finds no benefit cap, Carer's Allowance, carer element, child element,
  passporting or Motability; the housing element appears only as the annex's
  proxy). The annex models the Youth Allowance and work allowance
  inside UC with the DWP Policy Simulation Model ("UC Work Allowance is
  extended to all claimants aged under 25"; the housing element is its proxy
  for living independently), so the reading that fits is UC with a renamed
  standard allowance and the other elements unchanged. We should say "not
  stated" and not that they are removed. This matters: the runbook puts
  passporting from PIP at about £0.5bn of the saving.
- **Work allowance**: "A work allowance that allows young people to work
  part-time before their benefits reduce. This should be available for everyone
  in receipt of the Youth Allowance who is in employment. Today a young person
  without children or who has not demonstrated incapacity for work has no work
  allowance at all" (para 749). No amount; the taper is not mentioned.
- **Conditionality**: a young person "who persistently refuses to engage ...
  should ultimately lose their Youth Allowance benefit. Sanctions should be
  rare" (para 106). Not modellable (`youth_conditionality`).
- **Self-employment**: a "£3,000 grant ... should be disregarded when
  calculating the Youth Allowance entitlement", with a start-up period of up to
  18 months (chapter 6.4). Not modelled.
- **Model**: base rate, no change. Higher rate and work allowance, new code
  (items 1 and 2).

### 2. UC health element

- "The Work Capability Assessment and the Universal Credit (UC) health top up
  that goes with it should be abolished. No new work-capability test should
  take their place at the front of the system" (para 745). "the health element
  of Universal Credit is gone" (para 737).
- No exemption is written into the health element itself. Protection for the
  most severe cases is the separate insurance (below), and "During periods of
  serious illness, injury or intensive treatment, like cancer treatment, young
  people should be able to pause support ... and financial help should be
  provided where longer-term needs are not yet known" (para 746), through the
  local fund.
- **Model**: `milburn_report_uc_health` with upper age 25, from 2029. `SEVERE_KEPT
  = False` is the letter of the report without the insurance; `True` (24 daily
  living points) is the nearest stand-in for the insurance but pays today's
  element, not "above the maximum benefit rates available today". The flag
  has no effect in `milburn_report_package_phased`, the closest fit to the
  report's timetable: the severe-case proxy is not applied there.

### 3. PIP: three replacements

"For people under 25, PIP should therefore be replaced by a differentiated
system" (para 750).

- **Local Health and Disability Fund** (paras 752-753): for needs that "are
  immediate, one-off or may change as treatment or support takes effect";
  decided "quickly through the YOS"; "It is not a fixed award"; "Local areas
  should have flexibility". Annex s.1: "illustratively modelled as a set
  portion of yearly savings from reforms to PIP", and s.8: "targeted to those
  who receive no Additional Costs Allowance or Severe and Complex Needs
  Insurance". The portion is not published. Its cost sits in the £1,900m
  "Opportunity and Support Guarantees" line, not in welfare savings.
- **Additional Cost Allowance** (paras 754-755): "a government -run,
  non-means-tested entitlement. It will replace PIP for young people whose
  disability-related extra costs are significant, well established and
  ongoing"; "A government-run assessment gateway"; paid "regardless of
  participation status"; "light-touch checks" in place of full reassessment.
  No rates. The only quantity nearby: "21% of 16 to 24 year-old PIP recipients
  self-reported that they experienced little in the way of health-related
  limitations and incurred no additional costs" (para 754, Resolution
  Foundation). Para 737: "for many the settlement that replaces PIP would pay
  less cash, at least to begin with."
- **Severe and Complex Needs Insurance** (paras 756-757): for "a small
  minority", for example "severe or profound and multiple learning
  disabilities or those ... [who] require continuous, 24-hour care"; "a stable,
  long-term income set above the maximum benefit rates available today";
  "without a qualifying period" (para 732); "a very high bar".
- **Ages**: 18 to 24. "I propose extending Child DLA to age 18, ending the
  cliff-edge that currently forces a fresh assessment at age 16"; "child
  DLA-level cash continues through the transition period and ends with it"
  (paras 760-761). Annex: "PIP inflows aged 18 to 24". Our data hold 16 and
  17-year-olds on PIP; leaving them untouched (lower age 18) is the closest
  reading. Child DLA to 18 itself is not modellable.
- **How the review split claimants**: three groups, "awarded Severe and Complex
  Needs Insurance, at a rate higher than current highest PIP and LCWRA awards";
  "awarded the Additional Cost Allowance"; "no longer be eligible" (annex s.1,
  key assumptions). Shares and rates are not published.
- **Model**: `milburn_report_pip`, ages 18 to 24. Share `0.0` is the upper
  bound of the loss. Any tier (for example enhanced awards kept, standard
  removed) is a stand-in of ours, not the report's, and must be labelled so.

### 4. Start date, phasing, existing claimants

- "Young people entering the welfare system for the first time should move onto
  the new benefits system, with phased rollout starting within the lifetime of
  this Parliament, subject to legislation" (para 733). "every area should have a
  YOS or equivalent service in place by 2029" (para 769).
- Existing claimants are included, by choice: "the new system should apply to
  both the existing group ... as well as the future flow" (para 769). They move
  "once the YOS is rolled out in their area", through "a personalised,
  time-limited transition beginning 6 months before their scheduled
  reassessment date" (para 770).
- Protection during transition, not after: "Current health and
  disability-related payments should continue while the transition work is
  done, so nobody's income changes before the replacement support is in place.
  But the transition to a new system cannot be open-ended ... a maximum period
  of no more than 5 years to complete rollout" (para 773). There is no
  permanent transitional protection.
- Savings timing: "Welfare savings are expected from 2029/30" (para 742);
  annex: "starting in 2029/30".
- A kick-start of "£500 million ... for 2027/28 ... by reprioritising existing
  spending" funds support, not benefits (para 928).

### 5. Scotland and Northern Ireland

- The report does not mention Adult Disability Payment, Scottish social
  security or Northern Ireland's benefits. Para 803: "The diagnosis is UK-wide,
  but the institutional answer will differ because education, skills, health
  and local government are devolved in Scotland, Wales and Northern Ireland.
  The architecture reforms outlined in this chapter are necessarily most
  specific to England". Para 804: the governments "should agree common
  definitions, a shared set of headline outcomes".
- The annex's welfare savings "cover impacts on PIP and UC expenditure across
  the UK" (s.1). Other lines differ: the Guarantees and the Youth Jobs Grant are
  costed for Great Britain; health, education, FE and apprenticeships for
  England only. "it does not generate Barnett consequentials or trigger the
  Barnett Formula" (s.1).
- So: `REPORT_PIP_INCLUDE_SCOTLAND = True` matches the review's own costing
  basis, and `False` matches devolved law (ADP is Scotland's). The report does
  not decide it; the caller should, and say which.

### 6. Employer National Insurance

The press wording was reversed. The text (paras 269-271):

- "I propose a different course: targeted support now, followed by a 5-year
  glide path to lower National Insurance costs for workers aged 21 to 24."
- "A start should be made with the 2 sectors which provide the most entry level
  jobs for young people: retail and hospitality. When fiscal conditions allow,
  the point at which employers in those sectors pay employer National Insurance
  for 21 to 24 year-olds should double and rise progressively from the current
  £5,000 threshold to a new one of £10,000. Before the 2025 changes that
  threshold was £9,100."
- "once the threshold reaches £10,000, a 21 year-old could work 15 hours a week
  at current minimum wage rates without the employer paying any employer
  National Insurance."
- "The pace of change would be set at each fiscal event in the light of the
  fiscal position".
- The full exemption for 21 to 24-year-olds is rejected: "would cost around
  £5.1 billion but only create approximately 38,000 additional jobs, more than
  £130,000 for each additional job" (para 268, Resolution Foundation). That is
  a benchmark for our `employer_nics_zero_under_25` comparator.
- Existing reliefs for under-21s and apprentices under 25 are kept (para 273).

No costing, no start year, and no definition of the sectors by SIC. The annex
does not mention it; it is not in the £1,100m hiring incentives line.

**Industry in our data**: yes. `sic_industry_division` (two-digit SIC 2007 of
the main or last job, from the FRS) and `employment_sector` (public or private)
are in policyengine-uk and in the certified build `fcfac709`. Employees aged 21
to 24 with employment income above 0 (unweighted records; weighted with
`household_weight`, 2024-25):

| Group | Records | Weighted | Share | Mean pay |
|---|---|---|---|---|
| All | 3,116 | 2,135k | 100% | £24,432 |
| Retail, division 47 | 463 | 309k | 14.5% | £23,151 |
| Retail and motor trades, 45 to 47 | 644 | 373k | 17.5% | £23,207 |
| Hospitality, 55 and 56 | 331 | 206k | 9.6% | £15,621 |
| 47, 55 and 56 | 794 | 515k | 24.1% | £20,143 |
| Unknown (0) | 37 | 54k | 2.5% | £20,723 |

Reading "retail" as division 47 and "hospitality" as 55 and 56 is our
assumption. A first-order static cost at the full £10,000 threshold is at most
£5,000 x 15% = £750 an employee a year, so under about £0.4bn before pass-through
(our arithmetic, not a model run).

### 7. Other measures

- **Youth Jobs Grant** (paras 275-278; annex s.1): eligibility moves from UC
  claimants to anyone aged 16 to 24 "NEET for 6 months, whether or not they are
  claiming benefits"; "The existing £3,000 payment should remain the core
  grant"; "a new extra premium of £2,000" for "a care leaver, a young person
  leaving custody, a young parent or a disabled young person who needs
  significant additional support"; "a further new small business premium of
  £2,000" for "fewer than 50 employees"; "around 60,000 incentives a year", up
  to 40,000 of them additional; Great Britain. These are the BBC's £3,000 and
  £2,000.
- **Apprenticeships** (para 280; paras 462, 469-470): incentive to £2,500 and
  extended to Levy payers; "a new £2,000 incentive for the provider"; the
  Treasury top-slice of the Levy removed (about £460m gap in 2026-27, footnote);
  100% funding for under-25s; starts from "around 172,000 in 2024/25 to around
  270,000 by 2036/37, with around 215,000 ... achieving"; 25,000
  pre-apprenticeship places. England only.
- **Further education** (para 450; annex s.1 and s.5): "over 150,000 additional
  young people aged 18 to 24 participating in FE each year", reached in
  2036-37, England only; the 16 to 19 budget to rise automatically with
  participation (para 448).
- **Employer incentives in total**: "around £1.1 billion a year of investment
  at their peak"; "an additional 170,000 job and apprenticeship opportunities"
  (para 281).
- **Care Leaver Transition Allowance**: "£50 a week for 6 months" (para 71).
- **Minimum wage**: no change; the Low Pay Commission should weigh youth
  employment (paras 285-286).

## The review's figures, for benchmarks

The review's own costings (ODS tables, annex) are in 2026-27 prices. Figures
quoted from the interim report (the baseline spend series below) have no price
basis stated in what was read. "should not be regarded as official
government analysis" (annex, purpose).

### Fiscal

ODS sheet `2`, "Table 2: Annual cost and saving per policy area in 2036/37, £m,
2026/27 prices" (rounded to the nearest £100m; also annex Table 1 and report
Figure 2):

| Policy area | £m, 2036-37 |
|---|---|
| Local system reform | [low] (annex: under £100m) |
| Opportunity and Support Guarantees | 1,900 |
| Health | 700 |
| Education | 2,100 |
| Youth hiring incentives | 1,100 |
| Welfare savings | -3,600 |
| Fiscal offsets | -2,400 |
| Total net cost | -200 |

- "In 2036/37 total annual government investment should be around £5.8 billion
  ... offset by £3.6 billion of savings driven by welfare reform and £2.4
  billion in increased tax revenues and reduced benefit payments from growing
  employment" (para 932).
- **Cumulative welfare savings: £13.7bn**, not £13.8bn, and over eight years,
  not ten: "The cumulative welfare savings from 2029/30 to 2036/37 are
  estimated to be -£13,700m" (annex s.1; paras 113, 742, 931). No year-by-year
  profile is published.
- **The £3.6bn is net.** It is "the estimated welfare spending impact of the
  health and disability welfare reform scenarios and forecast additional spend
  resulting from recommended changes to the work allowance and rate of Youth
  Allowance" (annex s.1). It also includes "An additional employment impact of
  9% ... for UC health claimants", a "UC Standard Allowance take-up rate ...
  among those who will in the future not receive PIP" (with some hidden NEETs
  taking it up), and the insurance paid above current maximum awards. It covers
  "PIP and UC expenditure across the UK". Youth Allowance and work allowance
  costs come from the Policy Simulation Model to 2030-31 and are then held
  "flat in 2026/27 prices until 2036/37", with no behavioural response.
- **Baseline spend on youth health and disability benefits** (footnote to para
  789, from the interim report's Table 28, ages 16 to 24): £1.7bn in 2019-20,
  £4.7bn in 2025-26, £8.8bn in 2036-37; of which PIP £1.3bn, £3.8bn, £8.1bn and
  the UC health element £420m, £920m, £680m. So the 2036-37 saving is about 41%
  of baseline spend (our arithmetic: 3.6 / 8.8; rough, as the price basis of
  the £8.8bn is not stated and the £3.6bn is net of new costs). The 2025-26 pair (£3.8bn PIP,
  £0.92bn element) is the nearest check on our baseline for 16 to 24s.
- "Around £8.1 billion is already spent each year on key benefits for young
  people" (para 786). Benefits to employment support: £25 to £1 in 2024-25 (3.7%),
  £2 to £1 by 2036-37 (43.3%) (annex s.9).
- No like-for-like year: our runs end in 2031-32, when the review's reform is
  two to three years into a five-year migration.

### Caseloads

- No figure is published for the number of people affected by the welfare
  changes, or for how many get each of the three PIP replacements.
- Health and disability claimants: "Number of 16 to 19 year old claimants
  (212k) plus number of 20 to 24 year old claimants (196k), divided by total
  number of claimants aged 16 to 65 (3,108k)", the "13% of total working age
  claimants" (footnote to para 790, interim report Table 53b).
- "over 900,000 receiving Child DLA"; "About 77% of Child DLA claimants
  graduate onto PIP by the age of 17" (para 759).
- "the estimated 314,000 hidden NEETs in England who are not in the benefit
  system at all" (para 275); the costings assume 46% of NEET young people are
  not claiming benefits (annex s.1).
- "A backlog of over 2 million people awaiting reassessments in UC" (para 768).

### Employment, incomes and poverty

- The review's behavioural assumption for UC health claimants is "An
  additional employment impact of 9%" (annex s.1). That is the benchmark for
  our illustrative move into work (`ENTRY_SHARE = 0.25` at 16 hours), which is
  far larger.

- "around 440,000 young people into sustained work by 2036" (paras 111, 739),
  which is also the poverty model's assumption, including "sustained employment
  effects beyond age 24" (annex s.8). The annex's NEET section gives "around
  400,000 more 16 to 24 year olds in work" and "around 500,000 more ... in
  employment and education", rounded to the nearest 100,000 (annex s.2).
- NEET rate (ODS sheet `3`, "Table 3: Total NEET rate impact profile, UK,
  2026/27 to 2036/27", percentages):

| | 2026-27 | 2027-28 | 2028-29 | 2029-30 | 2030-31 | 2031-32 | 2032-33 | 2033-34 | 2034-35 | 2035-36 | 2036-37 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Baseline | 13.1 | 12.7 | 12.7 | 12.7 | 12.8 | 12.9 | 13.0 | 13.1 | 13.2 | 13.3 | 13.4 |
| With recommendations | 13.1 | 12.4 | 11.8 | 11.0 | 10.1 | 9.2 | 8.4 | 7.8 | 7.3 | 7.0 | 6.8 |

- "the net incomes of young people are expected to rise by over £2 billion and
  relative poverty after housing costs is estimated to fall by 50,000" (para
  739). The income figure is net earnings from the moves into work less the
  welfare savings and fiscal offsets (annex s.7). The poverty figure is for the
  package with employment effects, a "steady-state position", rounded to the
  nearest 50,000, from a static model to 2030-31 (annex s.8). Neither is a
  static distributional result for the benefit changes alone, so our static
  runs will show losses where the review shows a gain.
- GDP: "approximately 0.4% of GDP per year" by 2036 (para 940).
- ODS sheet `1`, "Table 1: Average annual investment in major NEET schemes, UK,
  2026 prices": Youth Training Scheme £3.5bn, New Deal for Young People £1.3bn,
  Youth Guarantee £0.6bn.

### Method notes to carry with any comparison

- Health and disability savings: a flow model of "forecasts of flows into
  health and disability benefits", stocks "projected forward ... using
  assumptions on inflows, outflows and ageing", applied to "both existing and
  future claimants" (annex s.1).
- Living independently: "there is no direct information on whether young people
  on UC live with their parents but the receipt of a housing element has been
  used as a proxy" (annex s.1).
- Fiscal offsets exclude the direct welfare savings but include "increased tax
  revenue resulting from the increased employment caused by welfare changes";
  PIP-only claimants are treated as non-benefit cases (annex s.3).
- "The figures do not capture any upstream impacts arising from education or
  health policies" (annex s.1).
