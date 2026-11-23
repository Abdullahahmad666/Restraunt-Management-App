"""Orchestrating one reading of one invoice.

The call itself lives in services.extraction; this is what surrounds it -
recognising a file we have already read, staying inside the month's ceiling,
mapping what comes back onto our own rows, and recording a failure in a way a
person can act on.

Runs on the background worker, not in the request - see apps.inventory.jobs.
"""

import logging
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from apps.common.files import (
    MAX_FILE_BYTES,
    PDF_TYPE,
    SUPPORTED_IMAGE_TYPES,
    SUPPORTED_TYPES,
    sniff_content_type,
    type_from_name,
)

from .extraction import (
    PermanentScanError,
    ScanError,
    TransientScanError,
    extract_invoice_data,
)

logger = logging.getLogger(__name__)

__all__ = [
    "MAX_FILE_BYTES",
    "PDF_TYPE",
    "SUPPORTED_IMAGE_TYPES",
    "SUPPORTED_TYPES",
    "PermanentScanError",
    "ScanError",
    "TransientScanError",
    "extract_invoice_data",
    "fail_stalled_scans",
    "is_scan_overdue",
    "populate_invoice_from_scan",
    "sniff_content_type",
    "type_from_name",
]

#: How long an invoice may sit waiting to be read, or being read, before it is
#: reported as failed. A live worker reaches a verdict well inside this - about
#: ten minutes with every retry used, under an hour even if the worker dies on
#: each attempt, and each attempt restarts this clock. Waiting longer means
#: nobody is reading it.
STALLED_AFTER = timedelta(minutes=30)

STALLED_ERROR = (
    "Reading this invoice is taking far longer than it should. Try scanning again, "
    "or add the items by hand."
)

#: When the app starts offering a retry while a scan is still in progress. A
#: normal read takes seconds, so by this point something has usually gone
#: wrong - but not certainly, which is why the scan is left running rather
#: than failed, and STALLED_AFTER is what finally gives up on it.
OVERDUE_AFTER = timedelta(minutes=5)


def is_scan_overdue(invoice) -> bool:
    """Whether a scan still in progress has taken long enough to offer a retry.

    Decided here rather than on the phone so the phone's clock does not
    matter, and so the answer changes on the next poll without the app having
    to keep its own timer.
    """
    from ..models import InvoiceScan

    return (
        invoice.status == InvoiceScan.Status.PENDING
        and invoice.scan_state in (InvoiceScan.ScanState.QUEUED, InvoiceScan.ScanState.SCANNING)
        and invoice.updated_at < timezone.now() - OVERDUE_AFTER
    )


def fail_stalled_scans(*, restaurant_id) -> int:
    """Report invoices nobody is reading as failed, so staff can act on them.

    The queue fails an invoice itself when it gives up, but only a running
    worker can give up. With the worker stopped - suspended, crashing on boot,
    hung - the job never runs, the invoice says "being read" forever, and the
    app hides the retry button while it does. This runs on the web side when
    invoices are fetched, which is the one place guaranteed to be alive when
    someone is looking.

    Only the reported state changes. The job stays queued, so a worker that
    comes back still reads the invoice and replaces this verdict with a real
    one.
    """
    from ..models import InvoiceScan

    now = timezone.now()
    stalled = InvoiceScan.objects.filter(
        restaurant_id=restaurant_id,
        status=InvoiceScan.Status.PENDING,
        scan_state__in=(InvoiceScan.ScanState.QUEUED, InvoiceScan.ScanState.SCANNING),
        # updated_at rather than created_at: queueing a rescan and starting
        # each attempt both save the invoice, so this is when it last moved.
        updated_at__lt=now - STALLED_AFTER,
    )
    # .update() skips auto_now, so the timestamp is set by hand.
    count = stalled.update(
        scan_state=InvoiceScan.ScanState.FAILED, scan_error=STALLED_ERROR, updated_at=now
    )
    if count:
        logger.warning(
            "Marked %s stalled invoice scan(s) failed for restaurant %s - is the worker running?",
            count,
            restaurant_id,
        )
    return count


def _safe_decimal(value, default=None):
    if value is None:
        return default if default is None else Decimal(str(default))
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return default if default is None else Decimal(str(default))


def _safe_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def _party_name(data: dict, key: str) -> str:
    """The supplier's or customer's name, from the nested object it arrives in.

    Defensive about the shape because getting this wrong is not a crash but a
    silent swap: record the customer as the supplier and every invoice files
    itself under the restaurant's own name.
    """
    party = data.get(key)
    if not isinstance(party, dict):
        return ""
    return str(party.get("name") or "")


