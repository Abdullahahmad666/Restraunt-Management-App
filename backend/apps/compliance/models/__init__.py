"""Compliance models, split by what they represent rather than dumped in
one file - see each submodule's own docstring.

instances.py and corrective.py are still empty: task-instance assignment
and corrective actions aren't part of the opening/closing routines built
so far (see results.py's docstring for why completions are shared rather
than per-staff-member, which is what made instances.py's original
per-staff-assignment idea unnecessary here). Fill them in when daily/
weekly/monthly checklists or a fail-requires-fix-before-close rule land.
"""

from .results import ChecklistCompletion, TemperatureReading
from .templates import (
    COMPLIANCE_ROUTINE_CHOICES,
    FRIDGE_UNIT_KIND_CHOICES,
    ChecklistItem,
    FridgeUnit,
    Routine,
)

__all__ = [
    "COMPLIANCE_ROUTINE_CHOICES",
    "FRIDGE_UNIT_KIND_CHOICES",
    "ChecklistCompletion",
    "ChecklistItem",
    "FridgeUnit",
    "Routine",
    "TemperatureReading",
]
