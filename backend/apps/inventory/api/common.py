"""Serializers and querysets for the inventory app that both roles share."""

from rest_framework import serializers

from .. import models


class BaseInventoryItemSerializer(serializers.ModelSerializer):
    is_below_par = serializers.BooleanField(read_only=True)

    class Meta:
        model = models.InventoryItem
        fields = (
            "id",
            "name",
            "unit",
            "quantity_on_hand",
            "par_level",
            "cost_per_unit",
            "is_below_par",
        )
        read_only_fields = ("id", "quantity_on_hand", "cost_per_unit", "is_below_par")


class StockMovementSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = models.StockMovement
        fields = (
            "id",
            "item",
            "reason",
            "quantity_delta",
            "note",
            "recorded_by",
            "recorded_by_name",
            "created_at",
        )
        read_only_fields = ("id", "recorded_by", "recorded_by_name", "created_at")

    def get_recorded_by_name(self, obj) -> str | None:
        if not obj.recorded_by_id:
            return None
        return obj.recorded_by.get_full_name() or obj.recorded_by.email


class InvoiceLineItemSerializer(serializers.ModelSerializer):
    matched_item_name = serializers.CharField(source="matched_item.name", read_only=True)

    class Meta:
        model = models.InvoiceLineItem
        fields = (
            "id",
            "invoice",
            "raw_name",
            "matched_item",
            "matched_item_name",
            "quantity",
            "unit",
            "unit_price",
            "line_total",
            "sort_order",
        )
        read_only_fields = ("id", "matched_item_name")


class InvoiceScanSerializer(serializers.ModelSerializer):
    line_items = InvoiceLineItemSerializer(many=True, read_only=True)
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = models.InvoiceScan
        fields = (
            "id",
            "photo",
            "status",
            "supplier_name",
            "invoice_date",
            "scan_error",
            "uploaded_by",
            "uploaded_by_name",
            "line_items",
            "created_at",
        )
        read_only_fields = (
            "id",
            "status",
            "supplier_name",
            "invoice_date",
            "scan_error",
            "uploaded_by",
            "uploaded_by_name",
            "line_items",
            "created_at",
        )

    def get_uploaded_by_name(self, obj) -> str | None:
        if not obj.uploaded_by_id:
            return None
        return obj.uploaded_by.get_full_name() or obj.uploaded_by.email
