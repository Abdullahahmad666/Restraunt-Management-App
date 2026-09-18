"""Serializers and querysets for the compliance app that both roles share."""

from rest_framework import serializers

from .. import models


class BaseFridgeUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.FridgeUnit
        fields = ("id", "name", "kind", "photo", "recommended_max_celsius", "sort_order")
        read_only_fields = ("id",)


class BaseChecklistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ChecklistItem
        fields = ("id", "routine", "text", "sort_order")
        read_only_fields = ("id",)


class TemperatureReadingSerializer(serializers.ModelSerializer):
    # Flattened in so a screen listing today's readings never has to make a
    # second request just to show who logged one.
    recorded_by_name = serializers.SerializerMethodField()
    is_within_range = serializers.BooleanField(read_only=True)

    class Meta:
        model = models.TemperatureReading
        fields = (
            "id",
            "fridge_unit",
            "routine",
            "date",
            "celsius",
            "recorded_by",
            "recorded_by_name",
            "recorded_at",
            "is_within_range",
        )
        read_only_fields = (
            "id",
            "recorded_by",
            "recorded_by_name",
            "recorded_at",
            "is_within_range",
        )

    def get_recorded_by_name(self, obj) -> str | None:
        if not obj.recorded_by_id:
            return None
        return obj.recorded_by.get_full_name() or obj.recorded_by.email


class ChecklistCompletionSerializer(serializers.ModelSerializer):
    completed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = models.ChecklistCompletion
        fields = (
            "id",
            "checklist_item",
            "date",
            "completed_by",
            "completed_by_name",
            "completed_at",
        )
        read_only_fields = ("id", "completed_by", "completed_by_name", "completed_at")

    def get_completed_by_name(self, obj) -> str | None:
        if not obj.completed_by_id:
            return None
        return obj.completed_by.get_full_name() or obj.completed_by.email


class BaseChecklistTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ChecklistTemplate
        fields = ("id", "frequency", "name", "sort_order")
        read_only_fields = ("id",)


class BaseChecklistTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ChecklistTask
        fields = ("id", "template", "text", "sort_order")
        read_only_fields = ("id",)


class ChecklistTaskCompletionSerializer(serializers.ModelSerializer):
    completed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = models.ChecklistTaskCompletion
        fields = (
            "id",
            "task",
            "period_start",
            "completed_by",
            "completed_by_name",
            "completed_at",
        )
        read_only_fields = fields

    def get_completed_by_name(self, obj) -> str | None:
        if not obj.completed_by_id:
            return None
        return obj.completed_by.get_full_name() or obj.completed_by.email
