"""Reusable permission classes.

Role checks live here rather than in each view so the rules stay in one place.
"""

from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsOwnerOrReadOnly(BasePermission):
    """Write access only for the object owner; everyone authenticated can read."""

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return getattr(obj, "owner_id", None) == request.user.id


class IsRestaurantStaff(BasePermission):
    """Caller must be attached to the restaurant the object belongs to."""

    def has_object_permission(self, request, view, obj):
        restaurant_id = getattr(obj, "restaurant_id", None)
        return (
            restaurant_id is not None
            and request.user.is_authenticated
            and request.user.restaurant_id == restaurant_id
        )


class IsManager(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return user.is_authenticated and user.role in {user.Role.OWNER, user.Role.MANAGER}
