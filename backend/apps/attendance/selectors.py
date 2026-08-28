"""Read queries: who is checked in, history for a date range."""

from datetime import date, timedelta

from django.utils import timezone

from . import models


def currently_clocked_in(*, restaurant):
    return models.AttendanceLog.objects.filter(
        restaurant=restaurant, status=models.AttendanceLog.Status.OPEN
    ).select_related("staff")


def history(*, staff, start: date, end: date):
    return models.AttendanceLog.objects.filter(
        staff=staff, clock_in_at__date__gte=start, clock_in_at__date__lte=end
    ).order_by("-clock_in_at")


def upcoming_shifts(*, staff, now=None):
    now = now or timezone.now()
    return models.Shift.objects.filter(staff=staff, starts_at__gte=now).order_by("starts_at")


def shifts_in_range(*, staff, start: date, end: date):
    return models.Shift.objects.filter(
        staff=staff, starts_at__date__gte=start, starts_at__date__lte=end
    ).order_by("starts_at")


def off_days(*, staff, start: date, end: date) -> list[date]:
    """Every date in [start, end] with no shift scheduled for this staff member.

    Deliberately not a stored fact anywhere - a rest day is whatever the rota
    currently says it is, and that changes week to week. Someone called in on
    their usual day off simply has a shift that day now, so it drops out of
    this list on its own; nothing has to be "undone" to reflect the swap.
    """
    scheduled = set(
        models.Shift.objects.filter(
            staff=staff, starts_at__date__gte=start, starts_at__date__lte=end
        ).values_list("starts_at__date", flat=True)
    )
    return [
        start + timedelta(days=i)
        for i in range((end - start).days + 1)
        if start + timedelta(days=i) not in scheduled
    ]
