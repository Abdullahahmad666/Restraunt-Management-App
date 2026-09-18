"""Compliance models, split by what they represent rather than dumped in
one file - see each submodule's own docstring.

instances.py and corrective.py are still empty: neither the opening/
closing routines nor the daily/weekly/monthly checklists need per-staff
task assignment (results.py's docstring covers why completions are shared
rather than per-staff-member) or a fail-requires-fix-before-close rule
yet. Fill them in if either lands later.
"""

from .results import (
    ChecklistCompletion,
    ChecklistTaskCompletion,
    TemperatureReading,
)
from .templates import (
    CHECKLIST_FREQUENCY_CHOICES,
    COMPLIANCE_ROUTINE_CHOICES,
    FRIDGE_UNIT_KIND_CHOICES,
    ChecklistFrequency,
    ChecklistItem,
    ChecklistTask,
    ChecklistTemplate,
    FridgeUnit,
    Routine,
)

__all__ = [
    "CHECKLIST_FREQUENCY_CHOICES",
    "COMPLIANCE_ROUTINE_CHOICES",
    "FRIDGE_UNIT_KIND_CHOICES",
    "ChecklistCompletion",
    "ChecklistFrequency",
    "ChecklistItem",
    "ChecklistTask",
    "ChecklistTaskCompletion",
    "ChecklistTemplate",
    "FridgeUnit",
    "Routine",
    "TemperatureReading",
]
