"""Serializers and querysets for the payroll app that both roles share."""

from rest_framework import serializers

from apps.payroll import models


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
