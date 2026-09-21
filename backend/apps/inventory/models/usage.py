"""How many invoices a restaurant has had read this month.

Counted rather than inferred. Invoice rows are the obvious proxy and a wrong
one: a rescan reads the same invoice again and adds no row, and a duplicate
adds a row without ever calling anything. Neither error is large, but a cap
that stops the wrong people at the wrong time is worse than no cap - it is the
kind of limit that gets raised until it means nothing.

One row per restaurant per month, incremented where the call actually happens.
"""

from django.db import models

from apps.common.models import BaseModel


class ScanUsage(BaseModel):
    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="scan_usage"
    )
    #: The first of the month this counts. A date rather than a year/month pair
    #: so ordering and range queries are the ordinary kind.
    month = models.DateField()
    scans = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("-month",)
        constraints = [
            models.UniqueConstraint(
                fields=("restaurant", "month"), name="unique_scan_usage_per_month"
            )
        ]

    def __str__(self):
        return f"{self.restaurant_id} {self.month:%Y-%m}: {self.scans}"