def populate_invoice_from_scan(invoice) -> None:
    """Read `invoice.photo` and replace its line items with what came back.

    Idempotent: existing line items are cleared first, so a job retried after a
    half-finished attempt does not leave the invoice with each line twice.

    A PermanentScanError is recorded on the invoice and swallowed - there is
    nothing to retry, and the upload is deliberately kept so staff can retake
    the photo or key the lines in by hand. A TransientScanError propagates, and
    the queue retries the job.
    """
    from ..models import InvoiceLineItem, InvoiceScan
    from . import duplicates, usage
    from .matching import resolve_items
    from .suppliers import match_supplier
    from .warehouses import resolve_warehouse

    invoice.scan_state = InvoiceScan.ScanState.SCANNING
    invoice.scan_error = ""
    invoice.save(update_fields=["scan_state", "scan_error", "updated_at"])

    invoice.photo.open("rb")
    try:
        file_bytes = invoice.photo.read()
    finally:
        invoice.photo.close()

    invoice.file_hash = duplicates.hash_file(file_bytes)

    # Checked before the call, not after: recognising the second copy of a
    # file should not cost what reading it costs.
    already = duplicates.find_same_file(invoice=invoice, file_hash=invoice.file_hash)
    if already is not None:
        invoice.duplicate_of = already
        invoice.status = InvoiceScan.Status.DUPLICATE
        invoice.scan_state = InvoiceScan.ScanState.DONE
        invoice.scan_error = ""
        invoice.save(
            update_fields=[
                "file_hash",
                "duplicate_of",
                "status",
                "scan_state",
                "scan_error",
                "updated_at",
            ]
        )
        return

    # Checked here as well as at upload, because this is the line that spends
    # the money - the check at upload is a courtesy that avoids queueing work
    # that will be refused, not the limit itself.
    if usage.cap_reached(restaurant_id=invoice.restaurant_id):
        invoice.scan_state = InvoiceScan.ScanState.FAILED
        invoice.scan_error = (
            "You have reached this month's limit for reading invoices. The invoice is "
            "saved - add its items by hand, or ask a manager to raise the limit."
        )
        invoice.save(update_fields=["file_hash", "scan_state", "scan_error", "updated_at"])
        return

    usage.record_scan(restaurant_id=invoice.restaurant_id)

    try:
        data = extract_invoice_data(
            image_bytes=file_bytes,
            content_type=invoice.content_type or type_from_name(invoice.photo.name),
        )
    except PermanentScanError as exc:
        invoice.scan_state = InvoiceScan.ScanState.FAILED
        invoice.scan_error = str(exc)[:500]
        invoice.save(update_fields=["scan_state", "scan_error", "updated_at"])
        return

    lines = [line for line in (data.get("items") or []) if isinstance(line, dict)]
    # The description is what a person reads and what an alias is learned
    # against, so a line with none is still kept rather than dropped - a
    # nameless row is visible and gets corrected, a missing one is not.
    raw_names = [str(line.get("description") or "Unnamed item")[:255] for line in lines]
    # Anything this restaurant has bought before attaches itself, so a reviewer
    # only handles what is genuinely new. Resolved in one go rather than per
    # line - see services.matching.
    known = resolve_items(restaurant_id=invoice.restaurant_id, raw_names=raw_names)

    with transaction.atomic():
        invoice.line_items.all().delete()
        InvoiceLineItem.objects.bulk_create(
            [
                InvoiceLineItem(
                    invoice=invoice,
                    raw_name=raw_name,
                    matched_item=known.get(raw_name),
                    quantity=_safe_decimal(line.get("quantity"), default=1),
                    # The pack size as printed - "330ML", "25KG". Not the same
                    # thing as the inventory item's own unit, which is what
                    # the restaurant counts in; matching the two is the
                    # reviewer's job.
                    unit=str(line.get("size") or "")[:32],
                    unit_price=_safe_decimal(line.get("unit_price")),
                    line_total=_safe_decimal(line.get("line_total")),
                    sort_order=index,
                )
                for index, (raw_name, line) in enumerate(zip(raw_names, lines, strict=True))
            ]
        )
        invoice.document_type = (
            InvoiceScan.DocumentType.CREDIT_NOTE
            if str(data.get("document_type") or "").lower() == "credit_note"
            else InvoiceScan.DocumentType.INVOICE
        )
        invoice.supplier_name = _party_name(data, "supplier")[:200]
        invoice.invoice_date = _safe_date(data.get("invoice_date"))
        invoice.invoice_number = str(data.get("invoice_number") or "")[:100]
        # The delivery address, which is where a storage area is resolved from.
        # Often the same as the billing address, in which case it names the
        # business and resolves to nothing - which is the right outcome.
        invoice.delivery_location = str(data.get("shipping_address") or "")[:200]
        invoice.stated_subtotal = _safe_decimal(data.get("subtotal"))
        invoice.stated_tax = _safe_decimal(data.get("tax_total"))
        invoice.stated_total = _safe_decimal(data.get("total"))
        # Link to a supplier the restaurant already has, and only that - see
        # services.suppliers for why a scan never creates one. A blank here is
        # a question for the reviewer, not a failure.
        if invoice.supplier_id is None:
            invoice.supplier = match_supplier(
                restaurant_id=invoice.restaurant_id, raw_name=invoice.supplier_name
            )
        # Unlike the supplier, this creates what it cannot find - see
        # services.warehouses for why that trade is acceptable here and
        # nowhere else. A reviewer can still change it.
        if invoice.warehouse_id is None:
            invoice.warehouse = resolve_warehouse(
                restaurant_id=invoice.restaurant_id, raw_name=invoice.delivery_location
            )
        # Weaker evidence than an identical file, so it is recorded and shown
        # rather than acted on - a supplier can reuse a reference, and a scan
        # can misread one. Throwing away a real delivery is the worse mistake.
        invoice.duplicate_of = duplicates.find_same_reference(invoice=invoice)
        invoice.scan_state = InvoiceScan.ScanState.DONE
        invoice.scan_error = ""
        invoice.save(
            update_fields=[
                "document_type",
                "supplier_name",
                "supplier",
                "warehouse",
                "file_hash",
                "duplicate_of",
                "invoice_date",
                "invoice_number",
                "delivery_location",
                "stated_subtotal",
                "stated_tax",
                "stated_total",
                "scan_state",
                "scan_error",
                "updated_at",
            ]
        )
