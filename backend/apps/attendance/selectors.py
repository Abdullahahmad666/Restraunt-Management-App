"""Read queries: who is checked in, history for a date range."""

from datetime import date

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
