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

import re

from django.db import models

from apps.common.models import BaseModel

_NON_ALPHANUMERIC = re.compile(r"[^a-z0-9]+")


def normalize_warehouse_name(raw: str) -> str:
    """Reduce a storage area's name to a key two spellings of it agree on.

    Case, punctuation and spacing only. No legal-suffix stripping like
    suppliers get - "Cellar Ltd" is not a thing, and a rule that removed
    trailing words would merge "Store 1" with "Store".
    """
    return " ".join(_NON_ALPHANUMERIC.sub(" ", (raw or "").casefold()).split())


class Warehouse(BaseModel):
    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="warehouses"
    )
    name = models.CharField(max_length=120)
    #: Derived from `name` on every save. Matters more now that a scan can
    #: create one of these: without it a delivery note reading "CELLAR" would
    #: sit beside the "Cellar" someone typed, and a filter would show two.
    normalized_name = models.CharField(max_length=120, editable=False, default="")
    description = models.CharField(max_length=500, blank=True, default="")
    #: Deactivated rather than deleted, so past invoices keep naming where
    #: their delivery went.
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=("restaurant", "normalized_name"),
                name="unique_warehouse_name_per_restaurant",
            )
        ]

    def save(self, *args, **kwargs):
        self.normalized_name = normalize_warehouse_name(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name
