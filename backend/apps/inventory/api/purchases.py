"""Purchase history: what was bought, from whom, into where, and when.

Admin-only, and read-only - every figure here is derived from confirmed
invoices, so there is nothing to write. Three views over the same filtered set
(see selectors.py): one row per product, spend per week or month, and the
totals.

Filters are shared by all three, so a chart and the table beneath it always
describe the same thing.
"""

from datetime import date

from drf_spectacular.utils import extend_schema
from rest_framework import serializers, views
from rest_framework.response import Response

from apps.common.permissions import IsAdmin

from .. import selectors
from ..models import InventoryItem, Supplier, Warehouse


class PurchaseFilterSerializer(serializers.Serializer):
    """What to count. Every field optional - no filters means everything."""

    supplier = serializers.PrimaryKeyRelatedField(
        queryset=Supplier.objects.all(), required=False, allow_null=True
    )
    warehouse = serializers.PrimaryKeyRelatedField(
        queryset=Warehouse.objects.all(), required=False, allow_null=True
    )
    item = serializers.PrimaryKeyRelatedField(
        queryset=InventoryItem.objects.all(), required=False, allow_null=True
    )
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)

    def validate(self, attrs):
        date_from: date | None = attrs.get("date_from")
        date_to: date | None = attrs.get("date_to")
        if date_from and date_to and date_from > date_to:
            raise serializers.ValidationError({"date_to": "The end date is before the start date."})

        # A supplier, warehouse or item belonging to someone else would
        # otherwise be a way to read across the tenant boundary - the filter
        # would simply match nothing here, but returning "no purchases" to a
        # probe still confirms the id exists.
        restaurant_id = self.context["restaurant_id"]
        for field in ("supplier", "warehouse", "item"):
            value = attrs.get(field)
            if value is not None and value.restaurant_id != restaurant_id:
                raise serializers.ValidationError({field: "That is not part of your restaurant."})
        return attrs


class PurchaseByItemRowSerializer(serializers.Serializer):
    """One product's purchase history. Documented explicitly because these are
    aggregate rows, not a model - without it the endpoint is missing from the
    schema the mobile client is generated against."""

    item_id = serializers.UUIDField()
    item_name = serializers.CharField()
    item_unit = serializers.CharField()
    total_quantity = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_spend = serializers.DecimalField(max_digits=14, decimal_places=2)
    line_count = serializers.IntegerField()
    invoice_count = serializers.IntegerField()
    last_purchased = serializers.DateField(allow_null=True)
    lines_without_price = serializers.IntegerField()


class PurchaseByItemResponseSerializer(serializers.Serializer):
    results = PurchaseByItemRowSerializer(many=True)


class PurchaseTimelineRowSerializer(serializers.Serializer):
    bucket = serializers.DateField(allow_null=True)
    total_spend = serializers.DecimalField(max_digits=14, decimal_places=2)
    line_count = serializers.IntegerField()
    invoice_count = serializers.IntegerField()


class PurchaseTimelineResponseSerializer(serializers.Serializer):
    period = serializers.ChoiceField(choices=["week", "month"])
    results = PurchaseTimelineRowSerializer(many=True)


class PurchaseSummarySerializer(serializers.Serializer):
    total_spend = serializers.DecimalField(max_digits=14, decimal_places=2)
    line_count = serializers.IntegerField()
    invoice_count = serializers.IntegerField()
    item_count = serializers.IntegerField()
    #: Surfaced rather than buried: a total missing three lines should say so.
    lines_without_price = serializers.IntegerField()
    unmatched_lines = serializers.IntegerField()


class BasePurchaseView(views.APIView):
    permission_classes = [IsAdmin]

    def filters(self, request) -> dict:
        serializer = PurchaseFilterSerializer(
            data=request.query_params,
            context={"restaurant_id": request.user.restaurant_id},
        )
        serializer.is_valid(raise_exception=True)
        return {
            "restaurant_id": request.user.restaurant_id,
            **serializer.validated_data,
        }


@extend_schema(
    parameters=[PurchaseFilterSerializer],
    responses=PurchaseByItemResponseSerializer,
)
class PurchasesByItemView(BasePurchaseView):
    """One row per product: how much was bought and what it cost.

    The "ketchup" view - every confirmed delivery that included it, added up,
    so a manager can see what the restaurant actually spends on each thing.
    """

    def get(self, request):
        rows = selectors.purchases_by_item(**self.filters(request))
        return Response({"results": list(rows)})


@extend_schema(
    parameters=[PurchaseFilterSerializer],
    responses=PurchaseTimelineResponseSerializer,
)
class PurchaseTimelineView(BasePurchaseView):
    """Spend per week or per month."""

    def get(self, request):
        period = request.query_params.get("period", "month")
        if period not in selectors.PERIODS:
            raise serializers.ValidationError(
                {"period": f"Choose one of: {', '.join(sorted(selectors.PERIODS))}."}
            )

        rows = selectors.purchase_timeline(period=period, **self.filters(request))
        return Response({"period": period, "results": list(rows)})


@extend_schema(
    parameters=[PurchaseFilterSerializer],
    responses=PurchaseSummarySerializer,
)
class PurchaseSummaryView(BasePurchaseView):
    """The cumulative totals for whatever the filters allow.

    Carries its own counts of lines with no readable price and lines nobody
    matched, so a figure that is missing something says so rather than quietly
    under-reporting.
    """

    def get(self, request):
        return Response(selectors.purchase_summary(**self.filters(request)))
