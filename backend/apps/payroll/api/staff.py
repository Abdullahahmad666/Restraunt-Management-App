"""What a staff member may see and do in the payroll app.

Mounted at /api/v1/staff/payroll/.

This used to be intentionally empty ("staff have no payroll endpoints"), but
the check-in/check-out feature requires staff to see their own hours and pay.
Kept strictly read-only and strictly scoped to the caller's own entries -
rate changes and pay-period actions stay admin-only, in api/admin.py.
"""

from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from apps.payroll import models

from .common import BasePayrollEntrySerializer


class StaffPayrollEntryViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """A staff member's own pay history, one row per pay period."""

    serializer_class = BasePayrollEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return models.PayrollEntry.objects.filter(staff=self.request.user).select_related("pay_period")
