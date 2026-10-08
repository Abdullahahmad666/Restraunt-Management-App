"""What a supplier calls something, against what we call it.

A supplier writes "HZ TOM KTCHP 2.5L"; the restaurant counts "Ketchup". Nothing
connects those two strings except a person who once said so - and without
somewhere to record that, the same person says it again on every delivery,
forever.

This is that record. It is the difference between a feature that gets slower to
use the more you use it and one that gets faster.
"""

import re

from django.db import models

from apps.common.models import BaseModel

from .items import InventoryItem

_NON_ALPHANUMERIC = re.compile(r"[^a-z0-9]+")


def normalize_item_text(raw: str) -> str:
    """Reduce a line's text to a key two printings of it agree on.

    Deliberately shallow: case, punctuation and spacing only. Stripping sizes
    or units would merge "Tomatoes 5kg" and "Tomatoes 10kg", which arrive as
    different lines at different prices and are worth telling apart. Each
    earns its own alias instead.
    """
    return " ".join(_NON_ALPHANUMERIC.sub(" ", (raw or "").casefold()).split())


class ItemAlias(BaseModel):
    """One supplier's wording for one inventory item.

    Learned on confirmation rather than while reviewing: confirming is the
    point where a person accepted the whole invoice, whereas a half-finished
    review is full of matches someone is still in the middle of correcting.
    """

    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="item_aliases"
    )
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="aliases")
    #: The wording as it appeared, kept so a human can see what was learned.
    text = models.CharField(max_length=255)
    normalized_text = models.CharField(max_length=255, editable=False)

    class Meta:
        ordering = ("text",)
        constraints = [
            # One meaning per wording. If a restaurant later decides that
            # wording means something else, the alias is updated rather than
            # duplicated - two answers to the same question is how a line gets
            # matched to whichever row happened to be found first.
            models.UniqueConstraint(
                fields=("restaurant", "normalized_text"), name="unique_item_alias_per_restaurant"
            )
        ]

    def save(self, *args, **kwargs):
        self.normalized_text = normalize_item_text(self.text)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.text} -> {self.item_id}"
