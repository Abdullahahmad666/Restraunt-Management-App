"""Background handlers for the inventory app.

Autodiscovered by apps.jobs.JobsConfig.ready(), so nothing imports this
module directly - it has to be named `jobs.py` and live at the app root.
"""

import logging

from apps.jobs.registry import job

from .models import InvoiceScan
from .services import scanning

logger = logging.getLogger(__name__)

SCAN_INVOICE = "inventory.scan_invoice"


@job(SCAN_INVOICE)
def scan_invoice(*, invoice_id: str) -> None:
    """Read a freshly uploaded invoice photo into line items.

    Returning normally means "this reached a verdict", not "the scan
    succeeded" - an unreadable photo is a finished job with the reason
    recorded on the invoice. Only the errors worth another attempt propagate,
    and those are what the queue retries.
    """
    try:
        invoice = InvoiceScan.objects.get(pk=invoice_id)
    except InvoiceScan.DoesNotExist:
        # Deleted between enqueue and run. Nothing to do, and nothing wrong.
        logger.info("Invoice %s no longer exists; skipping scan", invoice_id)
        return

    if invoice.status != InvoiceScan.Status.PENDING:
        # Confirmed or discarded while the job sat in the queue. Rewriting its
        # line items now would contradict stock that has already moved.
        logger.info("Invoice %s is %s; skipping scan", invoice_id, invoice.status)
        return

    scanning.populate_invoice_from_scan(invoice)
