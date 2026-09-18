"""What an admin may see and do in the compliance app.

Mounted at /api/v1/admin/compliance/.
"""

from apps.common.api.viewsets import AdminViewSet, RestaurantScopedQuerysetMixin

from .. import models
from .common import BaseChecklistItemSerializer, BaseFridgeUnitSerializer


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
