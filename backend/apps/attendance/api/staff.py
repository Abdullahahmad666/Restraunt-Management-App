"""What a staff member may see and do in the attendance app.

Mounted at /api/v1/staff/attendance/.
"""

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, serializers, viewsets
from rest_framework.exceptions import PermissionDenied as DRFPermissionDenied
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.attendance import models
from apps.attendance.services import scan as scan_service

from .common import BaseAttendanceLogSerializer, BaseShiftSerializer


class StaffShiftViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """A staff member's own rota. Read-only - the rota is admin's to set."""

    serializer_class = BaseShiftSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "head", "options"]

    def get_queryset(self):
        # drf_spectacular introspects this with an anonymous "fake" request to
        # build the schema - self.request.user would be AnonymousUser there,
        # which has no id to filter by.
        if getattr(self, "swagger_fake_view", False):
            return models.Shift.objects.none()
        return models.Shift.objects.filter(staff=self.request.user).order_by("-starts_at")


class StaffAttendanceLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """A staff member's own clock-in/out history."""

    serializer_class = BaseAttendanceLogSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "head", "options"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return models.AttendanceLog.objects.none()
        return models.AttendanceLog.objects.filter(staff=self.request.user).order_by("-clock_in_at")


class ScanSerializer(serializers.Serializer):
    token = serializers.UUIDField()
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6)


class ScanResultSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["check_in", "check_out"])
    log = BaseAttendanceLogSerializer()


class ScanView(APIView):
    """POST the venue QR token plus the phone's current GPS position.

    Scans alternate: the first scan of the day clocks a staff member in, the
    next one clocks them out. There is no separate check-in/check-out
    endpoint because the app never needs to know which one it is asking for
    - see apps.attendance.services.scan.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(request=ScanSerializer, responses=ScanResultSerializer)
    def post(self, request):
        serializer = ScanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            result = scan_service.scan(staff=request.user, **serializer.validated_data)
        except DjangoValidationError as exc:
            raise DRFValidationError(getattr(exc, "messages", str(exc))) from exc
        except DjangoPermissionDenied as exc:
            raise DRFPermissionDenied(str(exc)) from exc

        return Response(
            {"action": result.action, "log": BaseAttendanceLogSerializer(result.log).data}
        )
