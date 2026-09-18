"""Recording a temperature reading or checking off a checklist item.

Both are shared, not personal (see models.results's docstring) - recording
one again doesn't create a second row or reject with "already exists", it
corrects the one row that day already has, carrying forward whoever most
recently touched it. That is the one behaviour that makes the shared-record
model actually usable: a staff member fixing a colleague's typo'd
temperature is the normal case, not an edge case.
"""

from datetime import date as date_type

from django.core.exceptions import ValidationError

from .. import models


def _check_same_restaurant(*, restaurant, obj, label: str) -> None:
    if obj.restaurant_id != restaurant.id:
        raise ValidationError(f"That {label} is not part of your restaurant.")


def record_temperature(
    *,
    restaurant,
    fridge_unit: "models.FridgeUnit",
    routine: str,
    date: date_type,
    celsius,
    recorded_by,
) -> "models.TemperatureReading":
    _check_same_restaurant(restaurant=restaurant, obj=fridge_unit, label="fridge/freezer")

    reading, _created = models.TemperatureReading.objects.update_or_create(
        fridge_unit=fridge_unit,
        routine=routine,
        date=date,
        defaults={
            "restaurant": restaurant,
            "celsius": celsius,
            "recorded_by": recorded_by,
        },
    )
    return reading


def complete_checklist_item(
    *, restaurant, checklist_item: "models.ChecklistItem", date: date_type, completed_by
) -> "models.ChecklistCompletion":
    """Idempotent on purpose: if it's already done today, this just returns
    the existing record rather than erroring - two staff tapping the same
    item within a second of each other is a race worth shrugging off, not
    surfacing as a failure to either of them."""
    _check_same_restaurant(restaurant=restaurant, obj=checklist_item, label="checklist item")

    completion, _created = models.ChecklistCompletion.objects.get_or_create(
        checklist_item=checklist_item,
        date=date,
        defaults={"restaurant": restaurant, "completed_by": completed_by},
    )
    return completion


def uncomplete_checklist_item(*, restaurant, completion: "models.ChecklistCompletion") -> None:
    _check_same_restaurant(restaurant=restaurant, obj=completion, label="checklist completion")
    completion.delete()
