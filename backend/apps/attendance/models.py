"""Staff, barcode and attendance-log models."""

import uuid

from django.conf import settings
from django.db import models

from apps.common.models import BaseModel


class VenueQRCode(BaseModel):
    """The single static QR code a restaurant prints and displays for staff to scan.

    The code itself carries no identity - it only proves the scanning phone
    was pointed at this restaurant. Who is checking in comes from the
    authenticated request; where comes from the GPS reading taken at scan
    time and checked against latitude/longitude/radius_meters below.
    """

    restaurant = models.OneToOneField(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="qr_code"
    )
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    radius_meters = models.PositiveIntegerField(default=100)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.restaurant.name} QR code"


class Shift(BaseModel):
    """A rota entry: one staff member scheduled to work one span of time."""

    class JobTitle(models.TextChoices):
        """What the staff member is covering on this shift - not their account
        Role (see apps.common.roles), which stays an access level only. The
        same person can be scheduled as CHEF one day and TILL_OPERATOR the
        next, so this lives on the shift, not the user."""

        CHEF = "CHEF", "Chef"
        DRIVER = "DRIVER", "Driver"
        TILL_OPERATOR = "TILL_OPERATOR", "Till operator"

    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="shifts"
    )
    staff = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="shifts",
    )
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    job_title = models.CharField(max_length=16, choices=JobTitle.choices, blank=True)
    notes = models.CharField(max_length=255, blank=True)
    # Set by the send_shift_reminders command so a shift is reminded exactly
    # once even if the command's schedule slips slightly.
    reminder_sent_at = models.DateTimeField(null=True, blank=True)
    # The same guard, for the separate "your shift ends soon" reminder - a
    # second field because a shift needs both, independently, not either/or.
    end_reminder_sent_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        ordering = ("starts_at",)
        constraints = [
            models.CheckConstraint(
                condition=models.Q(ends_at__gt=models.F("starts_at")),
                name="shift_ends_after_it_starts",
            )
        ]

    def __str__(self):
        return f"{self.staff} {self.starts_at:%Y-%m-%d %H:%M}"


class ShiftSwapRequest(BaseModel):
    """A staff member asking a colleague to take over one of their own
    upcoming shifts, subject to manager approval - so a shift never quietly
    changes hands without the manager knowing who is actually on the rota.

    This is a hand-off, not a two-way trade: approving one only reassigns
    `shift` to `target_staff`, nothing moves the other way. A colleague
    trading back their own shift is a second, separate request.
    """

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        DECLINED = "DECLINED", "Declined"
        CANCELLED = "CANCELLED", "Cancelled"

    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="shift_swap_requests"
    )
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name="swap_requests")
    # Who asked - its own field rather than reading shift.staff, because
    # shift.staff is reassigned to target_staff the moment the swap is
    # approved; this stays the permanent record of who originally asked.
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="shift_swaps_requested"
    )
    target_staff = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="shift_swaps_offered"
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    # The requester's own reason, shown to both the target and the manager.
    note = models.CharField(max_length=255, blank=True)
    # The manager's reason, shown to the requester - mainly useful on a decline.
    decision_note = models.CharField(max_length=255, blank=True)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.requested_by} -> {self.target_staff} ({self.shift_id})"


class AttendanceLog(BaseModel):
    """One clock-in, and the clock-out that later closes it.

    A staff member has at most one OPEN log at a time - see the constraint
    below - which is what lets one "scan" endpoint decide for itself whether
    it is a check-in or a check-out (apps.attendance.services.scan).
    """

    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        CLOSED = "CLOSED", "Closed"
        AUTO_CLOSED = "AUTO_CLOSED", "Auto-closed"

    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="attendance_logs",
    )
    staff = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="attendance_logs",
    )
    shift = models.ForeignKey(
        Shift,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_logs",
    )

    clock_in_at = models.DateTimeField()
    clock_in_latitude = models.DecimalField(max_digits=9, decimal_places=6)
    clock_in_longitude = models.DecimalField(max_digits=9, decimal_places=6)

    clock_out_at = models.DateTimeField(null=True, blank=True)
    clock_out_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    clock_out_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    # Set whenever an admin edits the record after the fact (a correction) or
    # the reconciliation job auto-closes it - the raw scan data stays
    # trustworthy for anything that must know whether a human touched it.
    is_manual_override = models.BooleanField(default=False)
    edited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    # Free text the staff member can attach to their own check-in/out - "car
    # broke down, 10 min late" - so a late or early scan carries its own
    # context instead of relying on the staff member telling a manager
    # separately. Writable by the owning staff member; see
    # StaffAttendanceLogSerializer.
    note = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ("-clock_in_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("staff",),
                condition=models.Q(status="OPEN"),
                name="one_open_attendance_log_per_staff",
            )
        ]

    def __str__(self):
        return f"{self.staff} {self.clock_in_at:%Y-%m-%d %H:%M}"


# A flat, top-level name so config.settings.base can point drf-spectacular's
# ENUM_NAME_OVERRIDES at it - a dotted path through a nested class attribute
# (AttendanceLog.Status.choices) is not resolvable there.
ATTENDANCE_LOG_STATUS_CHOICES = AttendanceLog.Status.choices
SHIFT_JOB_TITLE_CHOICES = Shift.JobTitle.choices
SHIFT_SWAP_STATUS_CHOICES = ShiftSwapRequest.Status.choices
