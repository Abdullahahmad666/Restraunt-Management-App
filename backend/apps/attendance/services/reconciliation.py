"""Missed check-outs: flag for review or auto-close after N hours."""

from datetime import timedelta

from django.utils import timezone

from .. import models

# How long an open log can run with no matching shift before it is treated
# as forgotten rather than a genuinely long day. Set above the longest
# plausible unscheduled shift (an 11am-to-1am double shift is 14 hours) so a
# real, still-working staff member is never auto-closed mid-shift - a shift
# that IS in the rota uses shift.ends_at instead and never hits this at all.
AUTO_CLOSE_AFTER = timedelta(hours=16)


def auto_close_stale_logs(*, now=None) -> int:
    """Close attendance logs left open long past a plausible shift length.

    A staff member who forgets to scan out on the way home would otherwise
    stay "clocked in" forever, which blocks their next check-in (a staff
    member may only have one open log at a time) and corrupts hours-worked
    totals. Auto-closing at the shift's scheduled end - or, lacking one,
    AUTO_CLOSE_AFTER after clock-in - trades a slightly wrong total for a
    bounded one. is_manual_override is set so payroll review can spot and
    correct these before a pay period is closed.
    """
    now = now or timezone.now()
    closed = 0

    for log in models.AttendanceLog.objects.filter(
        status=models.AttendanceLog.Status.OPEN
    ).select_related("shift"):
        cutoff = log.shift.ends_at if log.shift else log.clock_in_at + AUTO_CLOSE_AFTER
        if now < cutoff:
            continue
        log.clock_out_at = cutoff
        log.status = models.AttendanceLog.Status.AUTO_CLOSED
        log.is_manual_override = True
        log.save(update_fields=["clock_out_at", "status", "is_manual_override", "updated_at"])
        closed += 1

    return closed
