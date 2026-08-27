"""What a staff member may see and do in the notifications app.

Mounted at /api/v1/staff/notifications/.
"""

from django.utils import timezone
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.notifications import models

from .common import BaseNotificationSerializer


class DeviceTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.DeviceToken
        fields = ("id", "token", "platform", "is_active")
        read_only_fields = ("id",)


class DeviceTokenViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    """Register this device's Expo push token so shift reminders can reach it."""

    serializer_class = DeviceTokenSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return models.DeviceToken.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class NotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """A staff member's own notifications."""

    serializer_class = BaseNotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return models.Notification.objects.filter(user=self.request.user)

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.read_at = timezone.now()
        notification.save(update_fields=["read_at"])
        return Response(BaseNotificationSerializer(notification).data)
