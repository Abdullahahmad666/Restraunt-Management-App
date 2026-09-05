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
