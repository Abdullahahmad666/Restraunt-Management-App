from django.contrib.auth import get_user_model
from rest_framework import generics, permissions

from .serializers import RegisterSerializer, UserSerializer

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "register"


class MeView(generics.RetrieveUpdateAPIView):
    """The signed-in user. The mobile app calls this on launch to restore session."""

    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user
