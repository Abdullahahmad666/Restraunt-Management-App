"""What an admin may see and do with staff accounts.

Mounted at /api/v1/admin/users/.
"""

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from apps.common.api.viewsets import AdminViewSet, RestaurantScopedQuerysetMixin
from apps.common.roles import Role
from apps.users.emails import send_account_setup_email
from apps.users.models import InviteCode

from .serializers import InviteCodeSerializer

User = get_user_model()


class AdminStaffSerializer(serializers.ModelSerializer):
    """Creating a staff account here is how an admin adds a new employee.

    Leaving `password` out - the normal case - emails the new person a link to
    set their own, so the admin never handles it. Passing one explicitly is
    supported for the occasions where an admin genuinely needs to hand over
    credentials in person.

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

    @transaction.atomic
    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User.objects.create_user(password=password or None, **validated_data)

        if password:
            # An admin set one explicitly. Their problem to communicate, and
            # they clearly meant to.
            return user

        # Otherwise the new person sets their own via an emailed link, and
        # nobody else ever knows it. The alternative - generating a password
        # here - either strands the account, because there was no way to tell
        # them what it is, or makes it a secret two people share. In an app
        # where an account signs off attendance records that decide pay, that
        # is not a detail.
        user.set_unusable_password()
        user.save(update_fields=["password"])

        restaurant = getattr(user, "restaurant", None)
        send_account_setup_email(user, restaurant_name=restaurant.name if restaurant else None)
        return user

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


class AdminInviteCodeViewSet(AdminViewSet):
    """Admins issue the codes that let someone self-register into their restaurant.

    Scoped to the caller's own restaurant on both read and write, so one
    restaurant's admin can neither see nor mint codes for another.
    """

    serializer_class = InviteCodeSerializer
    queryset = InviteCode.objects.select_related("restaurant")
    restaurant_field = "restaurant_id"
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        restaurant_id = getattr(self.request.user, "restaurant_id", None)
        if restaurant_id is None:
            return InviteCode.objects.none()
        return InviteCode.objects.select_related("restaurant").filter(restaurant_id=restaurant_id)

    def perform_create(self, serializer):
        restaurant_id = getattr(self.request.user, "restaurant_id", None)
        if restaurant_id is None:
            raise ValidationError(
                "Your account is not attached to a restaurant, so it cannot issue invites."
            )
        serializer.save(restaurant_id=restaurant_id, created_by=self.request.user)
