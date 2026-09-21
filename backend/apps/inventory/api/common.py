"""Serializers and querysets for the inventory app that both roles share."""

from rest_framework import serializers

from .. import models


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Supplier
        fields = ("id", "name", "contact_email", "contact_phone", "notes", "is_active")
        read_only_fields = ("id",)


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Warehouse
        fields = ("id", "name", "description", "is_active")
        read_only_fields = ("id",)


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
    supplier_display = serializers.CharField(source="supplier.name", read_only=True, default=None)
    # Annotated on the queryset - see StaffInvoiceScanViewSet. Absent when an
    # invoice is serialized outside that view, which is why it has a default.
    lines_total = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True, default=None
    )
    warehouse_display = serializers.CharField(source="warehouse.name", read_only=True, default=None)

    class Meta:
        model = models.InvoiceScan
        fields = (
            "id",
            "photo",
            "status",
            # The client polls this after uploading: QUEUED/SCANNING mean the
            # line items are not there yet, DONE and FAILED are terminal.
            "scan_state",
            # The client needs this to decide whether the file can be shown as
            # an image at all - a PDF rendered into an <Image> is a blank box.
            "content_type",
            # The supplier this was matched to, and the raw text the scan read.
            # Both are shown while reviewing: the name is the evidence for the
            # match, and the only clue when there is no match to show.
            "supplier",
            "supplier_display",
            "warehouse",
            "warehouse_display",
            # Set when this invoice looks like a repeat. Shown to the
            # reviewer rather than acted on, except for an identical file -
            # see services.duplicates.
            "duplicate_of",
            "supplier_name",
            "invoice_date",
            "invoice_number",
            "delivery_location",
            "stated_subtotal",
            "stated_tax",
            "stated_total",
            "scan_error",
            "uploaded_by",
            "uploaded_by_name",
            "line_items",
            "lines_total",
            "created_at",
        )
        read_only_fields = (
            "id",
            # Set once, at upload. Writable here would mean a PATCH could point
            # an invoice at a different file after it had been read.
            "photo",
            "status",
            "scan_state",
            "content_type",
            "duplicate_of",
            "supplier_display",
            "warehouse_display",
            # Set when this invoice looks like a repeat. Shown to the
            # reviewer rather than acted on, except for an identical file -
            # see services.duplicates.
            "duplicate_of",
            "supplier_name",
            "invoice_date",
            "invoice_number",
            "delivery_location",
            "stated_subtotal",
            "stated_tax",
            "stated_total",
            "scan_error",
            "uploaded_by",
            "uploaded_by_name",
            "line_items",
            "lines_total",
            "created_at",
        )

    def get_uploaded_by_name(self, obj) -> str | None:
        if not obj.uploaded_by_id:
            return None
        return obj.uploaded_by.get_full_name() or obj.uploaded_by.email
