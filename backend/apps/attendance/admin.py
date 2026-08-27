"""Django-admin registrations for the attendance app."""

from django.contrib import admin

from . import models


@admin.register(models.VenueQRCode)
class VenueQRCodeAdmin(admin.ModelAdmin):
    list_display = ("restaurant", "token", "is_active", "radius_meters")


@admin.register(models.Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ("staff", "restaurant", "starts_at", "ends_at")
    list_filter = ("restaurant",)


@admin.register(models.AttendanceLog)
class AttendanceLogAdmin(admin.ModelAdmin):
    list_display = ("staff", "restaurant", "clock_in_at", "clock_out_at", "status")
    list_filter = ("restaurant", "status")
