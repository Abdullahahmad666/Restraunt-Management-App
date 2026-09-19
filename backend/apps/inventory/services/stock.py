"""Changing stock: by hand, or by confirming a scanned invoice's line items.

Every change goes through adjust_stock so there is always a StockMovement
row explaining how an item's quantity_on_hand got to whatever it currently
reads - nothing edits that field directly.
"""

from django.core.exceptions import ValidationError

from .. import models


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

    item.quantity_on_hand = item.quantity_on_hand + quantity_delta
    item.save(update_fields=["quantity_on_hand", "updated_at"])

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

    if invoice.status != models.InvoiceScan.Status.PENDING:
        raise ValidationError("This invoice has already been confirmed or discarded.")

    line_items = list(invoice.line_items.select_related("matched_item"))
    if not line_items:
        raise ValidationError("This invoice has no line items to confirm.")
    if any(line.matched_item_id is None for line in line_items):
        raise ValidationError("Every line item must be matched to an inventory item first.")

    for line in line_items:
        adjust_stock(
            restaurant=restaurant,
            item=line.matched_item,
            quantity_delta=line.quantity,
            reason=models.StockMovement.Reason.DELIVERY,
            recorded_by=recorded_by,
            note=f"From invoice scanned {invoice.created_at:%Y-%m-%d}",
            invoice_line_item=line,
        )
        if line.unit_price is not None:
            line.matched_item.cost_per_unit = line.unit_price
            line.matched_item.save(update_fields=["cost_per_unit", "updated_at"])

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
