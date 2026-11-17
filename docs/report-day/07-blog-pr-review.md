# 07. Review of the blog PR (policyengine-app-v2 #1586)

Draft review of `app/src/data/posts/articles/uk-milburn-review-briefing.md` on
branch `milburn-review-blog-draft`, by juaristi22. Not posted. Line numbers are
lines of the new file (RIGHT side).

Sources checked: the report, annex and data tables as published on 17 November
2026; `public/data/milburn_summary.json` (year 2029), the per-run CSVs in
`public/data/milburn/<id>/`, `milburn_benchmarks.json` (working tree),
`milburn_review_figures.json`; `src/components/MethodologyTab.jsx` and the
modifiers in `src/uk_budget_data/budget_measures/`. All dashboard figures are
build fcfac709, policyengine-uk 2.177.7, certified in policyengine 6.20.2.

## (a) Overall review body

Thanks, Maria. I checked every quoted passage, paragraph number and figure against the published report, annex and data tables; all but a handful match, and the fixes are inline. The dashboard's runs of the review's design are final for 2029-30 (Microcosm UK build fcfac709, policyengine 6.20.2), so each `[F…]` placeholder below has a value with its run id and field.

Three points change the text as well as the numbers:

1. **The work allowance is not modelled.** The Youth Allowance run covers the higher rate only, and the package run is the UC health element and PIP only. F6, F18 and the work-allowance assumption have no run, and F7r/F8r come from the separate higher-rate run.
2. **"Most".** Paragraph 745 says "most people aged under 25" about the order in which the system works; the sentence that abolishes the health element carries no such limit. Lines 2, 12, 44, 166 and 248 should drop it.
3. **The package saves less than the two changes added up** (£4.67 billion against £4.77 billion). The example mechanism on line 108 points the other way.

On the bracketed choices I suggest following the dashboard: 2029-30 as the headline year, with the changes in force from April 2029; no stand-in for the PIP replacements, with the result described as the upper end; Scottish Adult Disability Payment included, as in the review's UK-wide costing; the employer National Insurance change as an illustration of the £10,000 end state, outside the package; and the phased path at an assumed 45% a year, labelled as ours.

Still without a published figure: F4a/F4b, the share of under-25 awards with a housing costs element, the 2029-30 allowance amounts and the household examples. On style, the draft is neutral and reads as PolicyEngine prose: active voice, sentence case, British English, no advocacy, and the difference in sign from the review's poverty estimate is explained. `posts.json` needs an `image`; both author slugs exist.

## (b) Inline comments

Each item is `{line, body}`. A suggestion block replaces the whole of that line.

### Line 2

"Most claimants" isn't what paragraph 745 says. Its "For most people aged under 25" belongs to the sentence about the order in which the system works; the next sentence abolishes the assessment and the health element without that limit, and paragraph 737 says "the health element of Universal Credit is gone". Same point on lines 12, 44, 166 and 248.

```suggestion
- **Universal Credit (UC).** For claimants under 25, the review proposes a Youth Allowance paid at today's under-25 standard allowance, with a higher rate for those living independently. It also proposes an end to the UC health element and the Work Capability Assessment for that age group (paragraphs 744 to 748).
```

### Line 8

Consistent with the dashboard: static, changes in force from April 2029, year 2029-30. Suggest naming the start month once here so "fully in force" has a date.

```suggestion
Our estimates, from PolicyEngine's static microsimulation, with the changes fully in force from April 2029, for 2029-30, and employment held fixed:
```

### Line 10

F3 = 1.13 (`milburn_report_uc_health`, `saving_bn.2029` = 1.128). F4 = 3.64 (`milburn_report_pip`, `saving_bn.2029` = 3.643).

```suggestion
- **The two changes on their own.** Ending the UC health element for claimants under 25 saves £1.13 billion. Ending PIP for 18 to 24-year-olds, with the entitlements that follow it, saves £3.64 billion.
```

### Line 11

F1 = 4.67 (`milburn_report_package`, `saving_bn.2029` = 4.666). That is £0.10 billion less than the two added up (1.128 + 3.643 = 4.771). The bracketed clause needs a mechanism read from the run (see line 108). Until then, state the size of the difference only:

