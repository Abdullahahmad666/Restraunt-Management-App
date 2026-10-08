"""Changing stock: by hand, or by confirming a scanned invoice's line items.

Every change goes through adjust_stock so there is always a StockMovement
row explaining how an item's quantity_on_hand got to whatever it currently
reads - nothing edits that field directly.
"""

from django.core.exceptions import ValidationError
from django.db.models import F
from django.utils import timezone

from .. import models
from ..models import InventoryItem
from . import matching


def _check_same_restaurant(*, restaurant, obj, label: str) -> None:
    if obj.restaurant_id != restaurant.id:
        raise ValidationError(f"That {label} is not part of your restaurant.")


def adjust_stock(
    *,
    restaurant,
    item: "models.InventoryItem",
    quantity_delta,
    reason: str,
    recorded_by,
    note: str = "",
    invoice_line_item: "models.InvoiceLineItem | None" = None,
) -> "models.StockMovement":
    _check_same_restaurant(restaurant=restaurant, obj=item, label="inventory item")

    # Incremented in the database rather than read, added to, and written
    # back. Two callers holding their own copy of the same item both start
    # from the value they loaded, and the second write erases the first - and
    # they do not have to be concurrent to collide. One invoice listing the
    # same item on two lines is enough: confirm_invoice select_related()s the
    # item per line, so each line carries its own instance of it.
    InventoryItem.objects.filter(pk=item.pk).update(
        quantity_on_hand=F("quantity_on_hand") + quantity_delta,
        updated_at=timezone.now(),
    )
    item.refresh_from_db(fields=["quantity_on_hand"])

    return models.StockMovement.objects.create(
        restaurant=restaurant,
        item=item,
        reason=reason,
        quantity_delta=quantity_delta,
        note=note,
        invoice_line_item=invoice_line_item,
        recorded_by=recorded_by,
    )


def confirm_invoice(
    *, restaurant, invoice: "models.InvoiceScan", recorded_by
) -> "models.InvoiceScan":
    """Apply every line item's quantity to its matched inventory item as a
    DELIVERY movement, and refresh that item's cost_per_unit from the
    line's unit price where one was read. Every line must already be
    matched to an inventory item - a line nobody has matched yet is a line
    whose stock would silently never get counted, which is worse than
    making the confirm button wait for it.
    """
    _check_same_restaurant(restaurant=restaurant, obj=invoice, label="invoice")

    if invoice.status == models.InvoiceScan.Status.DUPLICATE:
        raise ValidationError(
            "This is the same file as an invoice already uploaded - confirming it would "
            "count the same delivery twice."
        )
    if invoice.status != models.InvoiceScan.Status.PENDING:
        raise ValidationError("This invoice has already been confirmed or discarded.")

    line_items = list(invoice.line_items.select_related("matched_item"))
    if not line_items:
        raise ValidationError("This invoice has no line items to confirm.")
    if any(line.matched_item_id is None for line in line_items):
        raise ValidationError("Every line item must be matched to an inventory item first.")

    # A credit note is an invoice run backwards: the goods on it left. Its
    # quantities are read as positive magnitudes, with the document type
    # carrying the direction, so the sign is applied once, here.
    is_credit = invoice.document_type == models.InvoiceScan.DocumentType.CREDIT_NOTE
    sign = -1 if is_credit else 1
    reason = (
        models.StockMovement.Reason.RETURN if is_credit else models.StockMovement.Reason.DELIVERY
    )
    label = "credit note" if is_credit else "invoice"

    for line in line_items:
        adjust_stock(
            restaurant=restaurant,
            item=line.matched_item,
            quantity_delta=sign * line.quantity,
            reason=reason,
            recorded_by=recorded_by,
            note=f"From {label} scanned {invoice.created_at:%Y-%m-%d}",
            invoice_line_item=line,
        )
        # A credit note says what was sent back, not what things now cost.
        # Letting it rewrite cost_per_unit would make a returned item's price
        # the newest price on record.
        if line.unit_price is not None and not is_credit:
            line.matched_item.cost_per_unit = line.unit_price
            line.matched_item.save(update_fields=["cost_per_unit", "updated_at"])

    # Remember how these lines were matched, so the next delivery from this
    # supplier arrives already matched. Confirmation is the right moment: it is
    # where a person accepted the whole invoice, rather than mid-review where
    # half the matches are still being corrected.
    matching.learn_aliases(restaurant=restaurant, invoice=invoice)

    invoice.status = models.InvoiceScan.Status.CONFIRMED
    invoice.save(update_fields=["status", "updated_at"])
    return invoice


def discard_invoice(*, restaurant, invoice: "models.InvoiceScan") -> "models.InvoiceScan":
    _check_same_restaurant(restaurant=restaurant, obj=invoice, label="invoice")
    if invoice.status != models.InvoiceScan.Status.PENDING:
        raise ValidationError("This invoice has already been confirmed or discarded.")

    invoice.status = models.InvoiceScan.Status.DISCARDED
    invoice.save(update_fields=["status", "updated_at"])
    return invoice
