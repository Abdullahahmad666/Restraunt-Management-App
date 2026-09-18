"""What a check IS: fridge/freezer units and checklist item definitions -
both admin-managed, both shared by the whole restaurant rather than owned
by whoever created them."""

from django.db import models

from apps.common.models import BaseModel


class Routine(models.TextChoices):
    """Which end of the day a check belongs to. Deliberately just these two
    for now - see the module docstring in results.py for why daily/weekly/
    monthly checklists aren't modelled as a Routine."""

    OPENING = "OPENING", "Opening"
    CLOSING = "CLOSING", "Closing"


class FridgeUnit(BaseModel):
    """One fridge or freezer a manager has registered - a name and an
    optional photo so staff can tell "Fridge 1" from "the one by the back
    door", and the temperature it should never be found above."""

    class Kind(models.TextChoices):
        FRIDGE = "FRIDGE", "Fridge"
        FREEZER = "FREEZER", "Freezer"

    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="fridge_units"
    )
    name = models.CharField(max_length=100)
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.FRIDGE)
    photo = models.ImageField(upload_to="fridge_units/", null=True, blank=True)
    # "5C or lower" / "-18C or lower" - a single ceiling covers every real
    # SFBB example; nothing here needs a floor too.
    recommended_max_celsius = models.DecimalField(max_digits=4, decimal_places=1)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("sort_order", "name")

    def __str__(self):
        return f"{self.name} ({self.restaurant_id})"


class ChecklistItem(BaseModel):
    """One line on the opening or closing checklist - "fridges working
    properly", "floors swept" - admin-managed, in the order staff see it."""

    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="checklist_items"
    )
    routine = models.CharField(max_length=16, choices=Routine.choices)
    text = models.CharField(max_length=255)
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("routine", "sort_order")

    def __str__(self):
        return f"{self.get_routine_display()}: {self.text}"


# Flat, top-level names so config.settings.base's ENUM_NAME_OVERRIDES can
# point at them - see the matching comment in apps.attendance.models.
COMPLIANCE_ROUTINE_CHOICES = Routine.choices
FRIDGE_UNIT_KIND_CHOICES = FridgeUnit.Kind.choices
