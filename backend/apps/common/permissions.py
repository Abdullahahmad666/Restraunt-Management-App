"""Reusable permission classes.

Role checks live here rather than in each view, so the rules stay in one place
and adding a third role means editing one file plus the role tuple it reads.
"""

from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.common.roles import ADMIN_ROLES, STAFF_ROLES


class HasRole(BasePermission):
    """Base class: subclass and set `allowed_roles`.

    Deliberately checks the role on every request rather than caching it on the
    token. A demoted user loses access on their next call, not whenever their
    access token happens to expire.
    """

    allowed_roles: frozenset[str] = frozenset()
    message = "Your role does not have access to this resource."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and user.role in self.allowed_roles)


class IsAdmin(HasRole):
    """Guards the /api/v1/admin/ namespace."""

    allowed_roles = ADMIN_ROLES


class IsStaff(HasRole):
    """Guards the /api/v1/staff/ namespace. Admins are included by design."""

    allowed_roles = STAFF_ROLES


class IsSameRestaurant(BasePermission):
    """Object must belong to the caller's restaurant.

    Object-level only - it cannot stop a list view returning another
    restaurant's rows, because it never sees the queryset. Pair it with
    RestaurantScopedQuerysetMixin, which does the filtering.
    """

    message = "This object belongs to a different restaurant."

    def has_object_permission(self, request, view, obj):
        restaurant_id = getattr(obj, "restaurant_id", None) or getattr(obj, "id", None)
        user_restaurant_id = getattr(request.user, "restaurant_id", None)
        return (
            restaurant_id is not None
            and user_restaurant_id is not None
            and restaurant_id == user_restaurant_id
        )


class IsOwnerOrReadOnly(BasePermission):
    """Write access only for the object owner; any authenticated caller can read."""

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return getattr(obj, "owner_id", None) == request.user.id
