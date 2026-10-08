"""What an admin may see and do in the inventory app.

Mounted at /api/v1/admin/inventory/.
"""

from apps.common.api.viewsets import AdminViewSet, RestaurantScopedQuerysetMixin

from .. import models
from .common import BaseInventoryItemSerializer, SupplierSerializer, WarehouseSerializer


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


class AdminSupplierViewSet(RestaurantScopedQuerysetMixin, AdminViewSet):
    """The supplier list behind every purchase filter and price history.

    Retiring rather than deleting is the important part: a deleted supplier
    would take its name off every invoice it ever supplied, and those invoices
    are the record of what was actually bought.
    """

    serializer_class = SupplierSerializer
    queryset = models.Supplier.objects.all()
    filterset_fields = ("is_active",)
    search_fields = ("name",)

    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant)


class AdminWarehouseViewSet(RestaurantScopedQuerysetMixin, AdminViewSet):
    """Where deliveries can be sent - a dry store, a cellar, a second site."""

    serializer_class = WarehouseSerializer
    queryset = models.Warehouse.objects.all()
    filterset_fields = ("is_active",)

    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant)
