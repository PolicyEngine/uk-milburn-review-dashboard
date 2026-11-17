"""The Milburn review design choices, in one place. Constants and text
helpers only: no modifier lives here.

Two groups, on purpose.

1. THE 15 NOVEMBER DESIGNS (``START_YEAR`` ... ``ENTRY_HOURS``). The
   measures run on 15 November 2026 (``milburn_package``, its parts and
   variants) read these as their defaults. DO NOT EDIT THEM: the run folders
   under ``public/data/milburn/`` carry no record of the code behind them
   (``model_build.json`` has no commit or definition hash), so a change
   here would silently redefine runs that stay on the page, the upper bound
   among them. ``tests/test_milburn_design.py`` pins every value.

2. THE REPORT'S DESIGN (``REPORT_*``). Edit these once the final report is
   out (17 November 2026). Only the ``milburn_report_*`` measures read them
   (``budget_measures/milburn_report.py``, reserved ids in ``reforms.py``),
   at call time, and their names and descriptions are written from them.
   Tonight they equal the 15 November designs, so ``milburn_report_package``
   is ``milburn_package`` until a constant changes.

Year Y is fiscal year Y-(Y+1). The modifiers work in whole fiscal years.
"""

# ---------------------------------------------------------------------------
# 1. The 15 November designs. Do not edit (see the module docstring).
# ---------------------------------------------------------------------------

START_YEAR = 2027
START_MONTH = 4  # April; text only, a fiscal year starts in April
# The engine stores uc_LCWRA_element as an input to 2032-33
# (policyengine_uk.scenarios.uc_reform); the UC modifiers rewrite it to there.
UC_ELEMENT_LAST_YEAR = 2032
LAST_POLICY_YEAR = 2031

# UC health (LCWRA) element: removed where no claimant with LCWRA is aged
# UC_HEALTH_UPPER_AGE or over. A claimant under UC_HEALTH_LOWER_AGE keeps
# it (0: nobody is spared for being too young).
UC_HEALTH_LOWER_AGE = 0
UC_HEALTH_UPPER_AGE = 25
# Severe-case proxy: PIP daily living points at or above which a young
# claimant keeps the element, in the runs that spare severe cases.
SEVERE_DL_POINTS = 24

# PIP: removed for ages PIP_LOWER_AGE to PIP_UPPER_AGE - 1.
PIP_LOWER_AGE = 18
PIP_UPPER_AGE = 25
PIP_INCLUDE_SCOTLAND = True  # Scottish ADP, held in the data as PIP
PIP_REPLACEMENT_SHARE = 0.0  # share of the award still paid (0: removed)
PIP_HALVED_SHARE = 0.5  # the "central" stand-in for a replacement

# Natural migration (the phased runs): the share of the remaining stock
# reassessed each year, the year before the first one (new entrants are
# those who reached NEW_ENTRANT_AGE after April of it), and that age.
REASSESSED_EACH_YEAR = 0.25
COHORT_START_YEAR = 2026
NEW_ENTRANT_AGE = 18

# Illustrative move into work.
ENTRY_SHARE = 0.25
ENTRY_HOURS = 16

# ---------------------------------------------------------------------------
# 2. The report's design. EDIT THESE on report day, then run the
#    milburn_report_* ids (docs/milburn-local-run.md, "Report day").
# ---------------------------------------------------------------------------

REPORT_START_YEAR = 2027  # first fiscal year the new rules apply in full
REPORT_START_MONTH = 4  # must be 4: a mid-year start is not modelled

REPORT_UC_HEALTH_LOWER_AGE = 0  # e.g. 18 if 16 and 17-year-olds keep it
REPORT_UC_HEALTH_UPPER_AGE = 25  # e.g. 22 for "under 22"
REPORT_UC_HEALTH_SEVERE_KEPT = False  # True: the points proxy below spares
REPORT_SEVERE_DL_POINTS = 24

REPORT_PIP_LOWER_AGE = 18  # 16 for a 16 to 24 band
REPORT_PIP_UPPER_AGE = 25
REPORT_PIP_INCLUDE_SCOTLAND = True  # False: Scottish ADP records untouched
REPORT_PIP_REPLACEMENT_SHARE = 0.0  # 0.5: half the award kept as a stand-in
# A tiered replacement: the share of each PIP component kept at each award
# level. None: the uniform REPORT_PIP_REPLACEMENT_SHARE above applies. When
# set it replaces the uniform share in milburn_report_pip and the report
# packages, and needs exactly the four keys below, e.g. enhanced awards
# kept in full ("enduring severe needs") and standard awards removed:
# {"daily_living_enhanced": 1.0, "daily_living_standard": 0.0,
#  "mobility_enhanced": 1.0, "mobility_standard": 0.0}
# A share above 1 pays more than the current award. Like the uniform
# share, it scales the PIP amounts, so entitlements that depend on
# receiving a component stay with any share above 0 and go at 0.
REPORT_PIP_REPLACEMENT_SHARES = None
# What the report calls the replacement, lower case, e.g. "additional cost
# allowance". Text only: when set with a share above (uniform or tiered),
# milburn_report_pip is named "PIP replaced by an additional cost allowance
# for ..." and its description says the shares stand in for it. Its real
# rates and eligibility are not modelled; the shares are the stand-in.
REPORT_PIP_REPLACEMENT_NAME = None
REPORT_PIP_SHARE_KEYS = (
    "daily_living_enhanced",
    "daily_living_standard",
    "mobility_enhanced",
    "mobility_standard",
)

REPORT_REASSESSED_EACH_YEAR = 0.25  # 0: transitional protection (new
#                                     entrants only)
REPORT_NEW_ENTRANT_AGE = 18

