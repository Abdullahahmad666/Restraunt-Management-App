"""Recording a temperature reading or checking off a checklist item.

Both are shared, not personal (see models.results's docstring) - recording
one again doesn't create a second row or reject with "already exists", it
corrects the one row that day already has, carrying forward whoever most
recently touched it. That is the one behaviour that makes the shared-record
model actually usable: a staff member fixing a colleague's typo'd
temperature is the normal case, not an edge case.
"""

from datetime import date as date_type
from datetime import timedelta

from django.core.exceptions import ValidationError

from .. import models


def _check_same_restaurant(*, restaurant, obj, label: str) -> None:
    if obj.restaurant_id != restaurant.id:
        raise ValidationError(f"That {label} is not part of your restaurant.")


def current_period_start(*, frequency: str, today: date_type) -> date_type:
    """The one place that decides what "this period" means for a daily/
    weekly/monthly checklist task, so neither the API layer nor a mobile
    client has to replicate it (and risk landing on a different Monday than
    the server did). Weeks start Monday - Python's own date.weekday()
    convention, so there's no separate lookup table to keep in sync with it.
    """
    if frequency == models.ChecklistFrequency.DAILY:
        return today
    if frequency == models.ChecklistFrequency.WEEKLY:
        return today - timedelta(days=today.weekday())
    if frequency == models.ChecklistFrequency.MONTHLY:
        return today.replace(day=1)
    raise ValueError(f"Unknown checklist frequency: {frequency!r}")


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


def complete_checklist_task(
    *, restaurant, task: "models.ChecklistTask", completed_by, today: date_type
) -> "models.ChecklistTaskCompletion":
    """Same idempotent, shared behaviour as complete_checklist_item - see
    its docstring. The only extra step is working out which period (today/
    this week/this month, per the task's template) the completion belongs
    to, via current_period_start. `today` comes from the caller (the API
    view, via timezone.localdate()) rather than being computed in here, the
    same way record_temperature and complete_checklist_item take `date`."""
    _check_same_restaurant(restaurant=restaurant, obj=task, label="checklist task")

    period_start = current_period_start(frequency=task.template.frequency, today=today)
    completion, _created = models.ChecklistTaskCompletion.objects.get_or_create(
        task=task,
        period_start=period_start,
        defaults={"restaurant": restaurant, "completed_by": completed_by},
    )
    return completion


def uncomplete_checklist_task(*, restaurant, completion: "models.ChecklistTaskCompletion") -> None:
    _check_same_restaurant(restaurant=restaurant, obj=completion, label="checklist task completion")
    completion.delete()
