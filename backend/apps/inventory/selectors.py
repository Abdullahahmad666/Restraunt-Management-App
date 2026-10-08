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

from django.db.models import Case, Count, DecimalField, F, Max, Q, Sum, Value, When
from django.db.models.functions import Coalesce, TruncDate, TruncMonth, TruncWeek

from .models import InvoiceLineItem, InvoiceScan

_MONEY = DecimalField(max_digits=14, decimal_places=2)


def line_spend(prefix: str = ""):
    """What a line cost, however the invoice happened to express it.

    Unsigned: this is the figure as printed. Purchase history applies the
    credit-note sign separately (see SIGNED_LINE_SPEND), while an invoice's
    own total shows what the page says - a credit note printed as GBP 20 reads
    as GBP 20 on the page and as -GBP 20 in the month's spending, and both are
    right.

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


def _signed(expression):
    """Flip the sign for a credit note.

    Without this a credit note *increases* reported spend and reported
    quantity - the exact opposite of what it records - and a month where a lot
    went back would look like a month where a lot was bought.
    """
    return Case(
        When(invoice__document_type="CREDIT_NOTE", then=-expression),
        default=expression,
        output_field=_MONEY,
    )


SIGNED_LINE_SPEND = _signed(LINE_SPEND)
SIGNED_QUANTITY = _signed(F("quantity"))

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
            total_quantity=Sum(SIGNED_QUANTITY),
            total_spend=Sum(SIGNED_LINE_SPEND),
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
            total_spend=Sum(SIGNED_LINE_SPEND),
            line_count=Count("id"),
            invoice_count=Count("invoice_id", distinct=True),
        )
        .order_by("bucket")
    )


def purchase_summary(**filters) -> dict:
    """The cumulative figures, over whatever the filters allow."""
    lines = purchase_lines(**filters)
    totals = lines.aggregate(
        total_spend=Coalesce(Sum(SIGNED_LINE_SPEND), Value(Decimal("0")), output_field=_MONEY),
        line_count=Count("id"),
        invoice_count=Count("invoice_id", distinct=True),
        item_count=Count("matched_item_id", distinct=True),
        lines_without_price=Count("id", filter=Q(line_total__isnull=True, unit_price__isnull=True)),
        unmatched_lines=Count("id", filter=Q(matched_item__isnull=True)),
    )
    return {**totals, **_tax_summary(lines)}


def _tax_summary(lines) -> dict:
    """The VAT on the invoices those lines came from.

    Aggregated over invoices rather than lines, because tax is printed once per
    invoice: summing it through a line join multiplies it by the number of
    lines, which on a twenty-line delivery is a figure twenty times too large
    and still plausible enough to be believed.

    Only what the invoices actually printed is counted, and how many did is
    reported alongside it - a restaurant buying half its stock from a supplier
    who shows no VAT has a tax figure covering half its spending, and that is
    worth knowing before anyone hands it to an accountant.
    """
    invoices = InvoiceScan.objects.filter(id__in=lines.values("invoice_id"))
    return invoices.aggregate(
        tax_total=Coalesce(
            Sum(
                Case(
                    When(document_type="CREDIT_NOTE", then=-F("stated_tax")),
                    default=F("stated_tax"),
                    output_field=_MONEY,
                )
            ),
            Value(Decimal("0")),
            output_field=_MONEY,
        ),
        invoices_stating_tax=Count("id", filter=Q(stated_tax__isnull=False)),
    )
