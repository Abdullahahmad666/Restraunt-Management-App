"""Where a delivery physically went.

A restaurant keeps stock in more than one place - a dry store, a cellar, a
walk-in freezer, sometimes a second site - and "what did we spend on the
cellar this month" is a different question from "what did we spend". Recording
the destination on the invoice is what makes that answerable.

Deliberately not on InventoryItem: putting it there would mean one item per
warehouse and a running count per location, which is a real stock-transfer
model and a much larger change than the question being asked. If per-location
stock is ever needed, this is the table it hangs off.
"""

from django.db import models

from apps.common.models import BaseModel


class Warehouse(BaseModel):
    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="warehouses"
    )
    name = models.CharField(max_length=120)
    description = models.CharField(max_length=500, blank=True, default="")
    #: Deactivated rather than deleted, so past invoices keep naming where
    #: their delivery went.
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=("restaurant", "name"), name="unique_warehouse_name_per_restaurant"
            )
        ]

    def __str__(self):
        return self.name
