"""What an admin may see and do in the notifications app.

Mounted at /api/v1/admin/notifications/.
"""

from rest_framework import mixins, viewsets

from apps.common.permissions import IsAdmin
from apps.notifications import models

from .common import BaseNotificationSerializer


class AdminNotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Every notification sent to the caller's restaurant's staff, for troubleshooting delivery."""

    serializer_class = BaseNotificationSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        return models.Notification.objects.filter(
            user__restaurant=self.request.user.restaurant
        ).select_related("user")
