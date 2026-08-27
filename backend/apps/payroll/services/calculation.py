"""Hours x hourly rate for one staff member."""

from decimal import Decimal

from django.core.exceptions import ValidationError

from apps.attendance.services.hours import hours_worked

from .. import models


def calculate_entry(*, pay_period, staff) -> models.PayrollEntry:
    """Create or refresh one staff member's entry for a pay period.

    Hours come from attendance. The rate-1/rate-2 split defaults to all hours
    on rate 1 until an admin reviews and reallocates it - see
    apps.payroll.api.admin and reallocate_hours below.
    """
    rates = models.StaffPayRate.objects.filter(staff=staff).first()
    rate_1 = rates.rate_1 if rates else Decimal("0")
    rate_2 = rates.rate_2 if rates else Decimal("0")

    worked = hours_worked(staff=staff, start=pay_period.starts_on, end=pay_period.ends_on)

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
        entry.hours_at_rate_1 = worked
        entry.hours_at_rate_2 = Decimal("0")

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
