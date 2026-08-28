"""What a staff member may see and do in the payroll app.

Mounted at /api/v1/staff/payroll/.

This used to be intentionally empty ("staff have no payroll endpoints"), but
the check-in/check-out feature requires staff to see their own hours and pay.
Kept strictly read-only and strictly scoped to the caller's own entries -
rate changes and pay-period actions stay admin-only, in api/admin.py.
"""

from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.payroll import models, selectors

from .common import (
    BasePayrollEntrySerializer,
    StaffSummarySerializer,
    build_staff_summary_response,
    parse_summary_range,
)


class MySummaryView(APIView):
    """GET the caller's own rota, off days, pay rates and pay history in one place.

    Same shape as the admin staff-summary endpoint, scoped to whoever is
    logged in - there's no staff_id to pass, it can only ever be "me".
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(responses=StaffSummarySerializer)
    def get(self, request):
        start, end = parse_summary_range(request)
        summary = selectors.staff_summary(staff=request.user, start=start, end=end)
        return Response(build_staff_summary_response(summary))


class StaffPayrollEntryViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """A staff member's own pay history, one row per pay period."""

    serializer_class = BasePayrollEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return models.PayrollEntry.objects.none()
        return models.PayrollEntry.objects.filter(staff=self.request.user).select_related(
            "pay_period"
        )
