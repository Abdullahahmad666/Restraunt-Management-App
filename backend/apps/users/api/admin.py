"""What an admin may see and do with staff accounts.

Mounted at /api/v1/admin/users/.
"""

from django.contrib.auth import get_user_model
from django.utils.crypto import get_random_string
from rest_framework import serializers

from apps.common.api.viewsets import AdminViewSet, RestaurantScopedQuerysetMixin
from apps.common.roles import Role

User = get_user_model()


class AdminStaffSerializer(serializers.ModelSerializer):
    """Creating a staff account here is how an admin adds a new employee.

    Pay rates are set separately in the payroll app - this endpoint only
    owns the account itself (name, contact details, role, active flag).
    """

    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "phone",
            "role",
            "is_active",
            "password",
            "created_at",
        )
        read_only_fields = ("id", "created_at")

    def create(self, validated_data):
        password = validated_data.pop("password", None) or get_random_string(16)
        return User.objects.create_user(password=password, **validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        instance = super().update(instance, validated_data)
        if password:
            instance.set_password(password)
            instance.save(update_fields=["password"])
        return instance


class AdminStaffViewSet(RestaurantScopedQuerysetMixin, AdminViewSet):
    """Add and edit the caller's own restaurant's staff accounts.

    No destroy route: a staff member who leaves is deactivated
    (is_active=False), not deleted - their attendance and payroll history
    must stay on record. Role is forced to STAFF on create so this endpoint
    cannot be used to mint another admin.
    """

    serializer_class = AdminStaffSerializer
    queryset = User.objects.filter(role=Role.STAFF)
    http_method_names = ["get", "post", "patch", "head", "options"]

    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant, role=Role.STAFF)
