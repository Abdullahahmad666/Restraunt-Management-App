"""Restaurants, branches, tables and menus.

`Restaurant` is the tenant boundary: almost every other model in the project
hangs off one, and permissions are ultimately "does this user's restaurant match
this object's restaurant".
"""

from django.conf import settings
from django.db import models
from django.utils.text import slugify

from apps.common.models import BaseModel


class Restaurant(BaseModel):
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    timezone = models.CharField(max_length=64, default="UTC")
    currency = models.CharField(max_length=3, default="PKR")
    is_active = models.BooleanField(default=True)

    # Set False the moment a manager self-registers a brand new takeaway (see
    # RegisterSerializer) - a public endpoint anyone can call to create a
    # tenant needs a human gate before that tenant is actually usable. There
    # is no in-app reviewer for this: it is reviewed and toggled from Django
    # Admin by whoever runs the platform (see RestaurantAdmin's "Approve"
    # action), not through the REST API at all.
    is_approved = models.BooleanField(default=False)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self._unique_slug()
        super().save(*args, **kwargs)

    def _unique_slug(self) -> str:
        """slug is unique, but name is not - "The Kitchen" and "Golden Spice"
        are common enough that two unrelated restaurants sharing a name is a
        real scenario, not an edge case, now that registration lets anyone
        create one by typing a name. Number the slug rather than fail."""
        base = slugify(self.name)[:220]
        slug = base
        suffix = 1
        while Restaurant.objects.filter(slug=slug).exclude(pk=self.pk).exists():
            suffix += 1
            slug = f"{base}-{suffix}"[:220]
        return slug


class Table(BaseModel):
    """A physical table. Orders are opened against one."""

    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name="tables")
    number = models.CharField(max_length=16)
    seats = models.PositiveSmallIntegerField(default=2)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("restaurant", "number")
        constraints = [
            models.UniqueConstraint(
                fields=("restaurant", "number"), name="unique_table_number_per_restaurant"
            )
        ]

    def __str__(self):
        return f"{self.restaurant.name} - table {self.number}"
