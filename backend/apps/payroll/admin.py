"""Django-admin registrations for the payroll app."""

from django.contrib import admin

from . import models


@admin.register(models.StaffPayRate)
class StaffPayRateAdmin(admin.ModelAdmin):
    list_display = ("staff", "rate_1", "rate_2")


@admin.register(models.RateChange)
class RateChangeAdmin(admin.ModelAdmin):
    list_display = ("staff", "rate_1", "rate_2", "effective_from")


@admin.register(models.PayPeriod)
class PayPeriodAdmin(admin.ModelAdmin):
    list_display = ("restaurant", "starts_on", "ends_on", "status")


@admin.register(models.PayrollEntry)
class PayrollEntryAdmin(admin.ModelAdmin):
    list_display = ("staff", "pay_period", "hours_worked", "total_pay")
