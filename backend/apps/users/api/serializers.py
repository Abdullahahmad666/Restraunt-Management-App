import random

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from django.utils.encoding import DjangoUnicodeDecodeError
from django.utils.http import urlsafe_base64_decode
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.common.roles import Role
from apps.restaurants.models import Restaurant
from apps.users.models import InviteCode

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    # Drives whether the app shows the real dashboard or a "pending approval"
    # screen for an ADMIN whose self-registered restaurant hasn't been
    # reviewed yet (see Restaurant.is_approved). None - not False - when
    # there is no restaurant at all, so the app can tell "pending" apart
    # from "not attached to anything".
    restaurant_is_approved = serializers.SerializerMethodField()

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
            "restaurant_is_approved",
        )
        read_only_fields = ("id", "role", "restaurant", "restaurant_is_approved")

    def get_restaurant_is_approved(self, obj) -> bool | None:
        return obj.restaurant.is_approved if obj.restaurant_id else None


class RegisterSerializer(serializers.ModelSerializer):
    """Public self-registration.

    `role` is accepted here but never trusted on its own. Registering as ADMIN
    needs either an invite code (joining a restaurant someone else already
    administers) or a `restaurant_name` (starting a brand new one - there is
    nobody yet who could have invited this person). A public endpoint that
    just believed `role=ADMIN` would hand anyone edit access to attendance
    records and payroll, so one of those two is always required.

    A STAFF code is optional and only attaches the account to a restaurant.
    Skipping it produces a valid but inert account: every queryset is scoped to
    the caller's restaurant and fails closed when there is not one. In
    practice staff should always arrive with a code, carried invisibly by the
    invite link they tapped (see InviteCodeLookupView) rather than typed by
    hand - but the field itself doesn't know or enforce how it got here.
    """

    password = serializers.CharField(write_only=True, validators=[validate_password])
    # Role.choices rather than a hand-ordered subset: a differently ordered
    # list of the same members reads as a separate enum to the schema
    # generator, which then collides with the model's. If a third role is ever
    # added, decide explicitly whether it is self-registerable.
    role = serializers.ChoiceField(choices=Role.choices, default=Role.STAFF, write_only=True)
    invite_code = serializers.CharField(
        write_only=True, required=False, allow_blank=True, max_length=16
    )
    restaurant_name = serializers.CharField(
        write_only=True, required=False, allow_blank=True, max_length=200
    )

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "password",
            "first_name",
            "last_name",
            "phone",
            "role",
            "invite_code",
            "restaurant_name",
        )

    def validate(self, attrs):
        role = attrs.get("role", Role.STAFF)
        raw_code = (attrs.get("invite_code") or "").strip().upper()
        restaurant_name = (attrs.get("restaurant_name") or "").strip()

        if raw_code:
            try:
                invite = InviteCode.objects.select_related("restaurant").get(code=raw_code)
            except InviteCode.DoesNotExist:
                # Same message for every failure mode below, so the endpoint
                # cannot be used to discover which codes exist.
                raise serializers.ValidationError(
                    {"invite_code": "That invite code is not valid."}
                ) from None

            if not invite.is_usable or invite.role != role:
                raise serializers.ValidationError({"invite_code": "That invite code is not valid."})

            attrs["_invite"] = invite
            attrs["_new_restaurant_name"] = None
            return attrs

        attrs["_invite"] = None

        if role == Role.ADMIN:
            # No code and no name: this admin is neither joining an existing
            # restaurant nor starting one, which leaves nothing to attach the
            # account to.
            if not restaurant_name:
                raise serializers.ValidationError(
                    {
                        "restaurant_name": (
                            "Enter your takeaway's name, or provide an invite code to "
                            "join one that already exists."
                        )
                    }
                )
            attrs["_new_restaurant_name"] = restaurant_name
        else:
            attrs["_new_restaurant_name"] = None

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        invite = validated_data.pop("_invite", None)
        new_restaurant_name = validated_data.pop("_new_restaurant_name", None)
        validated_data.pop("invite_code", None)
        validated_data.pop("restaurant_name", None)
        role = validated_data.pop("role", Role.STAFF)

        if new_restaurant_name:
            restaurant = Restaurant.objects.create(name=new_restaurant_name)
        else:
            restaurant = invite.restaurant if invite else None

        user = User.objects.create_user(
            role=role,
            restaurant=restaurant,
            **validated_data,
        )
        if invite:
            invite.consume(user)

        user.email_otp = f"{random.randint(0, 999999):06d}"
        user.email_otp_created_at = timezone.now()
        user.save()
        send_mail(
            subject="Verify your email",
            message=f"Your verification code is: {user.email_otp}",
            from_email=None,  # uses DEFAULT_FROM_EMAIL
            recipient_list=[user.email],
        )
        return user


class VerifyEmailSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    otp = serializers.CharField(required=True, max_length=6)

    def validate(self, attrs):
        try:
            user = User.objects.get(email=attrs["email"])
        except User.DoesNotExist:
            raise serializers.ValidationError("Invalid email or OTP.") from None

        if user.is_email_verified:
            raise serializers.ValidationError("Email is already verified.")

        if not user.email_otp or user.email_otp != attrs["otp"]:
            raise serializers.ValidationError("Invalid email or OTP.")

        # OTP expires after 10 minutes.
        if (
            user.email_otp_created_at
            and (timezone.now() - user.email_otp_created_at).total_seconds() > 600
        ):
            raise serializers.ValidationError("OTP has expired. Please request a new one.")

        attrs["user"] = user
        return attrs


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)

        if not self.user.is_email_verified:
            raise serializers.ValidationError("Please verify your email before logging in.")

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
class GoogleLoginSerializer(serializers.Serializer):
    id_token = serializers.CharField(required=True)

    def validate(self, attrs):
        try:
            idinfo = id_token.verify_oauth2_token(
                attrs["id_token"],
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
            )
        except ValueError:
            raise serializers.ValidationError("Invalid Google token.") from None

        email = idinfo.get("email")
        if not email:
            raise serializers.ValidationError("Google account has no email.")

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "first_name": idinfo.get("given_name", ""),
                "last_name": idinfo.get("family_name", ""),
                "is_email_verified": True,
            },
        )

        if created:
            user.set_unusable_password()
            user.save()

        attrs["user"] = user
        return attrs


class InviteCodeSerializer(serializers.ModelSerializer):
    is_usable = serializers.BooleanField(read_only=True)
    invite_link = serializers.SerializerMethodField()

    class Meta:
        model = InviteCode
        fields = (
            "id",
            "code",
            "invite_link",
            "role",
            "restaurant",
            "expires_at",
            "used_at",
            "is_usable",
            "created_at",
        )
        read_only_fields = (
            "id",
            "code",
            "invite_link",
            "restaurant",
            "expires_at",
            "used_at",
            "is_usable",
            "created_at",
        )

    def get_invite_link(self, obj) -> str:
        return f"{settings.INVITE_URL}?code={obj.code}"

    def validate_role(self, value):
        if value not in {Role.STAFF, Role.ADMIN}:
            raise serializers.ValidationError(
                "Invite codes are only issued for staff or admin."
            )
        return value


class PublicInviteCodeSerializer(serializers.Serializer):
    restaurant_name = serializers.CharField()
    invited_by_name = serializers.CharField()
    role = serializers.ChoiceField(choices=Role.choices)
    is_usable = serializers.BooleanField()


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(
        write_only=True,
        validators=[validate_password],
    )

    def validate(self, attrs):
        try:
            user_id = urlsafe_base64_decode(attrs["uid"]).decode()
            user = User.objects.get(pk=user_id)
        except (
            User.DoesNotExist,
            ValueError,
            TypeError,
            DjangoUnicodeDecodeError,
        ):
            raise serializers.ValidationError(
                {"token": "This reset link is invalid or has expired."}
            ) from None

        if not default_token_generator.check_token(user, attrs["token"]):
            raise serializers.ValidationError(
                {"token": "This reset link is invalid or has expired."}
            )

        attrs["user"] = user
        return attrs

    def save(self):
        user = self.validated_data["user"]
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=("password",))
        return user