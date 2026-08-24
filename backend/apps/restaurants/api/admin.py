"""What an owner or manager may see and do.

Mounted at /api/v1/admin/restaurants/.
"""

from apps.common.api.viewsets import AdminViewSet
from apps.restaurants.models import Restaurant, Table

from .common import BaseRestaurantSerializer, BaseTableSerializer


class AdminRestaurantSerializer(BaseRestaurantSerializer):
    class Meta(BaseRestaurantSerializer.Meta):
        # Admins additionally control the operational settings.
        fields = (*BaseRestaurantSerializer.Meta.fields, "timezone", "is_active")


class AdminRestaurantViewSet(AdminViewSet):
    """Full CRUD. Not restaurant-scoped - an admin may run more than one."""

    serializer_class = AdminRestaurantSerializer
    queryset = Restaurant.objects.all()


class AdminTableViewSet(AdminViewSet):
    serializer_class = BaseTableSerializer
    queryset = Table.objects.select_related("restaurant")
