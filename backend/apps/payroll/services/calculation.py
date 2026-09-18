"""Hours x hourly rate for one staff member."""

from datetime import timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError

from apps.attendance.services.hours import hours_worked

from .. import models

# The first WEEKLY_RATE_1_HOUR_CAP hours of EACH week of a pay period are
# paid at rate 1; anything past that, at rate 2 - reset at the start of the
# second week rather than carried over as one 80-hour period-wide bucket. A
# pay period is always exactly two 7-day weeks (see
# apps.payroll.services.pay_periods's module docstring), so a staff member
# who works 30 hours in week one and 25 in week two is paid 20+20=40 hours
# at rate 1 and 10+5=15 at rate 2 - not 40 at rate 1 and 15 at rate 2 picked
# from wherever in the period they happened to fall.
WEEKLY_RATE_1_HOUR_CAP = Decimal("20")


def _weekly_hours(*, staff, pay_period) -> tuple[Decimal, Decimal]:
    """Hours worked in each 7-day half of the pay period."""
    week_1_ends = pay_period.starts_on + timedelta(days=6)
    week_2_starts = week_1_ends + timedelta(days=1)

    week_1 = hours_worked(staff=staff, start=pay_period.starts_on, end=week_1_ends)
    week_2 = hours_worked(staff=staff, start=week_2_starts, end=pay_period.ends_on)
    return week_1, week_2


def calculate_entry(*, pay_period, staff) -> models.PayrollEntry:
    """Create or refresh one staff member's entry for a pay period.

    Hours come from attendance. The rate-1/rate-2 split defaults to
    WEEKLY_RATE_1_HOUR_CAP hours on rate 1 per week and the rest of that
    week on rate 2, until an admin reviews and reallocates it differently -
    see apps.payroll.api.admin and reallocate_hours below.
    """
    rates = models.StaffPayRate.objects.filter(staff=staff).first()
    rate_1 = rates.rate_1 if rates else Decimal("0")
    rate_2 = rates.rate_2 if rates else Decimal("0")

    week_1, week_2 = _weekly_hours(staff=staff, pay_period=pay_period)
    worked = week_1 + week_2

    entry, created = models.PayrollEntry.objects.update_or_create(
        pay_period=pay_period,
        staff=staff,
        defaults={
            "hours_worked": worked,
            "rate_1_snapshot": rate_1,
            "rate_2_snapshot": rate_2,
        },
    )

    # Re-running a calculation (e.g. after attendance corrections, before the
    # period is locked) should not clobber a split an admin already made.
    if created or entry.hours_at_rate_1 + entry.hours_at_rate_2 == 0:
        entry.hours_at_rate_1 = min(week_1, WEEKLY_RATE_1_HOUR_CAP) + min(
            week_2, WEEKLY_RATE_1_HOUR_CAP
        )
        entry.hours_at_rate_2 = max(week_1 - WEEKLY_RATE_1_HOUR_CAP, Decimal("0")) + max(
            week_2 - WEEKLY_RATE_1_HOUR_CAP, Decimal("0")
        )

    entry.total_pay = (entry.hours_at_rate_1 * entry.rate_1_snapshot) + (
        entry.hours_at_rate_2 * entry.rate_2_snapshot
    )
    entry.save()
    return entry


def reallocate_hours(
    *, entry: models.PayrollEntry, hours_at_rate_1: Decimal, hours_at_rate_2: Decimal
) -> models.PayrollEntry:
    """Admin override of the rate-1/rate-2 split for one entry."""
    if hours_at_rate_1 + hours_at_rate_2 != entry.hours_worked:
        raise ValidationError("Split hours must add up to the hours worked.")

    entry.hours_at_rate_1 = hours_at_rate_1
    entry.hours_at_rate_2 = hours_at_rate_2
    entry.total_pay = (hours_at_rate_1 * entry.rate_1_snapshot) + (
        hours_at_rate_2 * entry.rate_2_snapshot
    )
    entry.save(update_fields=["hours_at_rate_1", "hours_at_rate_2", "total_pay", "updated_at"])
    return entry
