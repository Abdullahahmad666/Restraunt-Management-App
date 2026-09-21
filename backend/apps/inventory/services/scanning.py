"""Turning a photographed invoice into structured line items via a
vision-capable AI model.

This only ever produces a *proposal*. `populate_invoice_from_scan` writes the
InvoiceLineItem rows, all still PENDING, and nothing touches actual stock until
a human reviews, corrects and confirms it (see services.stock.confirm_invoice).
A misread quantity is an annoyance to fix in review; the same misread silently
applied to stock and cost figures is a real problem, so this is not trusted
further than "a first draft".

Runs on the background worker, not in the request - see apps.inventory.jobs.
"""

import base64
import json
import logging

import anthropic
from django.conf import settings
from django.db import transaction

logger = logging.getLogger(__name__)

MODEL = "claude-opus-5"

PDF_TYPE = "application/pdf"
SUPPORTED_IMAGE_TYPES = frozenset({"image/jpeg", "image/png", "image/webp", "image/gif"})
SUPPORTED_TYPES = SUPPORTED_IMAGE_TYPES | {PDF_TYPE}

# The API caps a request at 32MB, and base64 inflates the file by a third on
# the way there. 20MB of original file leaves room for the encoding and the
# prompt; a phone photo is a tenth of that and a scanned PDF rarely close.
MAX_FILE_BYTES = 20 * 1024 * 1024

# Generous because truncation is indistinguishable from a bad read: the model
# stops mid-JSON, parsing fails, and the user is told to take a clearer photo
# for a problem no photo fixes. A long delivery note runs to well over a
# hundred lines.
MAX_TOKENS = 8000

# We are on a worker, so this can be patient - the queue's own retry is what
# handles a genuinely stuck call.
REQUEST_TIMEOUT_SECONDS = 120.0

# The queue retries the whole job with backoff, so the SDK only needs to cover
# the momentary blips that a retry seconds later would fix.
MAX_SDK_RETRIES = 2

PROMPT = """You are reading a supplier invoice photographed by restaurant \
staff for stock-taking. Extract every line item you can read.

Rules:
- One entry per line item on the invoice, in the order they appear.
- "quantity" is required for every line item - if it is genuinely illegible, use 1.
- Use null for any other field you cannot read, rather than guessing.
- Do not include tax, subtotal, delivery charge or total rows as line items.
- "unit" is a short unit of measure if the invoice states one (e.g. "kg", "litre", "box", "each").
"""

# Enforced by the API rather than asked for in the prompt, so a response that
# parses is guaranteed to have this shape. The old prompt-only version failed
# open: any stray sentence around the JSON surfaced to staff as "try a clearer
# photo".
RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "supplier_name": {"type": ["string", "null"]},
        "invoice_date": {
            "type": ["string", "null"],
            "description": "ISO date, YYYY-MM-DD",
        },
        "line_items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "quantity": {"type": "number"},
                    "unit": {"type": ["string", "null"]},
                    "unit_price": {"type": ["number", "null"]},
                    "line_total": {"type": ["number", "null"]},
                },
                "required": ["name", "quantity", "unit", "unit_price", "line_total"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["supplier_name", "invoice_date", "line_items"],
    "additionalProperties": False,
}


#: Leading bytes that identify a file regardless of what the client called it.
#: Phones routinely upload a perfectly good PDF as application/octet-stream,
#: and a whitelist of declared types alone would turn those away.
_MAGIC = (
    (b"%PDF", PDF_TYPE),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
)


def sniff_content_type(head: bytes, declared: str = "") -> str:
    """Identify a file from its first bytes, falling back to what the client
    declared. Returns "" when neither is a type we can read."""
    for prefix, content_type in _MAGIC:
        if head.startswith(prefix):
            return content_type
    # WebP is a RIFF container - the marker sits after a 4-byte length.
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    return declared if declared in SUPPORTED_TYPES else ""


class ScanError(Exception):
    """Base for scan failures. The message is safe to show a user."""


class TransientScanError(ScanError):
    """Worth another go later - rate limited, overloaded, network trouble.

    Raised out of the job so the queue retries it with backoff.
    """


class PermanentScanError(ScanError):
    """Retrying will not help - no API key, a rejected request, an unreadable
    photo. Recorded on the invoice so staff can retake or key it in by hand.
    """


def _client() -> anthropic.Anthropic:
    if not settings.ANTHROPIC_API_KEY:
        raise PermanentScanError("Invoice scanning is not configured on this server.")
    return anthropic.Anthropic(
        api_key=settings.ANTHROPIC_API_KEY,
        timeout=REQUEST_TIMEOUT_SECONDS,
        max_retries=MAX_SDK_RETRIES,
    )


def _document_block(*, file_bytes: bytes, content_type: str) -> dict:
    """The content block carrying the invoice itself.

    A PDF goes as a `document`, not a rasterised page: the API reads PDFs
    natively, and rendering one to an image first would throw away the crisp
    text that makes a PDF the easiest case of the three.
    """
    encoded = base64.b64encode(file_bytes).decode("ascii")

    if content_type == PDF_TYPE:
        return {
            "type": "document",
            "source": {"type": "base64", "media_type": PDF_TYPE, "data": encoded},
        }
    return {
        "type": "image",
        "source": {"type": "base64", "media_type": content_type, "data": encoded},
    }


