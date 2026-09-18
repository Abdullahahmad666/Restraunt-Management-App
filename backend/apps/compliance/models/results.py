"""What happened: a temperature reading or a checked-off checklist item.

Both are one shared row per (thing, day) - not one per staff member. A
restaurant's whole opening or closing routine is one physical checklist in
real life, worked through by whoever's around; modelling it as one row
per staff member would mean everyone keeping their own separate copy and
never seeing what a colleague already did. Recording it again just
corrects the existing row (see apps.compliance.services.completion),
carrying forward whoever most recently touched it.
"""

from django.conf import settings
from django.db import models

from apps.common.models import BaseModel

from .templates import ChecklistItem, FridgeUnit, Routine


class TemperatureReading(BaseModel):
    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="temperature_readings"
    )
    fridge_unit = models.ForeignKey(FridgeUnit, on_delete=models.CASCADE, related_name="readings")
    routine = models.CharField(max_length=16, choices=Routine.choices)
    date = models.DateField()
    celsius = models.DecimalField(max_digits=4, decimal_places=1)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    recorded_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("fridge_unit", "routine", "date"),
                name="one_reading_per_fridge_routine_day",
            )
        ]
        ordering = ("-date",)

    @property
    def is_within_range(self) -> bool:
        return self.celsius <= self.fridge_unit.recommended_max_celsius

    def __str__(self):
        return f"{self.fridge_unit_id} {self.routine} {self.date}: {self.celsius}C"


class ChecklistCompletion(BaseModel):
    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="checklist_completions"
    )
    checklist_item = models.ForeignKey(
        ChecklistItem, on_delete=models.CASCADE, related_name="completions"
    )
    date = models.DateField()
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("checklist_item", "date"), name="one_completion_per_item_per_day"
            )
        ]
        ordering = ("-date",)

    def __str__(self):
        return f"{self.checklist_item_id} done {self.date}"
