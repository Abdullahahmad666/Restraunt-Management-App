import logging

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.users.emails import send_password_reset_email
from apps.users.models import InviteCode

from .serializers import (
    ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
    DeleteAccountSerializer,
    DeletionPlanSerializer,
    GoogleLoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    PublicInviteCodeSerializer,
    RegisterSerializer,
    UserSerializer,
    VerifyEmailSerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "register"


class InviteCodeLookupView(APIView):
    """Public: what an invite link is for, before anyone has signed in."""

    permission_classes = [permissions.AllowAny]
    throttle_scope = "invite_lookup"

    @extend_schema(responses=PublicInviteCodeSerializer)
    def get(self, request, code):
        invite = get_object_or_404(
            InviteCode.objects.select_related("restaurant", "created_by"),
            code=code.strip().upper(),
        )

        data = {
            "restaurant_name": invite.restaurant.name,
            "invited_by_name": (invite.created_by.get_full_name() if invite.created_by else None),
            "role": invite.role,
            "is_usable": invite.is_usable,
        }

        if not data["invited_by_name"]:
            data["invited_by_name"] = "your manager"

        return Response(PublicInviteCodeSerializer(data).data)


class VerifyEmailView(generics.GenericAPIView):
    """Verify a user's email using the OTP sent at registration."""

    serializer_class = VerifyEmailSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]
        user.is_email_verified = True
        user.email_otp = ""
        user.save()

        return Response(
            {"detail": "Email verified successfully."},
            status=status.HTTP_200_OK,
        )


class MeView(generics.RetrieveUpdateAPIView):
    """The signed-in user."""

    serializer_class = UserSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_object(self):
        return self.request.user


class ChangePasswordView(generics.GenericAPIView):
    """Signed-in user changes their own password."""

    serializer_class = ChangePasswordSerializer

    def post(self, request):
        serializer = self.get_serializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save()

        return Response(
            {"detail": "Password updated successfully."},
            status=status.HTTP_200_OK,
        )


class DeleteAccountView(generics.GenericAPIView):
    """Delete your own account. Apple's guideline 5.1.1(v).

    GET returns what the deletion would do, so the confirmation screen can be
    specific about it. POST does it.

    POST rather than DELETE: this needs a body - a password always, and the
    restaurant's name when the deletion takes a restaurant with it - and a
    DELETE carrying a body is the kind of thing that works until it meets a
    proxy that strips it.
    """

    serializer_class = DeleteAccountSerializer
    throttle_scope = "login"

    @extend_schema(responses=DeletionPlanSerializer)
    def get(self, request):
        from apps.users.services import deletion

        plan = deletion.plan_for(request.user)
        return Response(
            {
                "hard_delete": plan.hard_delete,
                "deletes_restaurant": plan.deletes_restaurant,
                "requires_name_confirmation": plan.requires_name_confirmation,
                "restaurant_name": plan.restaurant_name,
                "staff_accounts": plan.staff_accounts,
                "attendance_records": plan.attendance_records,
                "compliance_records": plan.compliance_records,
            },
            status=status.HTTP_200_OK,
        )

    @extend_schema(request=DeleteAccountSerializer, responses={204: None})
    def post(self, request):
        from apps.notifications.services.rules import notify_admins_of_account_deletion
        from apps.users.services import deletion

        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        user = request.user
        # All read before the deletion: afterwards the row is either gone or
        # scrubbed, `user.restaurant` on a deleted instance is not something
        # to be relying on, and the name is the thing the manager is about to
        # be told.
        restaurant = user.restaurant
        was_admin = user.is_admin
        # The label the retained records will carry, so a manager can tie
        # this notification to the payroll row it is about. Not
        # `get_full_name()`, which at this point still returns the live name
        # and returns "" for somebody who never typed one.
        display_name = user.former_display_name()

        plan = deletion.delete_account(user)

        # Nobody to tell when the restaurant went with them - the only
        # manager was the person who just left.
        if restaurant is not None and not plan.deletes_restaurant:
            notify_admins_of_account_deletion(
                restaurant=restaurant, was_admin=was_admin, display_name=display_name
            )

        logger.info(
            "Account deleted (hard=%s, restaurant_deleted=%s)",
            plan.hard_delete,
            plan.deletes_restaurant,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class CustomLoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_scope = "login"


class GoogleLoginView(generics.GenericAPIView):
    """Sign in (or sign up) using a Google ID token from the mobile app."""

    serializer_class = GoogleLoginSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "role": user.role,
                },
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetRequestView(generics.GenericAPIView):
    """Step one of a forgotten-password reset: email a link."""

    serializer_class = PasswordResetRequestSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "password_reset"

    generic_response = {"detail": "If that email has an account, a reset link is on its way."}

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]

        user = User.objects.filter(
            email__iexact=email,
            is_active=True,
        ).first()

        if user is not None:
            send_password_reset_email(user)

        return Response(
            self.generic_response,
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(generics.GenericAPIView):
    """Step two: redeem the emailed token and set the new password."""

    serializer_class = PasswordResetConfirmSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {"detail": "Password updated. You can now sign in."},
            status=status.HTTP_200_OK,
        )
