"""Serializers and querysets for the payroll app that both roles share."""

from datetime import date, timedelta

from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from apps.attendance.api.common import BaseShiftSerializer
from apps.payroll import models

# Long enough to comfortably cover two pay runs in a month, short enough that
# a summary screen isn't quietly loading someone's entire work history by
# default.
DEFAULT_SUMMARY_WINDOW_DAYS = 60


class BasePayrollEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = models.PayrollEntry
        fields = (
            "id",
            "pay_period",
            "staff",
            "hours_worked",
            "hours_at_rate_1",
            "hours_at_rate_2",
            "rate_1_snapshot",
            "rate_2_snapshot",
            "total_pay",
        )
        read_only_fields = fields


class PayPeriodEntrySerializer(BasePayrollEntrySerializer):
    """One pay period's worth of hours and pay, with the period's own dates and
    status flattened in - a bare pay_period id isn't useful on a summary
    screen that's meant to show "1st pay run in August" next to "2nd"."""

    pay_period_starts_on = serializers.DateField(source="pay_period.starts_on", read_only=True)
    pay_period_ends_on = serializers.DateField(source="pay_period.ends_on", read_only=True)
    pay_period_status = serializers.CharField(source="pay_period.status", read_only=True)

    class Meta(BasePayrollEntrySerializer.Meta):
        fields = (
            *BasePayrollEntrySerializer.Meta.fields,
            "pay_period_starts_on",
            "pay_period_ends_on",
            "pay_period_status",
        )
        read_only_fields = fields


class StaffInfoSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    email = serializers.EmailField()


class PayRatesSerializer(serializers.Serializer):
    rate_1 = serializers.DecimalField(max_digits=8, decimal_places=2, allow_null=True)
    rate_2 = serializers.DecimalField(max_digits=8, decimal_places=2, allow_null=True)


class DateRangeSerializer(serializers.Serializer):
    start = serializers.DateField()
    end = serializers.DateField()


class StaffTotalsSerializer(serializers.Serializer):
    hours_worked_lifetime = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_pay_received = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_pay_pending = serializers.DecimalField(max_digits=10, decimal_places=2)


class StaffSummarySerializer(serializers.Serializer):
    """Response shape of build_staff_summary_response() below - exists purely
    so drf-spectacular can describe the two summary endpoints; nothing
    constructs one of these directly."""

    staff = StaffInfoSerializer()
    pay_rates = PayRatesSerializer()
    range = DateRangeSerializer()
    shifts = BaseShiftSerializer(many=True)
    off_days = serializers.ListField(child=serializers.DateField())
    pay_periods = PayPeriodEntrySerializer(many=True)
    totals = StaffTotalsSerializer()


def parse_summary_range(request) -> tuple[date, date]:
    """?start=YYYY-MM-DD&end=YYYY-MM-DD, defaulting to the last 60 days."""
    today = timezone.localdate()
    start, end = today - timedelta(days=DEFAULT_SUMMARY_WINDOW_DAYS), today
    try:
        if request.query_params.get("start"):
            start = date.fromisoformat(request.query_params["start"])
        if request.query_params.get("end"):
            end = date.fromisoformat(request.query_params["end"])
    except ValueError as exc:
        raise ValidationError("start and end must be dates in YYYY-MM-DD format.") from exc

    if end < start:
        raise ValidationError("end must not be before start.")

    return start, end


def build_staff_summary_response(summary: dict) -> dict:
    """Shape a payroll.selectors.staff_summary() dict into the JSON both the
    admin and the staff summary endpoints return - one place so the two
    screens can never quietly drift apart."""
    staff = summary["staff"]
    return {
        "staff": {
            "id": staff.id,
            "name": staff.get_full_name() or staff.email,
            "email": staff.email,
        },
        "pay_rates": {"rate_1": summary["rate_1"], "rate_2": summary["rate_2"]},
        "range": {"start": summary["range_start"], "end": summary["range_end"]},
        "shifts": BaseShiftSerializer(summary["shifts"], many=True).data,
        "off_days": summary["off_days"],
        "pay_periods": PayPeriodEntrySerializer(summary["entries"], many=True).data,
        "totals": {
            "hours_worked_lifetime": summary["hours_worked_lifetime"],
            "total_pay_received": summary["total_pay_received"],
            "total_pay_pending": summary["total_pay_pending"],
        },
    }
