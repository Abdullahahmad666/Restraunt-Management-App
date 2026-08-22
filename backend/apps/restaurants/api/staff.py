"""What a floor user may see and do with restaurants and tables.

Mounted at /api/v1/staff/restaurants/ and /api/v1/staff/tables/.
"""

from apps.common.api.viewsets import StaffViewSet
from apps.restaurants.models import Restaurant, Table

from .common import BaseRestaurantSerializer, BaseTableSerializer


class StaffRestaurantSerializer(BaseRestaurantSerializer):
    class Meta(BaseRestaurantSerializer.Meta):
        # Staff see their restaurant's details but never edit them.
        read_only_fields = BaseRestaurantSerializer.Meta.fields


class StaffRestaurantViewSet(StaffViewSet):
    """Read-only, and only ever the caller's own restaurant.

    Restaurant is the tenant itself, so the scoping is on its primary key
    rather than a `restaurant` FK - hence the explicit `restaurant_field`
    instead of the mixin's default.
    """

    serializer_class = StaffRestaurantSerializer
    queryset = Restaurant.objects.all()
    http_method_names = ["get", "head", "options"]
    restaurant_field = "pk"


class StaffTableViewSet(StaffViewSet):
    """Staff may flip a table's active flag while working a shift, nothing more.

    StaffViewSet already carries RestaurantScopedQuerysetMixin, so this is
    limited to the caller's own restaurant without any extra wiring.
    """

    serializer_class = BaseTableSerializer
    queryset = Table.objects.select_related("restaurant")
    http_method_names = ["get", "patch", "head", "options"]