```suggestion
- **The two together.** Together they save £4.67 billion, £0.10 billion less than the two added up.
```

### Line 12

Two points. (1) Drop the "most" sentence (see line 2). (2) "Upper end" matches the dashboard's "upper bound", and the reason is the missing replacements; keep that as the single reason.

```suggestion
- **Why this is the upper end.** We leave out the replacement awards, for which the review gives no rates. With employment held fixed, this makes our figure the upper end of the saving from these two changes. The review's assumed rise in employment would add to a saving, and we don't model it.
```

### Line 13

The dashboard models the higher rate only: the work allowance is listed as not modelled, because the review gives no amount. F5 = 0.13 (`milburn_report_youth_allowance_independent`, `saving_bn.2029` = −0.131). F6 has no run: no simulation combines the higher rate with the two removals, and 4.67 − 0.13 would add figures from separate runs that interact.

```suggestion
- **The Youth Allowance.** Its higher rate for young people living independently costs £0.13 billion. The figure comes from a separate run, and the package above doesn't include it. We don't model the new work allowance, for which the review gives no amount.
```

### Line 14

F7 = 580,000 and F7% = 7.8% (`milburn_report_package`: `young_people_in_losing_households` = 580,365; `share_of_16_24_in_losing_households_pct` = 7.75). F8 = £13,000 (`average_loss_young_person_in_losing_household` = 12,962; a household figure, not equivalised). No one gains in the package run (`age_impact.csv`, 16-24, `pct_better_off` = 0). F7r, F7r% and F8r come from the separate higher-rate run, where the same summary fields hold gainers because its direction is "gain": 159,000 (158,959), 2.1% (2.12) and £1,090 (1,093).

```suggestion
- **Incomes, with no replacement awards.** 580,000 people aged 16 to 24, 7.8% of that age group, live in households whose net income falls, by £13,000 a year on average. In the separate run of the higher rate, 159,000 people aged 16 to 24, 2.1%, live in households whose net income rises, by £1,090 a year on average.
```

### Line 15

The dashboard shows absolute poverty after housing costs first, and publishes headcounts only for the two after-housing-costs measures. Suggest matching it. Values from `milburn_report_package`, 2029: absolute AHC +0.56 points (`poverty_change_pp.abs_ahc` = 0.559), 391,000 people (`people_into_poverty_abs_ahc` = 390,685), children +0.96 points (`metrics.csv`, `child_poverty_abs_ahc_change_pp` = 0.962). If you keep before housing costs: F9 = 0.49 (`abs_bhc` = 0.490), F10 = 0.72 (`child_poverty_abs_bhc_change_pp` = 0.715), and F9n has no published field (0.490% of 69.8 million people is about 342,000, derived). For the "because": 1.7% of under-16s live in a household whose net income falls (`age_impact.csv`, 0-15, `pct_worse_off` = 1.74), and the measure counts every child in a household that crosses the line.

```suggestion
- **Poverty, with no replacement awards.** Absolute poverty after housing costs rises by 0.56 percentage points (391,000 people), and absolute child poverty by 0.96 points, because 1.7% of children under 16 live in a household whose net income falls.
```

### Line 16

F11 = 260,000 (`milburn_report_package`, `people_into_poverty_rel_ahc` = 260,130; +0.37 points).

```suggestion
- **The review's poverty measure.** On relative poverty after housing costs, our static estimate is a rise of 260,000 people (0.37 percentage points) in 2029-30.
```

### Line 24

Accurate against annex section 8 and paragraphs 111 and 739. Suggest adding "by 2036" to the 440,000, as the review dates it, so readers don't set it beside our 2029-30 figures.

```suggestion
- **Poverty.** Relative poverty after housing costs falls by 50,000 once its measures are fully in place. That estimate includes the replacement awards, the Health and Disability Fund, the Youth Allowance and the work allowance, and 440,000 more young people in work by 2036.
```

### Line 26

"These figures" follows the review's estimates, so it reads as describing them. It describes ours. Suggest moving it up to follow line 18, or:

```suggestion
Our figures cover the proposals in Table 1, modelled as described below, and none of the review's other proposals.
```

### Line 42

