"""Restaurants, branches, tables and menus.

`Restaurant` is the tenant boundary: almost every other model in the project
hangs off one, and permissions are ultimately "does this user's restaurant match
this object's restaurant".
"""

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

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)[:220]
        super().save(*args, **kwargs)


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
