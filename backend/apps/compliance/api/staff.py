"""What a staff member may see and do in the compliance app.

Mounted at /api/v1/staff/compliance/.
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import mixins, serializers, viewsets
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response

from apps.common.api.viewsets import RestaurantScopedQuerysetMixin
from apps.common.permissions import IsStaff

from .. import models
from ..services import completion as completion_service
from .common import (
    BaseChecklistItemSerializer,
    BaseFridgeUnitSerializer,
    ChecklistCompletionSerializer,
    TemperatureReadingSerializer,
)


class StaffFridgeUnitViewSet(
    RestaurantScopedQuerysetMixin, mixins.ListModelMixin, viewsets.GenericViewSet
):
    """Every active fridge/freezer at the caller's restaurant - read-only, a
    manager sets these up (see AdminFridgeUnitViewSet)."""

    serializer_class = BaseFridgeUnitSerializer
    permission_classes = [IsStaff]
    queryset = models.FridgeUnit.objects.all()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return models.FridgeUnit.objects.none()
        return super().get_queryset().filter(is_active=True)


class StaffChecklistItemViewSet(
    RestaurantScopedQuerysetMixin, mixins.ListModelMixin, viewsets.GenericViewSet
):
    """Every active checklist item at the caller's restaurant, optionally
    filtered to one routine (?routine=OPENING) - read-only, a manager
    maintains the list (see AdminChecklistItemViewSet)."""

    serializer_class = BaseChecklistItemSerializer
    permission_classes = [IsStaff]
    filterset_fields = ("routine",)
    queryset = models.ChecklistItem.objects.all()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return models.ChecklistItem.objects.none()
        return super().get_queryset().filter(is_active=True)


class RecordTemperatureSerializer(serializers.Serializer):
    """Write shape for logging a reading - just what a staff member actually
    supplies. `date` defaults to today so the common case needs nothing
    extra, but stays overridable for whoever eventually builds a history
    view that backfills or corrects an older day."""

    fridge_unit = serializers.PrimaryKeyRelatedField(queryset=models.FridgeUnit.objects.all())
    routine = serializers.ChoiceField(choices=models.Routine.choices)
    date = serializers.DateField(required=False)
    celsius = serializers.DecimalField(max_digits=4, decimal_places=1)


class StaffTemperatureReadingViewSet(
    RestaurantScopedQuerysetMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """Temperature readings for the caller's restaurant, filterable by
    ?date=&routine=&fridge_unit= - shared across the whole team. See
    apps.compliance.services.completion for why POSTing again for the same
    fridge/routine/day corrects the existing reading instead of erroring."""

    serializer_class = TemperatureReadingSerializer
    permission_classes = [IsStaff]
    filterset_fields = ("date", "routine", "fridge_unit")
    queryset = models.TemperatureReading.objects.select_related("recorded_by", "fridge_unit")

    def create(self, request, *args, **kwargs):
        input_serializer = RecordTemperatureSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        data = input_serializer.validated_data
        data.setdefault("date", timezone.localdate())

        try:
            reading = completion_service.record_temperature(
                restaurant=request.user.restaurant, recorded_by=request.user, **data
            )
        except DjangoValidationError as exc:
            raise DRFValidationError(getattr(exc, "messages", str(exc))) from exc

        return Response(self.get_serializer(reading).data, status=201)


class CompleteChecklistItemSerializer(serializers.Serializer):
    checklist_item = serializers.PrimaryKeyRelatedField(queryset=models.ChecklistItem.objects.all())
    date = serializers.DateField(required=False)


class StaffChecklistCompletionViewSet(
    RestaurantScopedQuerysetMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Checked-off checklist items for the caller's restaurant, filterable
    by ?date=&checklist_item= - shared across the whole team. DELETE
    unchecks one (a mistaken tap) - a completion either exists for that day
    or it doesn't, there's nothing else about it to edit."""

    serializer_class = ChecklistCompletionSerializer
    permission_classes = [IsStaff]
    filterset_fields = ("date", "checklist_item")
    http_method_names = ["get", "post", "delete", "head", "options"]
    queryset = models.ChecklistCompletion.objects.select_related("completed_by", "checklist_item")

    def create(self, request, *args, **kwargs):
        input_serializer = CompleteChecklistItemSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        data = input_serializer.validated_data
        data.setdefault("date", timezone.localdate())

        try:
            completion = completion_service.complete_checklist_item(
                restaurant=request.user.restaurant, completed_by=request.user, **data
            )
        except DjangoValidationError as exc:
            raise DRFValidationError(getattr(exc, "messages", str(exc))) from exc

        return Response(self.get_serializer(completion).data, status=201)

    def perform_destroy(self, instance):
        completion_service.uncomplete_checklist_item(
            restaurant=self.request.user.restaurant, completion=instance
        )
