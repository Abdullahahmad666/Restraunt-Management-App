"""Every change to an item's stock - a delivery received, waste thrown out,
or a manual correction. InventoryItem.quantity_on_hand is a running total;
this is the ledger that explains how it got there.
"""

from django.conf import settings
from django.db import models

from apps.common.models import BaseModel

from .invoices import InvoiceLineItem
from .items import InventoryItem


class StockMovement(BaseModel):
    class Reason(models.TextChoices):
        DELIVERY = "DELIVERY", "Delivery received"
        WASTE = "WASTE", "Waste / spoilage"
        CORRECTION = "CORRECTION", "Manual correction"

    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="stock_movements"
    )
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="movements")
    reason = models.CharField(max_length=16, choices=Reason.choices)
    # Positive for stock coming in (delivery, correcting an undercount),
    # negative for stock going out (waste, correcting an overcount).
    quantity_delta = models.DecimalField(max_digits=10, decimal_places=2)
    note = models.CharField(max_length=255, blank=True, default="")
    # Set when this movement came from confirming a scanned invoice, rather
    # than a manual adjustment - traceability back to the source document.
    invoice_line_item = models.ForeignKey(
        InvoiceLineItem, on_delete=models.SET_NULL, null=True, blank=True, related_name="movements"
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.item_id} {self.quantity_delta:+} ({self.reason})"


# Flat, top-level name for config.settings.base's ENUM_NAME_OVERRIDES - see
# the matching comment in apps.attendance.models.
STOCK_MOVEMENT_REASON_CHOICES = StockMovement.Reason.choices
