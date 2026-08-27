"""What triggers a notification, and to whom."""

from datetime import timedelta

from django.utils import timezone

from apps.attendance.models import Shift

from .. import models
from .dispatch import send_notification

# Run send_upcoming_shift_reminders once a minute (see the
# send_shift_reminders management command). The one-minute window plus the
# reminder_sent_at guard on Shift means a shift is reminded exactly once even
# if the command's schedule slips slightly.
REMINDER_LEAD_TIME = timedelta(minutes=15)
REMINDER_WINDOW = timedelta(minutes=1)


def send_upcoming_shift_reminders(*, now=None) -> int:
    """Notify every staff member whose shift starts in about 15 minutes."""
    now = now or timezone.now()
    window_start = now + REMINDER_LEAD_TIME
    window_end = window_start + REMINDER_WINDOW

    due_shifts = Shift.objects.filter(
        starts_at__gte=window_start,
        starts_at__lt=window_end,
        reminder_sent_at__isnull=True,
    ).select_related("staff")

    sent = 0
    for shift in due_shifts:
        notification = models.Notification.objects.create(
            user=shift.staff,
            kind=models.Notification.Kind.SHIFT_REMINDER,
            title="Shift starting soon",
            body=f"Your shift starts at {timezone.localtime(shift.starts_at):%H:%M}.",
            related_object_type="attendance.Shift",
            related_object_id=shift.id,
        )
        send_notification(notification)

        shift.reminder_sent_at = now
        shift.save(update_fields=["reminder_sent_at", "updated_at"])
        sent += 1

    return sent
