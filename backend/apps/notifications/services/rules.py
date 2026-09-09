"""What triggers a notification, and to whom."""

from datetime import timedelta

from django.utils import timezone

from apps.attendance.models import Shift, ShiftSwapRequest

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


def send_ending_shift_reminders(*, now=None) -> int:
    """Notify every staff member whose shift ends in about 15 minutes -
    the mirror of send_upcoming_shift_reminders above, on end_reminder_sent_at
    instead of reminder_sent_at so a shift gets both reminders independently."""
    now = now or timezone.now()
    window_start = now + REMINDER_LEAD_TIME
    window_end = window_start + REMINDER_WINDOW

    due_shifts = Shift.objects.filter(
        ends_at__gte=window_start,
        ends_at__lt=window_end,
        end_reminder_sent_at__isnull=True,
    ).select_related("staff")

    sent = 0
    for shift in due_shifts:
        notification = models.Notification.objects.create(
            user=shift.staff,
            kind=models.Notification.Kind.SHIFT_ENDING_SOON,
            title="Shift ending soon",
            body=f"Your shift ends at {timezone.localtime(shift.ends_at):%H:%M}.",
            related_object_type="attendance.Shift",
            related_object_id=shift.id,
        )
        send_notification(notification)

        shift.end_reminder_sent_at = now
        shift.save(update_fields=["end_reminder_sent_at", "updated_at"])
        sent += 1

    return sent


def notify_admins_of_scan(*, log, action: str) -> None:
    """Every admin of the log's restaurant hears about a check-in/out as it
    happens - a manager watching the floor from the office still wants to
    know who's actually there."""
    from django.contrib.auth import get_user_model

    from apps.common.roles import Role

    User = get_user_model()

    if action == "check_in":
        kind = models.Notification.Kind.STAFF_CHECKED_IN
        verb = "checked in"
        at = log.clock_in_at
    elif action == "check_out":
        kind = models.Notification.Kind.STAFF_CHECKED_OUT
        verb = "checked out"
        at = log.clock_out_at
    else:
        # "already_checked_in" - a re-scan within MIN_TIME_BEFORE_CHECKOUT,
        # not a real state change. Nothing happened, so nothing to tell anyone.
        return

    name = log.staff.get_full_name() or log.staff.email
    admins = User.objects.filter(restaurant=log.restaurant, role=Role.ADMIN, is_active=True)

    for admin in admins:
        notification = models.Notification.objects.create(
            user=admin,
            kind=kind,
            title=f"{name} {verb}",
            body=f"{name} {verb} at {timezone.localtime(at):%H:%M}.",
            related_object_type="attendance.AttendanceLog",
            related_object_id=log.id,
        )
        send_notification(notification)


def _shift_window(shift: Shift) -> str:
    starts = timezone.localtime(shift.starts_at)
    ends = timezone.localtime(shift.ends_at)
    return f"{starts:%a %d %b}, {starts:%H:%M}-{ends:%H:%M}"


def notify_shift_added(shift: Shift) -> None:
    """A manager scheduled a new shift for this staff member."""
    notification = models.Notification.objects.create(
        user=shift.staff,
        kind=models.Notification.Kind.SHIFT_ADDED,
        title="New shift scheduled",
        body=f"You're scheduled {_shift_window(shift)}.",
        related_object_type="attendance.Shift",
        related_object_id=shift.id,
    )
    send_notification(notification)


def notify_shift_updated(shift: Shift) -> None:
    """A manager changed the time, job title or notes on an existing shift."""
    notification = models.Notification.objects.create(
        user=shift.staff,
        kind=models.Notification.Kind.SHIFT_UPDATED,
        title="Shift updated",
        body=f"Your shift was changed - now {_shift_window(shift)}.",
        related_object_type="attendance.Shift",
        related_object_id=shift.id,
    )
    send_notification(notification)


def notify_shift_cancelled(*, staff, starts_at) -> None:
    """A manager deleted a shift - the row is gone, so the details that
    matter (who, when) travel as plain arguments rather than the instance."""
    starts = timezone.localtime(starts_at)
    notification = models.Notification.objects.create(
        user=staff,
        kind=models.Notification.Kind.SHIFT_CANCELLED,
        title="Shift cancelled",
        body=f"Your shift on {starts:%a %d %b, %H:%M} was cancelled.",
    )
    send_notification(notification)


def notify_swap_requested(swap_request) -> None:
    """The colleague being asked, plus every admin, hear about a new pending
    swap request as soon as it's made - the colleague because it's theirs to
    end up covering, admins because it needs their approval."""
    from django.contrib.auth import get_user_model

    from apps.common.roles import Role

    User = get_user_model()

    requester_name = swap_request.requested_by.get_full_name() or swap_request.requested_by.email
    target_name = swap_request.target_staff.get_full_name() or swap_request.target_staff.email
    window = _shift_window(swap_request.shift)

    target_notification = models.Notification.objects.create(
        user=swap_request.target_staff,
        kind=models.Notification.Kind.SHIFT_SWAP_REQUESTED,
        title="Shift swap requested",
        body=f"{requester_name} wants you to cover their shift, {window}.",
        related_object_type="attendance.ShiftSwapRequest",
        related_object_id=swap_request.id,
    )
    send_notification(target_notification)

    admins = User.objects.filter(
        restaurant=swap_request.restaurant, role=Role.ADMIN, is_active=True
    )
    for admin in admins:
        notification = models.Notification.objects.create(
            user=admin,
            kind=models.Notification.Kind.SHIFT_SWAP_REQUESTED,
            title="Shift swap requested",
            body=f"{requester_name} asked {target_name} to cover their shift, {window}.",
            related_object_type="attendance.ShiftSwapRequest",
            related_object_id=swap_request.id,
        )
        send_notification(notification)


def notify_swap_decided(swap_request) -> None:
    """Both the requester and the colleague who was asked hear the outcome -
    the requester either way, the colleague only once there's actually a new
    shift on their rota to know about."""
    window = _shift_window(swap_request.shift)
    approved = swap_request.status == ShiftSwapRequest.Status.APPROVED
    requester_name = swap_request.requested_by.get_full_name() or swap_request.requested_by.email
    target_name = swap_request.target_staff.get_full_name() or swap_request.target_staff.email

    requester_notification = models.Notification.objects.create(
        user=swap_request.requested_by,
        kind=(
            models.Notification.Kind.SHIFT_SWAP_APPROVED
            if approved
            else models.Notification.Kind.SHIFT_SWAP_DECLINED
        ),
        title="Shift swap approved" if approved else "Shift swap declined",
        body=(
            f"{target_name} is now covering your shift, {window}."
            if approved
            else f"Your request for {target_name} to cover your shift, {window}, was declined."
        ),
        related_object_type="attendance.ShiftSwapRequest",
        related_object_id=swap_request.id,
    )
    send_notification(requester_notification)

    if approved:
        target_notification = models.Notification.objects.create(
            user=swap_request.target_staff,
            kind=models.Notification.Kind.SHIFT_SWAP_APPROVED,
            title="You're covering a shift",
            body=f"You're now scheduled {window}, covering for {requester_name}.",
            related_object_type="attendance.ShiftSwapRequest",
            related_object_id=swap_request.id,
        )
        send_notification(target_notification)
