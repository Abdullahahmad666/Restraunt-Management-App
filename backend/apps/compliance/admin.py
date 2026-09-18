"""Django-admin registrations for the compliance app."""

from django.contrib import admin

from . import models


@admin.register(models.FridgeUnit)
class FridgeUnitAdmin(admin.ModelAdmin):
    list_display = ("name", "restaurant", "kind", "recommended_max_celsius", "is_active")
    list_filter = ("restaurant", "kind", "is_active")


@admin.register(models.ChecklistItem)
class ChecklistItemAdmin(admin.ModelAdmin):
    list_display = ("text", "restaurant", "routine", "sort_order", "is_active")
    list_filter = ("restaurant", "routine", "is_active")


@admin.register(models.TemperatureReading)
class TemperatureReadingAdmin(admin.ModelAdmin):
    list_display = ("fridge_unit", "routine", "date", "celsius", "recorded_by")
    list_filter = ("routine", "date")


@admin.register(models.ChecklistCompletion)
class ChecklistCompletionAdmin(admin.ModelAdmin):
    list_display = ("checklist_item", "date", "completed_by")
    list_filter = ("date",)
