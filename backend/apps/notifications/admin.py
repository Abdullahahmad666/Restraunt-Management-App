"""Django-admin registrations for the notifications app."""

from django.contrib import admin

from . import models


@admin.register(models.DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "platform", "is_active")


@admin.register(models.Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("user", "kind", "status", "created_at")
    list_filter = ("kind", "status")


@admin.register(models.DeliveryAttempt)
class DeliveryAttemptAdmin(admin.ModelAdmin):
    list_display = ("notification", "channel", "succeeded", "attempted_at")
