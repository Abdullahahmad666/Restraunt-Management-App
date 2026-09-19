"""A staff-uploaded invoice photo, and the line items a vision model read
off it - reviewed and matched by a human before any of it touches stock.
See apps.inventory.services.scanning for how the line items get here, and
apps.inventory.services.stock.confirm_invoice for how they're applied.
"""

from django.conf import settings
from django.db import models

from apps.common.models import BaseModel

from .items import InventoryItem


class InvoiceScan(BaseModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending review"
        CONFIRMED = "CONFIRMED", "Confirmed"
        DISCARDED = "DISCARDED", "Discarded"

    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="invoice_scans"
    )
    photo = models.ImageField(upload_to="invoice_scans/")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    supplier_name = models.CharField(max_length=200, blank=True, default="")
    invoice_date = models.DateField(null=True, blank=True)
    # Set when the scan itself failed (bad photo, the AI service errored) -
    # the scan still exists with zero line items so staff can retry or add
    # lines by hand rather than losing the upload.
    scan_error = models.CharField(max_length=500, blank=True, default="")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"Invoice scan {self.id} ({self.status})"


class InvoiceLineItem(BaseModel):
    """One row the AI read off the invoice - a name, a quantity, and
    whatever price info was legible. `matched_item` starts unset; staff
    pick an existing InventoryItem or create a new one before the invoice
    can be confirmed (see confirm_invoice's all-lines-matched check)."""

    invoice = models.ForeignKey(InvoiceScan, on_delete=models.CASCADE, related_name="line_items")
    raw_name = models.CharField(max_length=255)
    matched_item = models.ForeignKey(
        InventoryItem, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.CharField(max_length=32, blank=True, default="")
    unit_price = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    line_total = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("sort_order",)

    def __str__(self):
        return f"{self.raw_name} x{self.quantity}"


# Flat, top-level name for config.settings.base's ENUM_NAME_OVERRIDES - see
# the matching comment in apps.attendance.models.
INVOICE_SCAN_STATUS_CHOICES = InvoiceScan.Status.choices
