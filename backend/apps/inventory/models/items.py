"""What we track: a consumable stock item, and the unit it's counted in."""

from decimal import Decimal

from django.db import models

from apps.common.models import BaseModel


class InventoryItem(BaseModel):
    """One ingredient/supply a restaurant keeps stock of - "Chicken Breast",
    counted in kg. `quantity_on_hand` is a running total, corrected by
    StockMovement rows rather than edited directly, so there's always a
    trail explaining how it got to whatever it currently reads."""

    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="inventory_items"
    )
    name = models.CharField(max_length=150)
    unit = models.CharField(max_length=32)
    quantity_on_hand = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))
    # Optional - a manager sets this once they know what "running low" means
    # for this item. Null, not zero, so "no threshold set" is distinguishable
    # from "the threshold is zero".
    par_level = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    # Refreshed from an invoice's unit price whenever one is confirmed - see
    # apps.inventory.services.stock.confirm_invoice.
    cost_per_unit = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=("restaurant", "name"), name="unique_inventory_item_name_per_restaurant"
            )
        ]

    @property
    def is_below_par(self) -> bool:
        return self.par_level is not None and self.quantity_on_hand < self.par_level

    def __str__(self):
        return f"{self.name} ({self.restaurant_id})"