Quote and paragraphs check out (the report's text has a stray "living" after "estrangement"; ending the quote before it is right). The model column should say which awards: the dashboard pays the 25-and-over rate where every claimant on the award is under 25 and the award includes a housing costs element.

```suggestion
| Youth Allowance | A means-tested allowance at today's UC standard allowance for under-25s, which the review gives as £339 a month (paragraph 744). It is higher for young people living independently, "including care leavers and those who have experienced family estrangement" (paragraph 748) | UC claimants under 25 | The 25-and-over standard allowance for awards in which every claimant is under 25 and which include a housing costs element, the marker the review's annex uses (section 8) |
```

### Line 43

The dashboard doesn't model the work allowance, so there is no assumed level to state. With that, the row no longer belongs in a table titled "The proposals we model": either move it to the list below (line 50 onwards) or keep it here with the cell below.

```suggestion
| Work allowance | Every Youth Allowance recipient in work can earn an amount before their award starts to fall. Today a young claimant without children or limited capability for work has no work allowance (paragraph 749) | UC claimants under 25 in work | Not modelled: the review gives no amount |
```

### Line 44

Drop "Most" (see line 2). The model column matches the modifier: the element goes unless a claimant with limited capability for work and work-related activity is 25 or over.

```suggestion
| UC health element | The health element and the Work Capability Assessment end, with no new test of capability for work in their place (paragraphs 744 and 745) | UC claimants under 25 | The end of the health element for every claimant under 25 |
```

### Line 46

Keep the row, as the dashboard runs it (`milburn_report_employer_nics_threshold`). Paragraph 269 gives the five years and paragraph 270 the thresholds and the quote; the cite is right.

```suggestion
| Employer National Insurance | For employees aged 21 to 24 in retail and hospitality, the secondary threshold rises from £5,000 to £10,000 over five years, "when fiscal conditions allow" (paragraphs 269 to 271) | Employers in retail and hospitality | An illustration at the full £10,000 threshold, outside the package. We read retail as Standard Industrial Classification division 47 and hospitality as divisions 55 and 56 |
```

### Line 52

The statement that the Guarantees must come first is in paragraph 769 ("support and opportunity will need to be put in place before benefits change"), not in 675 to 705.

```suggestion
- **Opportunity and Support Guarantees.** A statutory entitlement for every 18 to 24-year-old to a place in education, training or work, and to employment, health and wider support, delivered by a Youth Opportunity Service in each area of England (paragraphs 675 to 705). The review says these must be in place before the benefit changes (paragraph 769).
```

### Line 56

The report says "£50 a week for 6 months", not "up to" (paragraph 71). Paragraph 71 makes it conditional on agreeing a participation plan; the "agreed education, employment, training or other progression activity" wording is in chapter 4.

```suggestion
- **Care Leaver Transition Allowance.** £50 a week for six months for care leavers who are NEET or "at serious risk" of becoming NEET, conditional on agreeing a participation plan with their Youth Opportunity Service (paragraph 71).
```

### Line 87

The annex's list for the health line (section 1, "Gross costs of the 'health' policy area", £700 million, England only):

```suggestion
  - Health (England) covers a mental health package (Individual Placement and Support for young people, Early Support Hubs, Mental Health Support Teams and a national digital offer), a Vocational Rehabilitation Service, fit note reform and funding for integrated care boards.
```

### Line 95

The package run is the two removals only. Suggest resolving the bracket as:

```suggestion
We run the UC health element and PIP changes together as one package, in a single simulation for each year, with both fully in force from April 2029 and employment held fixed. The package doesn't include the Youth Allowance's higher rate, which Table 3 shows separately.
```

### Line 103

F1 = 4,666; the two `[F2]` cells are different years and need different values: 4,784 and 4,889 (`milburn_report_package`, `budgetary_impact.csv`, 2029 to 2031).

```suggestion
| The package: UC health element and PIP | 4,666 | 4,784 | 4,889 |
```

### Line 104

`milburn_report_uc_health`, `budgetary_impact.csv`. The later years are published, so the row can be filled.

```suggestion
| UC health element, on its own | 1,128 | 1,157 | 1,177 |
```

### Line 105

`milburn_report_pip`, `budgetary_impact.csv`.

```suggestion
| PIP, on its own | 3,643 | 3,733 | 3,816 |
```

### Line 106

`milburn_report_youth_allowance_independent`, `budgetary_impact.csv`. Higher rate only; no work allowance.

```suggestion
| Youth Allowance higher rate, on its own | −131 | −132 | −130 |
```

### Line 108

The package (4,666) is £105 million less than the two rows added up (4,771). The example given, a benefit cap exemption that ends only when both awards do, would make the package larger than the sum, so it can't be the explanation. Please read the mechanism from the run before stating one. What the dashboard does state: about nine in ten young claimants with the health element in the data also receive PIP. Also add that the Youth Allowance row is not part of the package and the rows don't sum.

### Line 112

Values for the prose (`milburn_report_package`, 2029; £ from `winners_losers.csv` `avg_change`, % from `distributional_impact.csv` `value`): net income falls in every decile. Lowest income decile −£85 (−0.34%); highest income decile −£62 (−0.04%). The falls are largest in the third decile (−£333, −0.74%) and the seventh (−£367, −0.54%). The pattern isn't monotonic, and the mechanism on line 114 (PIP is not means-tested) covers the upper deciles. No one gains in this run, so the line 115 point applies only to falls: the Carer's Allowance case is the one to name.

### Line 117

No chart yet. Until it is added, delete this line: the finished post shouldn't say what will be added later.

### Line 123

F12 for lines 123 to 133 (`milburn_report_package`, `winners_losers.csv`, 2029, `avg_change`, £ a year): 1: −85; 2: −72; 3: −333; 4: −183; 5: −179; 6: −159; 7: −367; 8: −88; 9: −82; 10: −62; All: −159. Line 112 asks for % as well; a second column from `distributional_impact.csv` would be: −0.34, −0.17, −0.74, −0.37, −0.33, −0.26, −0.54, −0.12, −0.09, −0.04.

```suggestion
| 1 (lowest) | −85 |
```

### Line 140

Same values as line 14. "Households holding" reads oddly; "live in households" matches the summary bullet.

```suggestion
- **Net income falls** for 580,000 people aged 16 to 24 (7.8% of that age group), who live in households that lose £13,000 a year on average.
```

### Line 141

There are no gainers in the package run. These figures come from the separate higher-rate run (`milburn_report_youth_allowance_independent`: 158,959; 2.12%; £1,093), with no work allowance.

```suggestion
- **Net income rises**, in the separate run of the Youth Allowance's higher rate, for 159,000 people aged 16 to 24 (2.1%), who live in households that gain £1,090 a year on average.
```

### Line 142

F13f = 2.0 (`milburn_report_package`, `everyone_in_losing_households_pct` = 2.02). F13r is 0 in the package run.

```suggestion
- **Across all people,** 2.0% live in households whose net income falls under the package, and none in households whose net income rises.
```

### Line 150

If the post follows the dashboard and leads with absolute poverty after housing costs (see line 15): 0.56 points, 391,000 people, children 0.96 points. If it stays before housing costs: 0.49, about 342,000 (derived, no published field) and 0.72.

```suggestion
| Absolute poverty, after housing costs | 0.56 | 391,000 | 0.96 |
```

### Line 151

`milburn_report_package`, 2029: F11p = 0.37 (`poverty_change_pp.rel_ahc` = 0.373), F11 = 260,000 (260,130), F11c = 0.64 (`child_poverty_change_pp_rel_ahc` = 0.635).

```suggestion
| Relative poverty, after housing costs | 0.37 | 260,000 | 0.64 |
```

### Line 153

Fill the mechanism as on line 15, and say where it comes from.

```suggestion
Both rows come from our static run, with no replacement awards and employment held fixed. Child poverty rises because 1.7% of children under 16 live in a household whose net income falls.
```

### Line 162

The package run includes none of them.

```suggestion
Ours includes none of these and holds employment fixed. The two estimates also cover different years. The review doesn't publish how much of its figure comes from each part, so we can't say how much of the difference in sign each one accounts for.
```

### Line 166

Drop "for most claimants" and the contrast that follows (see line 2). The bracketed amounts: the dashboard's Methodology gives monthly rates of £442.10, and £217.26 for claims from April 2026; the 2029-30 amounts aren't in the published data and need reading from the model.

### Line 171

The suspension of the duty to engage is paragraph 716 ("They should be suspended during serious acute illness or treatment, or crisis situations").

```suggestion
- **What we don't model.** The review proposes that during serious illness, injury or intensive treatment young people "should be able to pause support", with financial help from the local fund where longer-term needs are not yet known (paragraph 746). It also proposes that the duty to engage is suspended during serious acute illness or treatment (paragraph 716). We model neither.
```

### Line 173

Retitle: the section covers a work allowance the dashboard doesn't model.

```suggestion
**Youth Allowance.** The review proposes that the Youth Allowance pays what the UC standard allowance pays today, except for young people living independently, and that it comes with a work allowance.
```

### Line 174

`[F-share]` has no published field in the dashboard data; it needs a model read, or the sentence can go. The rest matches the dashboard (annex section 8 proxy; awards in which every claimant is under 25).

### Line 175

The 2026-27 amounts match the model (£338.58 and £424.90, £86.32 apart). The 2029-30 amounts aren't in the published data.

### Line 176

No run: the dashboard lists the work allowance as not modelled, so there is no assumption and no F18.

```suggestion
- **The work allowance.** The review gives no amount, so we don't model it. It says many young people who are NEET could work "10 or 15 hours a week initially" (paragraph 749).
```

### Line 178

```suggestion
- **The cost.** The higher rate costs £0.13 billion in 2029-30.
```

### Line 186

Consistent with the dashboard. If you want a stand-in for the Additional Cost Allowance, the dashboard has a comparator with PIP at half rate (`pip_halved_under_25`, £1.82 billion in 2029-30), but it applies from April 2027 and is ours, not the review's. I'd leave it out of the post and keep the single upper-end result.

### Line 192

F4b has no published field: no run separates PIP itself from the entitlements that follow it. Either run PIP with the follow-on entitlements kept, or drop the last two sentences here and the split on lines 193 and 249.

### Line 193

```suggestion
- **The saving.** £3.64 billion in 2029-30, including the entitlements that follow PIP.
```

### Line 194

The dashboard includes them (`REPORT_PIP_INCLUDE_SCOTLAND = True`; Methodology, "Geography" and "PIP in Scotland").

```suggestion
- **Scotland.** Scottish recipients of Adult Disability Payment, which the data record as PIP, are included. The review's costing covers PIP and UC across the UK, while Adult Disability Payment is the Scottish Government's. Including them keeps our figure on the same UK-wide basis as the review's.
```

### Line 199

Paragraph 270, which says "at current minimum wage rates". Suggest adding the cite.

```suggestion
- **The rationale.** At £10,000, the review notes, an employer could employ a 21-year-old for 15 hours a week at current minimum wage rates without paying employer National Insurance (paragraph 270).
```

### Line 200

Paragraph 273 says the reliefs "need to be retained"; the description of them (under 21, apprentices under 25, up to £50,270) is in paragraph 267.

```suggestion
- **What's not given, and what stays.** It gives no start date and no costing. It keeps today's reliefs for employees under 21 and apprentices under 25 (paragraphs 267 and 273).
```

### Line 201

F15 = 221 (`milburn_report_employer_nics_threshold`, `saving_bn.2029` = −0.221). The run shows the end state in every year (it also costs £0.22 billion in 2027-28 and 2028-29), so it isn't tied to April 2029. The stepped path is now published too (`milburn_report_employer_nics_threshold_glide_path`, assumed equal steps from £6,000 in 2027-28 to £10,000 in 2031-32, our assumption): £46 million, £91 million, £135 million, £179 million and £213 million from 2027-28 to 2031-32. I'd quote the end state and mention the path in one clause, since the review gives no steps or start date.

```suggestion
- **Our illustration.** We model the full £10,000 threshold, reading retail as Standard Industrial Classification division 47 and hospitality as divisions 55 and 56, and estimate a static cost of £221 million in 2029-30. The review gives no steps or start date. On assumed equal steps from £6,000 in 2027-28, the cost is £135 million in 2029-30 and £213 million in 2031-32.
```

### Line 206

Table 6 from `milburn_report_package_phased`, `budgetary_impact.csv` (£ million): 2029-30: 2,766; 2030-31: 4,011; 2031-32: 4,563, against 4,666, 4,784 and 4,889 fully in force. The rule in the run differs from the bracket: people turning 18 move at once, not every new claimant, and an assumed 45% of the remaining claimants move each year (about 95% within five years). The 45% is our assumption; the review says only "no more than 5 years" (paragraph 773).

### Line 216

```suggestion
| Welfare saving | £3.6 billion in 2036-37, 2026-27 prices. Net of the replacement awards, the Youth Allowance and the work allowance, with an assumed rise in employment (annex, section 1) | £4.67 billion in 2029-30, cash, static, with no replacement awards, without the Youth Allowance higher rate and work allowance |
```

### Line 217

F4a has no published field. The dashboard's comparable figure is the static saving, £3.64 billion (`milburn_report_pip`), which includes the entitlements that follow PIP; label it as a saving, not spending.

```suggestion
| PIP spending | £3.8 billion on 16 to 24-year-olds in 2025-26 (footnote to paragraph 114) | £3.64 billion static saving from ending PIP for 18 to 24-year-olds in 2029-30, including the entitlements that follow it |
```

### Line 218

The unnamed placeholder: £1.13 billion (`milburn_report_uc_health`, `saving_bn.2029`), again a saving.

```suggestion
| UC health element spending | £0.92 billion on 16 to 24-year-olds in 2025-26 (footnote to paragraph 114) | £1.13 billion static saving from ending the element on awards where the claimant with the condition is under 25, in 2029-30 |
```

### Line 219

`[F17]` appears here and on line 220 for two different counts. The dashboard's benchmark is 232,000 benefit units with the element in which every adult is under 25 (`milburn_benchmarks.json`, `uc_health_element_16_24`), on the 2027-28 baseline caseload. That is not the same basis as this cell's wording and not 2029-30; either use it with that label or re-derive.

### Line 220

347,000 PIP recipients aged 18 to 24 (`milburn_benchmarks.json`, `young_pip_recipients`), 2027-28 baseline caseload, not 2029-30.

### Line 221

```suggestion
| Relative poverty after housing costs | Falls by 50,000 once fully in place. Includes the replacement awards, the Health and Disability Fund, the Youth Allowance and work allowance, and 440,000 more young people in work (annex, section 8) | Rises by 260,000 in 2029-30, static, with no replacement awards |
```

### Line 227

Accurate (annex section 8: Family Resources Survey for 2022/23 to 2024/25, results to 2030/31). The annex also says the model is consistent with the OBR's March 2026 forecasts, which is worth adding beside our own forecast vintage on line 259.

### Line 231

```suggestion
- **Scotland.** Both cover the UK. Ours counts Scottish Adult Disability Payment as PIP.
```

### Line 240

The third example depends on the work allowance, which isn't modelled. Suggest showing the higher rate only: a 23-year-old renting, with a housing costs element, at 0, 16 and 25 hours. The dashboard's published data don't include these household calculations, so all three need running at the same build.

### Line 248

Delete this bullet (see line 2).

### Line 252

Replace with the limit that applies:

```suggestion
- don't model the work allowance, for which the review gives no amount;
```

### Line 253

Confirmed by the dashboard's Methodology ("New-claimant health element rate"); keep without the brackets.

```suggestion
- give the health element's lower rate for claims from April 2026 to a random share of awards, as the data hold no claim dates;
```

### Line 254

```suggestion
- treat Scottish Adult Disability Payment as PIP;
```

### Line 262

Add the phasing assumption here, since it is ours.

```suggestion
- **Fully in force.** Except in the phased path, every eligible young person is on the new rules from April 2029. The phased path moves people turning 18 at once and an assumed 45% of the remaining claimants each year.
```

### Line 264

Please check this against the dashboard: its age results withhold any group with fewer than 100 survey records (`MIN_SAMPLE_SIZE`), and I couldn't find a three-household floor stated in its Methodology. No cell used in this post is withheld.
