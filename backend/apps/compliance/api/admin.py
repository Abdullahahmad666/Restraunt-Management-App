"""What an admin may see and do in the compliance app.

Mounted at /api/v1/admin/compliance/.
"""

from apps.common.api.viewsets import AdminViewSet, RestaurantScopedQuerysetMixin

from .. import models
from .common import (
    BaseChecklistItemSerializer,
    BaseChecklistTaskSerializer,
    BaseChecklistTemplateSerializer,
    BaseFridgeUnitSerializer,
)


class AdminFridgeUnitSerializer(BaseFridgeUnitSerializer):
    class Meta(BaseFridgeUnitSerializer.Meta):
        fields = (*BaseFridgeUnitSerializer.Meta.fields, "is_active")


class AdminFridgeUnitViewSet(RestaurantScopedQuerysetMixin, AdminViewSet):
    """Registering and editing the restaurant's fridges/freezers - name,
    photo, kind, and the temperature ceiling staff readings are checked
    against."""

    serializer_class = AdminFridgeUnitSerializer
    queryset = models.FridgeUnit.objects.all()
    filterset_fields = ("kind", "is_active")

    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant)


class AdminChecklistItemSerializer(BaseChecklistItemSerializer):
    class Meta(BaseChecklistItemSerializer.Meta):
        fields = (*BaseChecklistItemSerializer.Meta.fields, "is_active")


class AdminChecklistItemViewSet(RestaurantScopedQuerysetMixin, AdminViewSet):
    """Maintaining the opening/closing checklists - add, edit, reorder or
    deactivate a line. Deactivating rather than deleting keeps historical
    completions meaningful (a completion still points at the item that was
    ticked, even if it's since been retired)."""

    serializer_class = AdminChecklistItemSerializer
    queryset = models.ChecklistItem.objects.all()
    filterset_fields = ("routine", "is_active")

    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant)


class AdminChecklistTemplateSerializer(BaseChecklistTemplateSerializer):
    class Meta(BaseChecklistTemplateSerializer.Meta):
        fields = (*BaseChecklistTemplateSerializer.Meta.fields, "is_active")


class AdminChecklistTemplateViewSet(RestaurantScopedQuerysetMixin, AdminViewSet):
    """Registering the restaurant's named daily/weekly/monthly checklists -
    "Toilet Cleaning", "Monthly Deep Clean" - each frequency can have any
    number of these, unlike the single opening/closing checklist."""

    serializer_class = AdminChecklistTemplateSerializer
    queryset = models.ChecklistTemplate.objects.all()
    filterset_fields = ("frequency", "is_active")

    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant)


class AdminChecklistTaskSerializer(BaseChecklistTaskSerializer):
    class Meta(BaseChecklistTaskSerializer.Meta):
        fields = (*BaseChecklistTaskSerializer.Meta.fields, "is_active")


class AdminChecklistTaskViewSet(RestaurantScopedQuerysetMixin, AdminViewSet):
    """Maintaining one checklist template's tasks (?template=<id>) - same
    deactivate-don't-delete reasoning as AdminChecklistItemViewSet."""

    serializer_class = AdminChecklistTaskSerializer
    queryset = models.ChecklistTask.objects.all()
    filterset_fields = ("template", "is_active")

    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant)
