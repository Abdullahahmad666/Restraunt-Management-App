"""Notification and delivery-attempt models."""

from django.conf import settings
from django.db import models

from apps.common.models import BaseModel


class DeviceToken(BaseModel):
    """A push token for one installation of the mobile app on one device."""

    class Platform(models.TextChoices):
        IOS = "IOS", "iOS"
        ANDROID = "ANDROID", "Android"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="device_tokens"
    )
    token = models.CharField(max_length=255, unique=True)
    platform = models.CharField(max_length=16, choices=Platform.choices)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.user} ({self.platform})"


class Notification(BaseModel):
    """One thing a user was told about: a shift starting soon, a missed check, and so on."""

    class Kind(models.TextChoices):
        SHIFT_REMINDER = "SHIFT_REMINDER", "Shift reminder"
        MISSED_CHECKOUT = "MISSED_CHECKOUT", "Missed checkout"
        COMPLIANCE_OVERDUE = "COMPLIANCE_OVERDUE", "Compliance overdue"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SENT = "SENT", "Sent"
        FAILED = "FAILED", "Failed"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    kind = models.CharField(max_length=32, choices=Kind.choices)
    title = models.CharField(max_length=120)
    body = models.CharField(max_length=255)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    read_at = models.DateTimeField(null=True, blank=True)

    # A loose pointer back to whatever this notification is about (a Shift,
    # an AttendanceLog, ...) so notifications does not have to import every
    # other app's models just to record what triggered it.
    related_object_type = models.CharField(max_length=64, blank=True)
    related_object_id = models.UUIDField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.kind} -> {self.user}"


class DeliveryAttempt(BaseModel):
    """One attempt to deliver a notification down one channel."""

    class Channel(models.TextChoices):
        PUSH = "PUSH", "Push"
        EMAIL = "EMAIL", "Email"

    notification = models.ForeignKey(
        Notification, on_delete=models.CASCADE, related_name="delivery_attempts"
    )
    channel = models.CharField(max_length=16, choices=Channel.choices, default=Channel.PUSH)
    succeeded = models.BooleanField(default=False)
    error_message = models.CharField(max_length=500, blank=True)
    attempted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-attempted_at",)

    def __str__(self):
        return f"{self.notification_id} via {self.channel}"
