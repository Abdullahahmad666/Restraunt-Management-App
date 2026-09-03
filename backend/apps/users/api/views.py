import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.shortcuts import get_object_or_404
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.users.models import InviteCode

from .serializers import (
    ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
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
    """Public: what an invite link is for, before anyone has signed in.

    The join screen calls this the moment it opens (from the `code` in the
    deep link) so it can greet someone by name and restaurant rather than
    showing a bare form. 404 on an unknown code - there is nothing sensitive
    to protect by pretending otherwise - but an expired or already-used code
    still resolves, with is_usable: false, so the screen can say why rather
    than just failing.
    """

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
            "invited_by_name": invite.created_by.get_full_name() if invite.created_by else None,
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
        return Response({"detail": "Email verified successfully."}, status=status.HTTP_200_OK)


class MeView(generics.RetrieveUpdateAPIView):
    """The signed-in user. The mobile app calls this on launch to restore session.

    JSONParser is listed alongside the multipart ones because most edits here
    are plain fields - a name or a phone number - and only the avatar needs a
    file upload. Without it those edits are rejected with a 415 for the sole
    reason that the endpoint can also accept an image.
    """

    serializer_class = UserSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_object(self):
        return self.request.user


class ChangePasswordView(generics.GenericAPIView):
    """Signed-in user changes their own password."""

    serializer_class = ChangePasswordSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save()
        return Response({"detail": "Password updated successfully."}, status=status.HTTP_200_OK)


class CustomLoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_scope = "login"


class PasswordResetRequestView(generics.GenericAPIView):
    """Step one of a forgotten-password reset: email a link.

    Answers 200 whether or not the address is registered. The alternative
    leaks who has an account here, and for a workplace app that is a staff
    list - useful to anyone phishing the business.
    """

    serializer_class = PasswordResetRequestSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "password_reset"

    generic_response = {"detail": "If that email has an account, a reset link is on its way."}

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user is not None:
            self._send_reset_email(user)

        return Response(self.generic_response, status=status.HTTP_200_OK)

    def _send_reset_email(self, user):
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        deep_link = f"{settings.PASSWORD_RESET_URL}?uid={uid}&token={token}"

        # In development MAILERS is the console backend, so this prints the link
        # straight into the runserver output - which is how you test the flow
        # before there is any SMTP configuration.
        try:
            send_mail(
                subject="Reset your Invisiko password",
                message="\n\n".join(
                    [
                        f"Hello {user.first_name or user.email},",
                        (
                            "Use the link below to choose a new password. It "
                            "expires in a few hours and can only be used once."
                        ),
                        deep_link,
                        (
                            "If you did not ask for this, you can ignore this "
                            "email - your password has not changed."
                        ),
                    ]
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
        except Exception:
            # Never surface a mail failure to the caller: it would turn the
            # deliberately generic response into an account-existence oracle.
            logger.exception("Failed to send a password reset email")


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
