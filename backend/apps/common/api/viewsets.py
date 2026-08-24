"""Base classes every role-scoped viewset builds on.

The shape each domain app follows:

    apps/<domain>/api/
    ├── common.py   shared serializer + queryset, no role knowledge
    ├── staff.py    what a floor user may see and do
    ├── admin.py    what an owner/manager may see and do
    └── urls.py     registers both on their own routers

One model, one table, two exposures. A third role is a third file here plus a
router entry - no model or service changes.
"""

from rest_framework import viewsets

from apps.common.permissions import IsAdmin, IsStaff


class RestaurantScopedQuerysetMixin:
    """Narrow a queryset to the caller's restaurant.

    This is the row-level half of multi-tenancy and it belongs on the queryset,
    not in a permission class - a permission class never sees a list view's
    rows, so filtering there would leak other restaurants' data on every list
    endpoint.

    `restaurant_field` is a full lookup, not a field name, so a model that IS
    the tenant can set it to "pk" and one that reaches it through a relation can
    set it to e.g. "order__restaurant_id".

    A user with no restaurant gets an empty queryset rather than everything -
    failing closed matters more here than a helpful error.
    """

    restaurant_field = "restaurant_id"

    def get_queryset(self):
        queryset = super().get_queryset()
        restaurant_id = getattr(self.request.user, "restaurant_id", None)
        if restaurant_id is None:
            return queryset.none()
        return queryset.filter(**{self.restaurant_field: restaurant_id})


class StaffViewSet(RestaurantScopedQuerysetMixin, viewsets.ModelViewSet):
    """Base for everything under /api/v1/staff/.

    Scoped to the caller's own restaurant. Subclasses narrow `http_method_names`
    when a resource should be read-only for staff.
    """

    permission_classes = [IsStaff]


class AdminViewSet(viewsets.ModelViewSet):
    """Base for everything under /api/v1/admin/.

    Not restaurant-scoped by default: an admin may legitimately manage several
    restaurants. Mix in RestaurantScopedQuerysetMixin on any subclass that
    should still be limited to one.
    """

    permission_classes = [IsAdmin]