# Youth allowance. None: at the under-25 UC rate, which changes no award,
# so there is nothing to run. Otherwise monthly amounts for EVERY year from
# REPORT_START_YEAR to 2031 (they are uprated; a gap returns to current
# law), as {year: (single under 25, couple both under 25)}, e.g.
# {2027: (400.0, 630.0), 2028: (408.0, 642.6), ...}.
REPORT_YOUTH_ALLOWANCE_MONTHLY = None

# Employer National Insurance for young employees. None: not run (the
# 15 November comparator employer_nics_zero_under_25 is the zero rate).
# Otherwise the employer rate on earnings between the secondary threshold
# and the upper secondary threshold (£50,270 a year) for employees under
# REPORT_EMPLOYER_NICS_AGE_LIMIT, e.g. 0.075 against the main 15%. Under-21s
# and apprentices under 25 keep their zero rate. When set,
# milburn_report_employer_nics exists and joins milburn_report_package.
REPORT_EMPLOYER_NICS_UNDER_25_RATE = None
REPORT_EMPLOYER_NICS_AGE_LIMIT = 25

_MONTHS = (
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
)


def start_text(year=START_YEAR, month=START_MONTH):
    """'From April 2027'."""
    return f"From {_MONTHS[month - 1]} {year}"


def start_date_text(year=START_YEAR, month=START_MONTH):
    """'April 2027'."""
    return f"{_MONTHS[month - 1]} {year}"


def fiscal_year_text(year):
    """'2027-28'."""
    return f"{year}-{(year + 1) % 100:02d}"


def age_band_text(lowest_age=PIP_LOWER_AGE, age_limit=PIP_UPPER_AGE):
    """'18 to 24' for ages 18 up to but not including 25."""
    return f"{lowest_age} to {age_limit - 1}"


def age_band_people_text(lowest_age=PIP_LOWER_AGE, age_limit=PIP_UPPER_AGE):
    """'18 to 24-year-olds'."""
    return f"{age_band_text(lowest_age, age_limit)}-year-olds"


def under_text(age_limit=UC_HEALTH_UPPER_AGE):
    """'under-25s'."""
    return f"under-{age_limit}s"


def percent_text(share):
    """'25%'."""
    return f"{round(share * 100):.0f}%"


def rate_text(rate):
    """'7.5%' (percent_text rounds to a whole number)."""
    return f"{rate * 100:.10g}%"


def check_report_design():
    """Refuse a report design the modifiers cannot run as written."""
    problems = []
    if REPORT_START_MONTH != 4:
        problems.append(
            "REPORT_START_MONTH must be 4: the modifiers work in whole "
            "fiscal years. For a mid-year start set REPORT_START_YEAR to "
            "the first full year and say so in the text."
        )
    if not START_YEAR <= REPORT_START_YEAR <= LAST_POLICY_YEAR:
        problems.append(
            f"REPORT_START_YEAR must be {START_YEAR} to {LAST_POLICY_YEAR}."
        )
    if not REPORT_UC_HEALTH_LOWER_AGE < REPORT_UC_HEALTH_UPPER_AGE:
        problems.append("REPORT_UC_HEALTH ages: lower must be below upper.")
    if not REPORT_PIP_LOWER_AGE < REPORT_PIP_UPPER_AGE:
        problems.append("REPORT_PIP ages: lower must be below upper.")
    if not 0 <= REPORT_PIP_REPLACEMENT_SHARE < 1:
        problems.append("REPORT_PIP_REPLACEMENT_SHARE must be in [0, 1).")
    shares = REPORT_PIP_REPLACEMENT_SHARES
    if shares is not None and (
        not isinstance(shares, dict)
        or set(shares) != set(REPORT_PIP_SHARE_KEYS)
        or not all(
            isinstance(share, (int, float))
            and not isinstance(share, bool)
            and share >= 0
            for share in shares.values()
        )
    ):
        problems.append(
            "REPORT_PIP_REPLACEMENT_SHARES must be None or give a share of "
            "0 or more for exactly: " + ", ".join(REPORT_PIP_SHARE_KEYS) + "."
        )
    label = REPORT_PIP_REPLACEMENT_NAME
    if label is not None and not (isinstance(label, str) and label.strip()):
        problems.append(
            "REPORT_PIP_REPLACEMENT_NAME must be None or a name, e.g. "
            "'additional cost allowance'."
        )
    rate = REPORT_EMPLOYER_NICS_UNDER_25_RATE
    if rate is not None and (
        isinstance(rate, bool)
        or not isinstance(rate, (int, float))
        or not 0 <= rate < 1
    ):
        problems.append(
            "REPORT_EMPLOYER_NICS_UNDER_25_RATE must be None or a rate in "
            "[0, 1), e.g. 0.075 for 7.5%."
        )
    if (
        type(REPORT_EMPLOYER_NICS_AGE_LIMIT) is not int
        or REPORT_EMPLOYER_NICS_AGE_LIMIT <= 21
    ):
        problems.append(
            "REPORT_EMPLOYER_NICS_AGE_LIMIT must be a whole age above 21 "
            "(under-21s already have the zero rate)."
        )
    if not 0 <= REPORT_REASSESSED_EACH_YEAR <= 1:
        problems.append("REPORT_REASSESSED_EACH_YEAR must be in [0, 1].")
    if REPORT_YOUTH_ALLOWANCE_MONTHLY is not None:
        wanted = set(range(REPORT_START_YEAR, LAST_POLICY_YEAR + 1))
        if set(REPORT_YOUTH_ALLOWANCE_MONTHLY) != wanted:
            problems.append(
                "REPORT_YOUTH_ALLOWANCE_MONTHLY must give every year "
                f"{min(wanted)} to {max(wanted)} and no other."
            )
    if problems:
        raise ValueError("Milburn report design: " + " ".join(problems))
