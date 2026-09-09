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
            "note",
        )
        read_only_fields = fields


class BaseShiftSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Shift
        fields = ("id", "staff", "starts_at", "ends_at", "job_title", "notes")
        read_only_fields = ("id",)


class BaseShiftSwapRequestSerializer(serializers.ModelSerializer):
    """Read shape for both roles - who asked, who's being asked, the shift in
    question, and where the request stands. Names and the shift's own window
    are flattened in as SerializerMethodFields so neither screen has to make
    a second request just to show who "target_staff" actually is."""

    requested_by_name = serializers.SerializerMethodField()
    target_staff_name = serializers.SerializerMethodField()
    shift_starts_at = serializers.DateTimeField(source="shift.starts_at", read_only=True)
    shift_ends_at = serializers.DateTimeField(source="shift.ends_at", read_only=True)
    shift_job_title = serializers.CharField(source="shift.job_title", read_only=True)

    class Meta:
        model = models.ShiftSwapRequest
        fields = (
            "id",
            "shift",
            "shift_starts_at",
            "shift_ends_at",
            "shift_job_title",
            "requested_by",
            "requested_by_name",
            "target_staff",
            "target_staff_name",
            "status",
            "note",
            "decision_note",
            "decided_by",
            "decided_at",
            "created_at",
        )
        read_only_fields = fields

    def get_requested_by_name(self, obj) -> str:
        return obj.requested_by.get_full_name() or obj.requested_by.email

    def get_target_staff_name(self, obj) -> str:
        return obj.target_staff.get_full_name() or obj.target_staff.email
