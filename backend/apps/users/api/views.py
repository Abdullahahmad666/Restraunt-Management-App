import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import (
    ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserSerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "register"


class MeView(generics.RetrieveUpdateAPIView):
    """The signed-in user. The mobile app calls this on launch to restore session."""

    serializer_class = UserSerializer
    parser_classes = [MultiPartParser, FormParser]

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
