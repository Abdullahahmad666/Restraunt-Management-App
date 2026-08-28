"""Total hours worked per day, week, pay period, or ever."""

from datetime import date
from decimal import Decimal

from django.db.models import DurationField, ExpressionWrapper, F, QuerySet, Sum

from .. import models


def _sum_hours(logs: QuerySet) -> Decimal:
    total = logs.annotate(
        duration=ExpressionWrapper(
            F("clock_out_at") - F("clock_in_at"), output_field=DurationField()
        )
    ).aggregate(total=Sum("duration"))["total"]

    if total is None:
        return Decimal("0.00")
    return (Decimal(total.total_seconds()) / Decimal(3600)).quantize(Decimal("0.01"))


def hours_worked(*, staff, start: date, end: date) -> Decimal:
    """Sum of closed attendance logs whose clock-in falls within [start, end].

    An open log (still clocked in) contributes nothing until it closes - the
    hours it will have worked are not known yet.
    """
    return _sum_hours(
        models.AttendanceLog.objects.filter(
            staff=staff,
            status__in=(
                models.AttendanceLog.Status.CLOSED,
                models.AttendanceLog.Status.AUTO_CLOSED,
            ),
            clock_in_at__date__gte=start,
            clock_in_at__date__lte=end,
            clock_out_at__isnull=False,
        )
    )


def lifetime_hours_worked(*, staff) -> Decimal:
    """Sum of closed attendance logs across all time - no date range."""
    return _sum_hours(
        models.AttendanceLog.objects.filter(
            staff=staff,
            status__in=(
                models.AttendanceLog.Status.CLOSED,
                models.AttendanceLog.Status.AUTO_CLOSED,
            ),
            clock_out_at__isnull=False,
        )
    )
