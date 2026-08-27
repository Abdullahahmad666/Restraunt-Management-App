"""Read queries for a staff member's pay over a period."""

from decimal import Decimal

from . import models


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
