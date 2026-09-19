"""Django-admin registrations for the inventory app."""

from django.contrib import admin

from . import models


@admin.register(models.InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ("name", "restaurant", "unit", "quantity_on_hand", "par_level", "is_active")
    list_filter = ("restaurant", "is_active")


@admin.register(models.StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ("item", "reason", "quantity_delta", "recorded_by", "created_at")
    list_filter = ("reason", "created_at")


@admin.register(models.InvoiceScan)
class InvoiceScanAdmin(admin.ModelAdmin):
    list_display = ("id", "restaurant", "status", "supplier_name", "invoice_date", "uploaded_by")
    list_filter = ("restaurant", "status")


@admin.register(models.InvoiceLineItem)
class InvoiceLineItemAdmin(admin.ModelAdmin):
    list_display = ("raw_name", "invoice", "quantity", "unit_price", "matched_item")
    list_filter = ("invoice__status",)
