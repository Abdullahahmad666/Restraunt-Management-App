"""Who the restaurant buys from.

Until now a supplier was whatever string a vision model read off the top of an
invoice. That is enough to display and useless for anything else: "Fresh Foods
Ltd", "FRESH FOODS LTD" and "Fresh Foods Ltd." are three different suppliers to
a database and one to a human, so no filter and no price history across
deliveries could work.
"""

import re

from django.db import models

from apps.common.models import BaseModel

#: Company-form words that tell two names apart on paper and never in practice.
_LEGAL_SUFFIXES = {"ltd", "limited", "llc", "plc", "inc", "co", "company", "gmbh", "sa", "bv"}

_NON_ALPHANUMERIC = re.compile(r"[^a-z0-9]+")


def normalize_supplier_name(raw: str) -> str:
    """Reduce a supplier name to something two spellings of it agree on.

    Case, punctuation and a trailing "Ltd" are exactly the differences that
    separate the same supplier across two invoices, so all three are dropped.
    The original is always kept alongside this - it is what gets shown.
    """
    words = _NON_ALPHANUMERIC.sub(" ", (raw or "").casefold()).split()
    while words and words[-1] in _LEGAL_SUFFIXES:
        words.pop()
    return " ".join(words)


class Supplier(BaseModel):
    """One business the restaurant buys from.

    Created by a person, never by a scan. A supplier invented from a misread
    line is a permanent piece of rubbish in every filter and report that
    follows, and a misread is exactly what an unreviewed scan produces - so
    scanning only ever *matches* an existing supplier (see
    services.suppliers.match_supplier) and leaves the rest to review.
    """

    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="suppliers"
    )
    name = models.CharField(max_length=200)
    #: Derived from `name` on every save - the column the matcher looks at.
    normalized_name = models.CharField(max_length=200, editable=False)
    contact_email = models.EmailField(blank=True, default="")
    contact_phone = models.CharField(max_length=32, blank=True, default="")
    notes = models.CharField(max_length=500, blank=True, default="")
    #: Deactivated rather than deleted, so past invoices keep naming who
    #: supplied them.
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=("restaurant", "normalized_name"),
                name="unique_supplier_per_restaurant",
            )
        ]

    def save(self, *args, **kwargs):
        self.normalized_name = normalize_supplier_name(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name
