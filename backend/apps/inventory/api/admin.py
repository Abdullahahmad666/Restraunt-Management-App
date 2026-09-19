"""What an admin may see and do in the inventory app.

Mounted at /api/v1/admin/inventory/.
"""

from apps.common.api.viewsets import AdminViewSet, RestaurantScopedQuerysetMixin

from .. import models
from .common import BaseInventoryItemSerializer


class AdminInventoryItemSerializer(BaseInventoryItemSerializer):
    class Meta(BaseInventoryItemSerializer.Meta):
        fields = (*BaseInventoryItemSerializer.Meta.fields, "is_active")


class AdminInventoryItemViewSet(RestaurantScopedQuerysetMixin, AdminViewSet):
    """Registering stock items and setting their par level/cost - staff can
    add a new item inline while matching an invoice (see
    StaffInventoryItemViewSet), but changing an existing one's threshold or
    retiring it stays a manager decision. Deactivating rather than
    deleting keeps past stock movements meaningful even once an item is
    retired."""

    serializer_class = AdminInventoryItemSerializer
    queryset = models.InventoryItem.objects.all()
    filterset_fields = ("is_active",)

    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant)
