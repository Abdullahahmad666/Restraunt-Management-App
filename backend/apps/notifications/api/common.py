"""Serializers and querysets for the notifications app that both roles share."""

from rest_framework import serializers

from apps.notifications import models


class BaseNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Notification
        fields = ("id", "kind", "title", "body", "status", "read_at", "created_at")
        read_only_fields = fields
