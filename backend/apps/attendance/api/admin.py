"""What an admin may see and do in the attendance app.

Mounted at /api/v1/admin/attendance/.
"""

import uuid

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.exceptions import MethodNotAllowed
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response

from apps.attendance import models, selectors
from apps.attendance.services import swap as swap_service
from apps.common.api.fields import LatitudeField, LongitudeField
from apps.common.api.viewsets import AdminViewSet, RestaurantScopedQuerysetMixin
from apps.notifications.services.rules import (
    notify_shift_added,
    notify_shift_cancelled,
    notify_shift_updated,
    notify_swap_decided,
)

from .common import BaseAttendanceLogSerializer, BaseShiftSerializer, BaseShiftSwapRequestSerializer


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
        shift = serializer.save(
            restaurant=self.request.user.restaurant, created_by=self.request.user
        )
        notify_shift_added(shift)

    def perform_update(self, serializer):
        shift = serializer.save()
        notify_shift_updated(shift)

    def perform_destroy(self, instance):
        staff, starts_at = instance.staff, instance.starts_at
        instance.delete()
        notify_shift_cancelled(staff=staff, starts_at=starts_at)


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


class DecisionNoteSerializer(serializers.Serializer):
    decision_note = serializers.CharField(required=False, allow_blank=True, max_length=255)


class AdminShiftSwapRequestViewSet(RestaurantScopedQuerysetMixin, AdminViewSet):
    """Every swap request raised by the caller's restaurant's staff, and the
    approve/decline decision on each - read-only otherwise, since a manager
    reacts to a request rather than editing one.

    "post" stays in http_method_names for the approve/decline actions below,
    which are their own detail routes - so create() is disabled explicitly
    rather than by verb, or POSTing to the plain list endpoint would still
    reach it and try to save a request with no fields (every field on
    BaseShiftSwapRequestSerializer is read-only; requests are only ever made
    from the staff side, via apps.attendance.services.swap.request_swap).
    """

    serializer_class = BaseShiftSwapRequestSerializer
    queryset = models.ShiftSwapRequest.objects.select_related(
        "shift", "requested_by", "target_staff"
    )
    filterset_fields = ("status",)
    http_method_names = ["get", "post", "head", "options"]

    def create(self, request, *args, **kwargs):
        raise MethodNotAllowed("POST")

    def _decide(self, request, *, approve: bool):
        input_serializer = DecisionNoteSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        try:
            swap_request = swap_service.decide_swap(
                swap_request=self.get_object(),
                approve=approve,
                decided_by=request.user,
                decision_note=input_serializer.validated_data.get("decision_note", ""),
            )
        except DjangoValidationError as exc:
            raise DRFValidationError(getattr(exc, "messages", str(exc))) from exc

        notify_swap_decided(swap_request)
        return swap_request

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        swap_request = self._decide(request, approve=True)
        return Response(self.get_serializer(swap_request).data)

    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        swap_request = self._decide(request, approve=False)
        return Response(self.get_serializer(swap_request).data)
