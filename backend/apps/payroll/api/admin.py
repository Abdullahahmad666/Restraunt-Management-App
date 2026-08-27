"""What an admin may see and do in the payroll app.

Mounted at /api/v1/admin/payroll/.
"""

from decimal import Decimal

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.api.viewsets import AdminViewSet, RestaurantScopedQuerysetMixin
from apps.common.permissions import IsAdmin
from apps.payroll import models, selectors
from apps.payroll.services import calculation, pay_periods

from .common import BasePayrollEntrySerializer


class AdminStaffPayRateSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.StaffPayRate
        fields = ("id", "staff", "rate_1", "rate_2")
        read_only_fields = ("id",)


class AdminStaffPayRateViewSet(AdminViewSet):
    """Set a staff member's two pay rates. Every change is kept in RateChange for history."""

    serializer_class = AdminStaffPayRateSerializer
    queryset = models.StaffPayRate.objects.select_related("staff")

    def _record_history(self, instance):
        models.RateChange.objects.create(
            staff=instance.staff,
            rate_1=instance.rate_1,
            rate_2=instance.rate_2,
            effective_from=timezone.localdate(),
            changed_by=self.request.user,
        )

    def perform_create(self, serializer):
        self._record_history(serializer.save())

    def perform_update(self, serializer):
        self._record_history(serializer.save())


class AdminPayPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.PayPeriod
        fields = ("id", "restaurant", "starts_on", "ends_on", "status")
        read_only_fields = ("id", "status")


class AdminPayPeriodViewSet(RestaurantScopedQuerysetMixin, AdminViewSet):
    """Open a pay period, close it (calculating every entry), then mark it paid.

    No destroy route: once staff cost has been calculated for a period, that
    record needs to stay available for review rather than disappear.
    """

    serializer_class = AdminPayPeriodSerializer
    queryset = models.PayPeriod.objects.all()
    http_method_names = ["get", "post", "patch", "head", "options"]

    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        period = pay_periods.close_pay_period(pay_period=self.get_object())
        return Response(AdminPayPeriodSerializer(period).data)

    @action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request, pk=None):
        period = pay_periods.mark_paid(pay_period=self.get_object())
        return Response(AdminPayPeriodSerializer(period).data)

    @action(detail=True, methods=["get"])
    def entries(self, request, pk=None):
        period = self.get_object()
        entries = period.entries.select_related("staff")
        return Response(BasePayrollEntrySerializer(entries, many=True).data)


class ReallocateHoursSerializer(serializers.Serializer):
    hours_at_rate_1 = serializers.DecimalField(max_digits=6, decimal_places=2)
    hours_at_rate_2 = serializers.DecimalField(max_digits=6, decimal_places=2)


class AdminPayrollEntryViewSet(RestaurantScopedQuerysetMixin, AdminViewSet):
    """Review calculated pay and, where needed, re-split hours between rate 1 and rate 2."""

    serializer_class = BasePayrollEntrySerializer
    queryset = models.PayrollEntry.objects.select_related("staff", "pay_period")
    filterset_fields = ("staff", "pay_period")
    # No "post": that would also expose the inherited create() route on the
    # list endpoint, which is not wanted here - entries only come from
    # calculate_entry(). reallocate is a PATCH for the same reason.
    http_method_names = ["get", "patch", "head", "options"]
    restaurant_field = "pay_period__restaurant_id"

    @action(detail=True, methods=["patch"])
    def reallocate(self, request, pk=None):
        serializer = ReallocateHoursSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = calculation.reallocate_hours(entry=self.get_object(), **serializer.validated_data)
        return Response(BasePayrollEntrySerializer(entry).data)


class StaffCostRowSerializer(serializers.Serializer):
    staff_id = serializers.UUIDField()
    staff_name = serializers.CharField()
    hours = serializers.DecimalField(max_digits=8, decimal_places=2)
    total_pay = serializers.DecimalField(max_digits=10, decimal_places=2)


class StaffCostReportSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField()
    total = serializers.DecimalField(max_digits=10, decimal_places=2)
    by_staff = StaffCostRowSerializer(many=True)


class StaffCostReportView(APIView):
    """GET ?year=2026&month=8 - total staff cost for the caller's restaurant that month, per employee."""

    permission_classes = [IsAdmin]

    @extend_schema(responses=StaffCostReportSerializer)
    def get(self, request):
        year = int(request.query_params.get("year"))
        month = int(request.query_params.get("month"))
        rows = selectors.monthly_cost(restaurant=request.user.restaurant, year=year, month=month)

        by_staff = [
            {
                "staff_id": row["staff"].id,
                "staff_name": row["staff"].get_full_name() or row["staff"].email,
                "hours": row["hours"],
                "total_pay": row["total_pay"],
            }
            for row in rows
        ]

        return Response(
            {
                "year": year,
                "month": month,
                "total": sum((row["total_pay"] for row in by_staff), Decimal("0")),
                "by_staff": by_staff,
            }
        )
