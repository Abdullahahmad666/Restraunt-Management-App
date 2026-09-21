"""Reading purchase history out of confirmed invoices.

One base queryset, three shapes on top of it: per product, over time, and in
total. They share `purchase_lines` deliberately - three separate definitions of
"what counts as a purchase" is three chances for a dashboard's totals to
disagree with the table underneath it.

Two decisions run through all of this:

Only CONFIRMED invoices count. A pending one is a proposal a person has not
accepted, and a discarded one was rejected outright - counting either would
mean a misread quantity showing up in the spend figures before anyone agreed
it was real.

A line's spend is its stated total when there is one, and quantity x unit price
otherwise. Lines where neither is legible contribute nothing and are counted
separately, because a total quietly missing three lines is worse than one that
says so.
"""

from decimal import Decimal

from django.db.models import Count, DecimalField, F, Max, Q, Sum, Value
from django.db.models.functions import Coalesce, TruncDate, TruncMonth, TruncWeek

from .models import InvoiceLineItem, InvoiceScan

_MONEY = DecimalField(max_digits=14, decimal_places=2)


def line_spend(prefix: str = ""):
    """What a line cost, however the invoice happened to express it.

    Takes a prefix so the same definition works whether you are aggregating
    over line items directly or over invoices reaching them through a
    relation - two spellings of this is two chances for an invoice total to
    disagree with the history it appears in.
    """
    return Coalesce(
        F(f"{prefix}line_total"),
        F(f"{prefix}quantity") * F(f"{prefix}unit_price"),
        Value(Decimal("0")),
        output_field=_MONEY,
    )


#: The usual case: aggregating over InvoiceLineItem itself.
LINE_SPEND = line_spend()

#: The date a purchase belongs to. An invoice's own date when it was legible,
#: and otherwise the day it was uploaded - close enough for a weekly or
#: monthly bucket, and far better than dropping the line out of the history.
PURCHASE_DATE = Coalesce("invoice__invoice_date", TruncDate("invoice__created_at"))

PERIODS = {"week": TruncWeek, "month": TruncMonth}


def purchase_lines(
    *,
    restaurant_id,
    supplier=None,
    warehouse=None,
    date_from=None,
    date_to=None,
    item=None,
):
    """Every confirmed invoice line the filters allow. The base for all of it."""
    queryset = InvoiceLineItem.objects.filter(
        invoice__restaurant_id=restaurant_id,
        invoice__status=InvoiceScan.Status.CONFIRMED,
    ).annotate(purchase_date=PURCHASE_DATE)

    if supplier is not None:
        queryset = queryset.filter(invoice__supplier=supplier)
    if warehouse is not None:
        queryset = queryset.filter(invoice__warehouse=warehouse)
    if item is not None:
        queryset = queryset.filter(matched_item=item)
    if date_from is not None:
        queryset = queryset.filter(purchase_date__gte=date_from)
    if date_to is not None:
        queryset = queryset.filter(purchase_date__lte=date_to)

    return queryset


def purchases_by_item(**filters):
    """What was bought, how much of it, and what it cost - one row per item.

    This is the "ketchup" question: every delivery that included it, added up.
    Unmatched lines are excluded rather than lumped together - a line nobody
    matched has no product to attribute the spend to, and inventing an "other"
    bucket would hide exactly the lines that still need a person.
    """
    return (
        purchase_lines(**filters)
        .filter(matched_item__isnull=False)
        .values(
            item_id=F("matched_item_id"),
            item_name=F("matched_item__name"),
            item_unit=F("matched_item__unit"),
        )
        .annotate(
            total_quantity=Sum("quantity"),
            total_spend=Sum(LINE_SPEND),
            line_count=Count("id"),
            invoice_count=Count("invoice_id", distinct=True),
            last_purchased=Max("purchase_date"),
            lines_without_price=Count(
                "id", filter=Q(line_total__isnull=True, unit_price__isnull=True)
            ),
        )
        .order_by("-total_spend")
    )


def purchase_timeline(*, period: str = "month", **filters):
    """Spend per week or per month, oldest first."""
    truncate = PERIODS[period]
    return (
        purchase_lines(**filters)
        .annotate(bucket=truncate("purchase_date"))
        .values("bucket")
        .annotate(
            total_spend=Sum(LINE_SPEND),
            line_count=Count("id"),
            invoice_count=Count("invoice_id", distinct=True),
        )
        .order_by("bucket")
    )


def purchase_summary(**filters) -> dict:
    """The cumulative figures, over whatever the filters allow."""
    lines = purchase_lines(**filters)
    totals = lines.aggregate(
        total_spend=Coalesce(Sum(LINE_SPEND), Value(Decimal("0")), output_field=_MONEY),
        line_count=Count("id"),
        invoice_count=Count("invoice_id", distinct=True),
        item_count=Count("matched_item_id", distinct=True),
        lines_without_price=Count("id", filter=Q(line_total__isnull=True, unit_price__isnull=True)),
        unmatched_lines=Count("id", filter=Q(matched_item__isnull=True)),
    )
    return totals
