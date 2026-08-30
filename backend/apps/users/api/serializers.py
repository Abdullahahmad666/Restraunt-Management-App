from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.common.roles import Role
from apps.users.models import InviteCode

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "phone",
            "profile_picture",
            "role",
            "restaurant",
        )
        read_only_fields = ("id", "role", "restaurant")


class RegisterSerializer(serializers.ModelSerializer):
    """Public self-registration.

    `role` is accepted here but never trusted on its own. Registering as ADMIN
    requires a matching invite code, because an admin can edit attendance
    records - the numbers people are paid on - and read payroll. Without that
    gate a public endpoint would hand anyone those powers.

    A STAFF code is optional and only attaches the account to a restaurant.
    Skipping it produces a valid but inert account: every queryset is scoped to
    the caller's restaurant and fails closed when there is not one.
    """

    password = serializers.CharField(write_only=True, validators=[validate_password])
    role = serializers.ChoiceField(
        choices=[Role.STAFF, Role.ADMIN], default=Role.STAFF, write_only=True
    )
    invite_code = serializers.CharField(
        write_only=True, required=False, allow_blank=True, max_length=16
    )

    class Meta:
        model = User
        fields = ("id", "email", "password", "first_name", "last_name", "role", "invite_code")

    def validate(self, attrs):
        role = attrs.get("role", Role.STAFF)
        raw_code = (attrs.get("invite_code") or "").strip().upper()

        if not raw_code:
            if role == Role.ADMIN:
                raise serializers.ValidationError(
                    {"invite_code": "An invite code is required to create an admin account."}
                )
            attrs["_invite"] = None
            return attrs

        try:
            invite = InviteCode.objects.select_related("restaurant").get(code=raw_code)
        except InviteCode.DoesNotExist:
            # Same message for every failure mode below, so the endpoint cannot
            # be used to discover which codes exist.
            raise serializers.ValidationError(
                {"invite_code": "That invite code is not valid."}
            ) from None

        if not invite.is_usable or invite.role != role:
            raise serializers.ValidationError({"invite_code": "That invite code is not valid."})

        attrs["_invite"] = invite
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        invite = validated_data.pop("_invite", None)
        validated_data.pop("invite_code", None)
        role = validated_data.pop("role", Role.STAFF)

        user = User.objects.create_user(
            role=role,
            restaurant=invite.restaurant if invite else None,
            **validated_data,
        )
        if invite:
            invite.consume(user)
        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = {
            "id": str(self.user.id),
            "email": self.user.email,
            "first_name": self.user.first_name,
            "last_name": self.user.last_name,
            "role": self.user.role,
        }
        return data


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, required=True)
    new_password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password]
    )

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value


class InviteCodeSerializer(serializers.ModelSerializer):
    """Admin-facing view of an invite code."""

    is_usable = serializers.BooleanField(read_only=True)

    class Meta:
        model = InviteCode
        fields = (
            "id",
            "code",
            "role",
            "restaurant",
            "expires_at",
            "used_at",
            "is_usable",
            "created_at",
        )
        read_only_fields = ("id", "code", "restaurant", "used_at", "is_usable", "created_at")

    def validate_role(self, value):
        if value not in {Role.STAFF, Role.ADMIN}:
            raise serializers.ValidationError("Invite codes are only issued for staff or admin.")
        return value
