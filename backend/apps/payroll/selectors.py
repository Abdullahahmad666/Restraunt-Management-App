"""Read queries for a staff member's pay over a period."""

from datetime import date
from decimal import Decimal

from apps.attendance import selectors as attendance_selectors
from apps.attendance.services.hours import lifetime_hours_worked

from . import models


def staff_summary(*, staff, start: date, end: date) -> dict:
    """Everything about one staff member's schedule and pay, in one place.

    Combines rota data (attendance) with rate/period data (payroll) - the
    shared source for both the admin "view this staff member" screen and the
    staff member's own summary screen, so the two never quietly disagree.
    """
    rates = models.StaffPayRate.objects.filter(staff=staff).first()
    entries = (
        models.PayrollEntry.objects.filter(staff=staff)
        .select_related("pay_period")
        .order_by("-pay_period__starts_on")
    )

    total_pay_received = Decimal("0")
    total_pay_pending = Decimal("0")
    for entry in entries:
        if entry.pay_period.status == models.PayPeriod.Status.PAID:
            total_pay_received += entry.total_pay
        elif entry.pay_period.status == models.PayPeriod.Status.LOCKED:
            total_pay_pending += entry.total_pay

    return {
        "staff": staff,
        "rate_1": rates.rate_1 if rates else None,
        "rate_2": rates.rate_2 if rates else None,
        "range_start": start,
        "range_end": end,
        "shifts": attendance_selectors.shifts_in_range(staff=staff, start=start, end=end),
        "off_days": attendance_selectors.off_days(staff=staff, start=start, end=end),
        "entries": entries,
        "hours_worked_lifetime": lifetime_hours_worked(staff=staff),
        "total_pay_received": total_pay_received,
        "total_pay_pending": total_pay_pending,
    }


def entries_for_staff(*, staff):
    return (
        models.PayrollEntry.objects.filter(staff=staff)
        .select_related("pay_period")
        .order_by("-pay_period__starts_on")
    )


def monthly_cost(*, restaurant, year: int, month: int) -> list[dict]:
    """Total staff cost for one restaurant in one calendar month, broken down per employee."""
    entries = models.PayrollEntry.objects.filter(
        pay_period__restaurant=restaurant,
        pay_period__starts_on__year=year,
        pay_period__starts_on__month=month,
    ).select_related("staff")

    by_staff: dict = {}
    for entry in entries:
        row = by_staff.setdefault(
            entry.staff_id,
            {"staff": entry.staff, "hours": Decimal("0"), "total_pay": Decimal("0")},
        )
        row["hours"] += entry.hours_worked
        row["total_pay"] += entry.total_pay

    return list(by_staff.values())
