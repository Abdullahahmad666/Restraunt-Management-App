"""Serializers and querysets for the attendance app that both roles share."""

from rest_framework import serializers

from apps.attendance import models


class BaseAttendanceLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.AttendanceLog
        fields = (
            "id",
            "staff",
            "shift",
            "clock_in_at",
            "clock_in_latitude",
            "clock_in_longitude",
            "clock_out_at",
            "clock_out_latitude",
            "clock_out_longitude",
            "status",
            "is_manual_override",
        )
        read_only_fields = fields


class BaseShiftSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Shift
        fields = ("id", "staff", "starts_at", "ends_at", "job_title", "notes")
        read_only_fields = ("id",)
