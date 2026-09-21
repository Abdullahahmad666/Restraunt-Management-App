"""What a staff member may see and do in the inventory app.

Mounted at /api/v1/staff/inventory/.
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response

from apps.common.api.viewsets import RestaurantScopedQuerysetMixin
from apps.common.permissions import IsStaff
from apps.jobs.services import queue

from .. import jobs as inventory_jobs
from .. import models
from ..services import stock as stock_service
from .common import (
    BaseInventoryItemSerializer,
    InvoiceLineItemSerializer,
    InvoiceScanSerializer,
    StockMovementSerializer,
)


class StaffInventoryItemViewSet(
    RestaurantScopedQuerysetMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """Every active stock item at the caller's restaurant, plus the ability
    to add a new one - needed inline while matching an unrecognised invoice
    line to something. Editing an existing item's par level/cost, or
    deactivating one, stays admin-only (see AdminInventoryItemViewSet)."""

    serializer_class = BaseInventoryItemSerializer
    permission_classes = [IsStaff]
    queryset = models.InventoryItem.objects.all()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return models.InventoryItem.objects.none()
        return super().get_queryset().filter(is_active=True)

    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant)


class AdjustStockSerializer(serializers.Serializer):
    item = serializers.PrimaryKeyRelatedField(queryset=models.InventoryItem.objects.all())
    quantity_delta = serializers.DecimalField(max_digits=10, decimal_places=2)
    reason = serializers.ChoiceField(choices=models.StockMovement.Reason.choices)
    note = serializers.CharField(required=False, allow_blank=True, max_length=255)


class StaffStockMovementViewSet(
    RestaurantScopedQuerysetMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """The stock ledger, filterable by ?item= - every delivery, waste
    entry and correction logged by hand. Confirming a scanned invoice logs
    these the same way (see services.stock.confirm_invoice), so this list
    is the one place that explains every change to an item's count."""

    serializer_class = StockMovementSerializer
    permission_classes = [IsStaff]
    filterset_fields = ("item", "reason")
    queryset = models.StockMovement.objects.select_related("recorded_by", "item")

    def create(self, request, *args, **kwargs):
        input_serializer = AdjustStockSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        try:
            movement = stock_service.adjust_stock(
                restaurant=request.user.restaurant,
                recorded_by=request.user,
                **input_serializer.validated_data,
            )
        except DjangoValidationError as exc:
            raise DRFValidationError(getattr(exc, "messages", str(exc))) from exc

        return Response(self.get_serializer(movement).data, status=201)


class UploadInvoiceSerializer(serializers.Serializer):
    photo = serializers.ImageField()


class StaffInvoiceScanViewSet(
    RestaurantScopedQuerysetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """Invoice photos staff have uploaded, with the line items a vision
    model read off each one - see services.scanning for how, and
    services.stock for how confirming one applies its lines to stock."""

    serializer_class = InvoiceScanSerializer
    permission_classes = [IsStaff]
    filterset_fields = ("status",)
    queryset = models.InvoiceScan.objects.select_related("uploaded_by").prefetch_related(
        "line_items", "line_items__matched_item"
    )

    def _queue_scan(self, invoice: "models.InvoiceScan") -> None:
        """Hand the photo to the worker and return.

        Reading an invoice takes seconds of waiting on a vision model. Doing it
        here would hold one of gunicorn's three workers for the duration, so a
        few simultaneous uploads would stall every other request in the app.
        The client polls this invoice until scan_state leaves QUEUED.
        """
        invoice.scan_state = models.InvoiceScan.ScanState.QUEUED
        invoice.scan_error = ""
        invoice.save(update_fields=["scan_state", "scan_error", "updated_at"])
        queue.enqueue(kind=inventory_jobs.SCAN_INVOICE, payload={"invoice_id": str(invoice.id)})

    def create(self, request, *args, **kwargs):
        input_serializer = UploadInvoiceSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        invoice = models.InvoiceScan.objects.create(
            restaurant=request.user.restaurant,
            photo=input_serializer.validated_data["photo"],
            uploaded_by=request.user,
        )
        self._queue_scan(invoice)

        # 202, not 201: the invoice exists, but the line items the caller
        # actually wants are not there yet.
        return Response(self.get_serializer(invoice).data, status=202)

    @action(detail=True, methods=["post"])
    def rescan(self, request, pk=None):
        """Re-run scanning on the same photo - e.g. after a blurry first
        attempt read nothing useful. Only valid before confirmation;
        clears any line items the first attempt produced."""
        invoice = self.get_object()
        if invoice.status != models.InvoiceScan.Status.PENDING:
            raise DRFValidationError("This invoice has already been confirmed or discarded.")

        invoice.line_items.all().delete()
        self._queue_scan(invoice)
        return Response(self.get_serializer(invoice).data, status=202)

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        invoice = self.get_object()
        try:
            stock_service.confirm_invoice(
                restaurant=request.user.restaurant, invoice=invoice, recorded_by=request.user
            )
        except DjangoValidationError as exc:
            raise DRFValidationError(getattr(exc, "messages", str(exc))) from exc
        invoice.refresh_from_db()
        return Response(self.get_serializer(invoice).data)

    @action(detail=True, methods=["post"])
    def discard(self, request, pk=None):
        invoice = self.get_object()
        try:
            stock_service.discard_invoice(restaurant=request.user.restaurant, invoice=invoice)
        except DjangoValidationError as exc:
            raise DRFValidationError(getattr(exc, "messages", str(exc))) from exc
        return Response(self.get_serializer(invoice).data)


class StaffInvoiceLineItemViewSet(RestaurantScopedQuerysetMixin, viewsets.ModelViewSet):
    """Editing one invoice's line items while reviewing it - correcting
    what the AI read, matching each line to an inventory item (or adding
    one it missed, or deleting one it hallucinated). Locked once the
    invoice is confirmed or discarded."""

    serializer_class = InvoiceLineItemSerializer
    permission_classes = [IsStaff]
    restaurant_field = "invoice__restaurant_id"
    filterset_fields = ("invoice",)
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    queryset = models.InvoiceLineItem.objects.select_related("invoice", "matched_item")

    def _check_editable(self, invoice: "models.InvoiceScan") -> None:
        if invoice.status != models.InvoiceScan.Status.PENDING:
            raise DRFValidationError("This invoice has already been confirmed or discarded.")

    def _check_matched_item(self, invoice: "models.InvoiceScan", matched_item) -> None:
        if matched_item is not None and matched_item.restaurant_id != invoice.restaurant_id:
            raise DRFValidationError("That inventory item is not part of your restaurant.")

    def perform_create(self, serializer):
        invoice = serializer.validated_data["invoice"]
        if invoice.restaurant_id != self.request.user.restaurant_id:
            raise DRFValidationError("That invoice is not part of your restaurant.")
        self._check_editable(invoice)
        self._check_matched_item(invoice, serializer.validated_data.get("matched_item"))
        serializer.save()

    def perform_update(self, serializer):
        invoice = serializer.instance.invoice
        self._check_editable(invoice)
        matched_item = serializer.validated_data.get(
            "matched_item", serializer.instance.matched_item
        )
        self._check_matched_item(invoice, matched_item)
        serializer.save()

    def perform_destroy(self, instance):
        self._check_editable(instance.invoice)
        instance.delete()
