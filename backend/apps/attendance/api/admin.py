"""What an admin may see and do in the attendance app.

Mounted at /api/v1/admin/attendance/.
"""

import uuid

from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.attendance import models, selectors
from apps.common.api.fields import LatitudeField, LongitudeField
from apps.common.api.viewsets import AdminViewSet, RestaurantScopedQuerysetMixin

from .common import BaseAttendanceLogSerializer, BaseShiftSerializer


class AdminShiftSerializer(BaseShiftSerializer):
    class Meta(BaseShiftSerializer.Meta):
        fields = (
            *BaseShiftSerializer.Meta.fields,
            "restaurant",
            "reminder_sent_at",
            "created_by",
        )
        read_only_fields = (
            *BaseShiftSerializer.Meta.read_only_fields,
            # Both set server-side in perform_create/the reminder command, not
            # supplied by the client - without read_only here, DRF demands
            # them on every create and every shift request 400s.
            "restaurant",
            "reminder_sent_at",
            "created_by",
        )


class AdminShiftViewSet(RestaurantScopedQuerysetMixin, AdminViewSet):
    """The rota: create, move and cancel shifts for the caller's restaurant."""

    serializer_class = AdminShiftSerializer
    queryset = models.Shift.objects.select_related("staff")
    filterset_fields = ("staff",)

    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant, created_by=self.request.user)


class AdminAttendanceLogSerializer(BaseAttendanceLogSerializer):
    """Corrections only touch times, the matched shift and status.

    GPS coordinates and who the log belongs to stay read-only - they are
    what was actually recorded at scan time, not something a correction
    should be able to rewrite.
    """

    class Meta(BaseAttendanceLogSerializer.Meta):
        read_only_fields = (
            "id",
            "staff",
            "clock_in_latitude",
            "clock_in_longitude",
            "clock_out_latitude",
            "clock_out_longitude",
            "is_manual_override",
        )

    def validate(self, attrs):
        instance = self.instance
        clock_in_at = attrs.get("clock_in_at", instance.clock_in_at if instance else None)
        clock_out_at = attrs.get("clock_out_at", instance.clock_out_at if instance else None)
        if clock_in_at and clock_out_at and clock_out_at <= clock_in_at:
            raise serializers.ValidationError("Clock-out must be after clock-in.")
        return attrs


class AdminAttendanceLogViewSet(RestaurantScopedQuerysetMixin, AdminViewSet):
    """Review and correct clock-in/out records for the caller's restaurant."""

    serializer_class = AdminAttendanceLogSerializer
    queryset = models.AttendanceLog.objects.select_related("staff", "shift")
    filterset_fields = ("staff", "status")
    http_method_names = ["get", "patch", "head", "options"]

    def perform_update(self, serializer):
        serializer.save(is_manual_override=True, edited_by=self.request.user)

    @action(detail=False, methods=["get"])
    def live(self, request):
        """Who is currently clocked in, right now."""
        logs = selectors.currently_clocked_in(restaurant=request.user.restaurant)
        return Response(BaseAttendanceLogSerializer(logs, many=True).data)


class AdminVenueQRCodeSerializer(serializers.ModelSerializer):
    # Same reason as the scan endpoint: the admin's phone supplies the venue
    # position from its own GPS, at whatever precision it happens to have.
    latitude = LatitudeField()
    longitude = LongitudeField()

    class Meta:
        model = models.VenueQRCode
        fields = (
            "id",
            "restaurant",
            "token",
            "latitude",
            "longitude",
            "radius_meters",
            "is_active",
        )
        read_only_fields = ("id", "token")


class AdminVenueQRCodeViewSet(RestaurantScopedQuerysetMixin, AdminViewSet):
    """One QR code per restaurant, printed and displayed at the venue."""

    serializer_class = AdminVenueQRCodeSerializer
    queryset = models.VenueQRCode.objects.all()

    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant)

    @action(detail=True, methods=["post"])
    def regenerate(self, request, pk=None):
        """Rotate the token, e.g. after a lost/leaked printout - the old code stops working."""
        qr_code = self.get_object()
        qr_code.token = uuid.uuid4()
        qr_code.save(update_fields=["token", "updated_at"])
        return Response(self.get_serializer(qr_code).data)