def extract_invoice_data(*, image_bytes: bytes, content_type: str) -> dict:
    """Read the invoice and return the object described by RESPONSE_SCHEMA.

    Raises TransientScanError for anything worth retrying and
    PermanentScanError for anything not.
    """
    content_type = content_type or "image/jpeg"
    if content_type not in SUPPORTED_TYPES:
        raise PermanentScanError(
            "That file type cannot be read - upload a photo (JPEG, PNG or WebP) or a PDF."
        )
    if len(image_bytes) > MAX_FILE_BYTES:
        raise PermanentScanError(
            "That file is too large to read - upload one under "
            f"{MAX_FILE_BYTES // (1024 * 1024)}MB."
        )

    client = _client()

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            messages=[
                {
                    "role": "user",
                    "content": [
                        _document_block(file_bytes=image_bytes, content_type=content_type),
                        {"type": "text", "text": PROMPT},
                    ],
                }
            ],
            output_config={"format": {"type": "json_schema", "schema": RESPONSE_SCHEMA}},
        )
    except (anthropic.RateLimitError, anthropic.InternalServerError) as exc:
        raise TransientScanError(
            "The invoice scanning service is busy - this will be retried automatically."
        ) from exc
    except (anthropic.APIConnectionError, anthropic.APITimeoutError) as exc:
        raise TransientScanError(
            "Could not reach the invoice scanning service - this will be retried automatically."
        ) from exc
    except anthropic.APIStatusError as exc:
        # 400/401/403/413 and friends: the request itself is wrong, and sending
        # it again unchanged produces the same answer.
        logger.exception("Invoice scan rejected by the API")
        raise PermanentScanError(
            "Could not read that invoice - the scanning service rejected it."
        ) from exc

    if response.stop_reason == "refusal":
        raise PermanentScanError("Could not read that invoice - the scan was declined.")

    try:
        text = next(block.text for block in response.content if block.type == "text")
        data = json.loads(text)
    except (StopIteration, json.JSONDecodeError, TypeError, ValueError) as exc:
        raise PermanentScanError("Could not read that invoice - try a clearer photo.") from exc

    if not isinstance(data, dict) or not isinstance(data.get("line_items"), list):
        raise PermanentScanError("Could not read that invoice - try a clearer photo.")

    return data


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

    invoice.scan_state = InvoiceScan.ScanState.SCANNING
    invoice.scan_error = ""
    invoice.save(update_fields=["scan_state", "scan_error", "updated_at"])

    invoice.photo.open("rb")
    try:
        file_bytes = invoice.photo.read()
    finally:
        invoice.photo.close()

    try:
        data = extract_invoice_data(
            image_bytes=file_bytes,
            content_type=invoice.content_type or _type_from_name(invoice.photo.name),
        )
    except PermanentScanError as exc:
        invoice.scan_state = InvoiceScan.ScanState.FAILED
        invoice.scan_error = str(exc)[:500]
        invoice.save(update_fields=["scan_state", "scan_error", "updated_at"])
        return

    with transaction.atomic():
        invoice.line_items.all().delete()
        InvoiceLineItem.objects.bulk_create(
            [
                InvoiceLineItem(
                    invoice=invoice,
                    raw_name=str(line.get("name") or "Unnamed item")[:255],
                    quantity=_safe_decimal(line.get("quantity"), default=1),
                    unit=str(line.get("unit") or "")[:32],
                    unit_price=_safe_decimal(line.get("unit_price")),
                    line_total=_safe_decimal(line.get("line_total")),
                    sort_order=index,
                )
                for index, line in enumerate(data.get("line_items") or [])
                if isinstance(line, dict)
            ]
        )
        invoice.supplier_name = str(data.get("supplier_name") or "")[:200]
        invoice.invoice_date = _safe_date(data.get("invoice_date"))
        invoice.scan_state = InvoiceScan.ScanState.DONE
        invoice.scan_error = ""
        invoice.save(
            update_fields=[
                "supplier_name",
                "invoice_date",
                "scan_state",
                "scan_error",
                "updated_at",
            ]
        )


#: Fallback for rows uploaded before content_type was recorded. Extension is
#: weaker evidence than the type the client sent, which is why it is only the
#: fallback, but it is enough to tell a PDF from a photo.
_TYPE_BY_EXTENSION = {
    ".pdf": PDF_TYPE,
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


def _type_from_name(name: str) -> str:
    from pathlib import PurePosixPath

    return _TYPE_BY_EXTENSION.get(PurePosixPath(name or "").suffix.lower(), "image/jpeg")


def _safe_decimal(value, default=None):
    from decimal import Decimal, InvalidOperation

    if value is None:
        return default if default is None else Decimal(str(default))
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return default if default is None else Decimal(str(default))


def _safe_date(value):
    from datetime import datetime

    if not value:
        return None
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None
