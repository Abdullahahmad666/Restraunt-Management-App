"""Noticing that an invoice has been through here before.

The same delivery scanned twice adds its stock twice, and nothing downstream
can tell that apart from a genuine second delivery of the same goods. By the
time anyone notices, the count is wrong and the invoice that made it wrong
looks exactly like the one that was right.

Two signals, deliberately treated differently because they are not equally
strong:

**The same file.** Byte-identical uploads are not evidence of a second
delivery; they are evidence of the same photo sent twice. Acted on
automatically and terminally, and checked before the scan so the second copy
costs nothing to recognise.

**The same supplier and invoice number.** Strong, but not proof - a supplier
can reuse a reference, and a scan can misread one. Recorded and shown to the
reviewer, who decides. Guessing wrong here would throw away a real delivery.
"""

import hashlib

from ..models import InvoiceScan

#: A duplicate of something already thrown away is not worth flagging - the
#: original is not going to be confirmed, so this copy is not repeating
#: anything that counts.
_LIVE_STATUSES = (InvoiceScan.Status.PENDING, InvoiceScan.Status.CONFIRMED)


def hash_file(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()


def find_same_file(*, invoice: InvoiceScan, file_hash: str) -> InvoiceScan | None:
    """An earlier invoice holding byte-identical content."""
    if not file_hash:
        return None

    return (
        InvoiceScan.objects.filter(
            restaurant_id=invoice.restaurant_id,
            file_hash=file_hash,
            status__in=_LIVE_STATUSES,
        )
        .exclude(pk=invoice.pk)
        .order_by("created_at")
        .first()
    )


def find_same_reference(*, invoice: InvoiceScan) -> InvoiceScan | None:
    """An earlier invoice from the same supplier carrying the same number.

    Needs both: an invoice number alone is only unique within one supplier,
    and two suppliers numbering from 1 would otherwise look like each other's
    duplicates.
    """
    if not invoice.invoice_number or invoice.supplier_id is None:
        return None

    return (
        InvoiceScan.objects.filter(
            restaurant_id=invoice.restaurant_id,
            supplier_id=invoice.supplier_id,
            invoice_number__iexact=invoice.invoice_number,
            status__in=_LIVE_STATUSES,
        )
        .exclude(pk=invoice.pk)
        .order_by("created_at")
        .first()
    )
