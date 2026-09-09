"""What a staff member may see and do in the attendance app.

Mounted at /api/v1/staff/attendance/.
"""

from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied as DRFPermissionDenied
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.attendance import models
from apps.attendance.services import scan as scan_service
from apps.attendance.services import swap as swap_service
from apps.common.api.fields import LatitudeField, LongitudeField
from apps.common.api.viewsets import RestaurantScopedQuerysetMixin
from apps.common.permissions import IsStaff
from apps.notifications.services.rules import notify_swap_requested

from .common import BaseAttendanceLogSerializer, BaseShiftSerializer, BaseShiftSwapRequestSerializer

User = get_user_model()


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


class StaffAttendanceLogSerializer(BaseAttendanceLogSerializer):
    """Same fields as the shared serializer, but note is the staff member's own
    to write - everything else about a log is either what was actually
    recorded at scan time or an admin's correction to make."""

    class Meta(BaseAttendanceLogSerializer.Meta):
        read_only_fields = tuple(
            field for field in BaseAttendanceLogSerializer.Meta.fields if field != "note"
        )


class StaffAttendanceLogViewSet(
    mixins.ListModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet
):
    """A staff member's own clock-in/out history, plus their own note on it."""

    serializer_class = StaffAttendanceLogSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]
    filterset_fields = ("status",)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return models.AttendanceLog.objects.none()
        return models.AttendanceLog.objects.filter(staff=self.request.user).order_by("-clock_in_at")


class ScanSerializer(serializers.Serializer):
    token = serializers.UUIDField()
    # Rounded rather than rejected - a phone posts the precision its GPS gives,
    # which is far more than six decimal places. See CoordinateField.
    latitude = LatitudeField()
    longitude = LongitudeField()


class ScanResultSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["check_in", "check_out", "already_checked_in"])
    log = BaseAttendanceLogSerializer()


class ScanView(APIView):
    """POST the venue QR token plus the phone's current GPS position.

    Scans alternate: the first scan of the day clocks a staff member in, the
    next one clocks them out - unless that next scan comes in under
    scan_service.MIN_TIME_BEFORE_CHECKOUT of the check-in, in which case
    nothing changes and the response says so (see "already_checked_in"
    below). There is no separate check-in/check-out endpoint because the app
    never needs to know which one it's asking for - see
    apps.attendance.services.scan.
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
            {
                "action": result.action,
                "log": BaseAttendanceLogSerializer(result.log).data,
            }
        )


class StaffColleagueSerializer(serializers.ModelSerializer):
    """Just enough to pick someone from a list - a staff member choosing who
    to offer their shift to has no business seeing a colleague's pay rate or
    phone number, unlike the admin roster."""

    class Meta:
        model = User
        fields = ("id", "first_name", "last_name")
        read_only_fields = fields


class StaffColleagueViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Other active staff at the caller's own restaurant - who a shift swap
    request can be offered to. Read-only, and deliberately thin (see
    StaffColleagueSerializer): this exists to populate a picker, not to give
    staff visibility into each other's accounts."""

    serializer_class = StaffColleagueSerializer
    permission_classes = [IsStaff]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return User.objects.none()
        from apps.common.roles import Role

        return User.objects.filter(
            restaurant_id=self.request.user.restaurant_id, role=Role.STAFF, is_active=True
        ).exclude(id=self.request.user.id)


class CreateShiftSwapRequestSerializer(serializers.Serializer):
    """Write shape for requesting a swap - just the three things a staff
    member actually supplies. Everything else (status, who decided, when)
    only exists once a manager acts on it."""

    shift = serializers.PrimaryKeyRelatedField(queryset=models.Shift.objects.all())
    target_staff = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    note = serializers.CharField(required=False, allow_blank=True, max_length=255)


class StaffShiftSwapRequestViewSet(
    RestaurantScopedQuerysetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """A staff member's own swap requests - the ones they made, and the ones
    asking them to cover someone else's shift."""

    serializer_class = BaseShiftSwapRequestSerializer
    permission_classes = [IsStaff]
    queryset = models.ShiftSwapRequest.objects.select_related(
        "shift", "requested_by", "target_staff"
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        return queryset.filter(Q(requested_by=user) | Q(target_staff=user))

    def create(self, request, *args, **kwargs):
        input_serializer = CreateShiftSwapRequestSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        try:
            swap_request = swap_service.request_swap(
                requester=request.user, **input_serializer.validated_data
            )
        except DjangoValidationError as exc:
            raise DRFValidationError(getattr(exc, "messages", str(exc))) from exc
        except DjangoPermissionDenied as exc:
            raise DRFPermissionDenied(str(exc)) from exc

        notify_swap_requested(swap_request)
        return Response(self.get_serializer(swap_request).data, status=201)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        try:
            swap_request = swap_service.cancel_swap(
                swap_request=self.get_object(), cancelled_by=request.user
            )
        except DjangoValidationError as exc:
            raise DRFValidationError(getattr(exc, "messages", str(exc))) from exc
        except DjangoPermissionDenied as exc:
            raise DRFPermissionDenied(str(exc)) from exc

        return Response(self.get_serializer(swap_request).data)
