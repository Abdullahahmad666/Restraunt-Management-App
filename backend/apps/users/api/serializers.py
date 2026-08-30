import random

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

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
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ("id", "email", "password", "first_name", "last_name")

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        user.email_otp = f"{random.randint(0, 999999):06d}"
        user.email_otp_created_at = timezone.now()
        user.save()
        print(
            f"[DEV] OTP for {user.email}: {user.email_otp}"
        )  # TODO: replace with real email sending
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
