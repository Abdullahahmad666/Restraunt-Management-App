"""Reading a supplier invoice with a vision model.

Everything here is about not being trusted. The result is a proposal a person
reviews before it moves stock or money, so the job is to come back with
something honest about what it could not read, rather than something complete.

Two choices are load-bearing:

The response shape is enforced by the API, not requested in the prompt. Asking
for "only JSON" in prose fails open - one stray sentence and the parse fails,
which reaches staff as "try a clearer photo" for a problem no photo fixes.

Nulls are preferred over guesses, everywhere. A missing price is visible and
gets asked about; an invented one is invisible and gets believed.
"""

import base64
import json
import logging

import openai
from django.conf import settings

from .rasterise import TooManyPages, pdf_to_images

logger = logging.getLogger(__name__)

PDF_TYPE = "application/pdf"
SUPPORTED_IMAGE_TYPES = frozenset({"image/jpeg", "image/png", "image/webp", "image/gif"})
SUPPORTED_TYPES = SUPPORTED_IMAGE_TYPES | {PDF_TYPE}

#: Uploads are capped well below any provider limit - a phone photo is a
#: tenth of this and a scanned delivery note rarely close.
MAX_FILE_BYTES = 20 * 1024 * 1024

#: Patient because this runs on a worker; the queue's own retry handles a call
#: that genuinely hangs.
REQUEST_TIMEOUT_SECONDS = 180.0

#: Covers the momentary blip a retry seconds later would fix. Anything longer
#: is the queue's job, with its own backoff.
MAX_SDK_RETRIES = 2


PROMPT = """Extract structured data from the provided invoice image or PDF.

Use this schema. Return every field; use null where a value is missing or \
unreadable.

Rules:

* Support invoices in any layout, including tables, text-based PDFs, scanned \
PDFs, and images.
* Extract fields based on their meaning, not their position or exact label.
* Common equivalent labels include Invoice No/Invoice Number, Date/Invoice \
Date, VAT Reg No/VAT Number/Tax ID, Goods Total/Subtotal, Total/Amount \
Due/Balance Due/Invoice Total, and similar variations.
* Extract all invoice line items across all pages. A single photograph may \
show more than one page of the same invoice; combine them into one result.
* Dates are UK format: day first. "22/09/26" is 22 September 2026, not \
26 September 2022. Return dates as YYYY-MM-DD.
* Preserve the value and currency as shown. Do not convert currencies.
* Do not guess, infer, or invent information. Use null when a field is \
missing or unreadable.
* Do not calculate missing values unless the value is explicitly derivable \
from clearly readable invoice data. In particular, copy the printed totals; \
do not add the lines up yourself.
* Keep product descriptions as written, while removing obvious OCR noise. \
A diagonal watermark across the page is noise, not part of a description.
* Distinguish supplier, customer/billing address, and shipping/delivery \
address correctly. The supplier is who issued the document and is owed the \
money; the customer is who receives the goods and pays.
* "document_type" is "credit_note" when the page is a credit note, refund or \
returns note - it will usually say so, and may print its amounts as \
negatives. Otherwise "invoice". Report every quantity as a positive number \
even on a credit note; document_type is what says the goods went back. Use a \
negative quantity only for a single returned line inside an otherwise normal \
invoice.
* Ignore bank details, payment instructions, signatures, delivery \
instructions, handwritten annotations, and other non-invoice content.
* If the document is not an invoice or credit note, set "is_invoice" to false \
and return the remaining fields as null or empty arrays.
* For uncertain values, prefer null over guessing."""


def _nullable(*types: str) -> dict:
    return {"type": [*types, "null"]}


_PARTY_SCHEMA = {
    "type": "object",
    "properties": {
        "name": _nullable("string"),
        "address": _nullable("string"),
        "email": _nullable("string"),
        "phone": _nullable("string"),
        "tax_id": _nullable("string"),
    },
    "required": ["name", "address", "email", "phone", "tax_id"],
    "additionalProperties": False,
}

_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "product_code": _nullable("string"),
        "description": _nullable("string"),
        "size": _nullable("string"),
        "quantity": _nullable("number"),
        "unit_price": _nullable("number"),
        "tax_rate": _nullable("number"),
        "tax_amount": _nullable("number"),
        "discount": _nullable("number"),
        "line_total": _nullable("number"),
    },
    "required": [
        "product_code",
        "description",
        "size",
        "quantity",
        "unit_price",
        "tax_rate",
        "tax_amount",
        "discount",
        "line_total",
    ],
    "additionalProperties": False,
}

#: Enforced by the API. `strict` requires every property to be listed in
#: `required` and additionalProperties to be false, so optional fields are
#: expressed as nullable rather than absent.
RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "is_invoice": {"type": "boolean"},
        "document_type": {"type": "string", "enum": ["invoice", "credit_note"]},
        "invoice_number": _nullable("string"),
        "invoice_date": _nullable("string"),
        "due_date": _nullable("string"),
        "currency": _nullable("string"),
        "supplier": _PARTY_SCHEMA,
        "customer": _PARTY_SCHEMA,
        "shipping_address": _nullable("string"),
        "items": {"type": "array", "items": _ITEM_SCHEMA},
        "subtotal": _nullable("number"),
        "tax_total": _nullable("number"),
        "discount_total": _nullable("number"),
        "delivery_charge": _nullable("number"),
        "total": _nullable("number"),
        "amount_due": _nullable("number"),
    },
    "required": [
        "is_invoice",
        "document_type",
        "invoice_number",
        "invoice_date",
        "due_date",
        "currency",
        "supplier",
        "customer",
        "shipping_address",
        "items",
        "subtotal",
        "tax_total",
        "discount_total",
        "delivery_charge",
        "total",
        "amount_due",
    ],
    "additionalProperties": False,
}


class ScanError(Exception):
    """Base for scan failures. The message is safe to show a user."""


class TransientScanError(ScanError):
    """Worth another go later - rate limited, overloaded, network trouble."""


class PermanentScanError(ScanError):
    """Retrying will not help - no API key, a rejected request, an unreadable
    photo, a page that is not an invoice at all."""


def _client() -> openai.OpenAI:
    if not settings.OPENAI_API_KEY:
        raise PermanentScanError("Invoice scanning is not configured on this server.")
    return openai.OpenAI(
        api_key=settings.OPENAI_API_KEY,
        timeout=REQUEST_TIMEOUT_SECONDS,
        max_retries=MAX_SDK_RETRIES,
    )


def _image_part(image_bytes: bytes, content_type: str) -> dict:
    encoded = base64.b64encode(image_bytes).decode("ascii")
    return {
        "type": "input_image",
        "image_url": f"data:{content_type};base64,{encoded}",
        # Dot-matrix print, carbon copies and watermarked scans all need the
        # detail; "low" downsamples past the point these are readable.
        "detail": "high",
    }


def _pages_for(*, file_bytes: bytes, content_type: str) -> list[dict]:
    """The image parts to send, one per page."""
    if content_type != PDF_TYPE:
        return [_image_part(file_bytes, content_type)]

    try:
        rendered = pdf_to_images(file_bytes)
    except TooManyPages as exc:
        raise PermanentScanError(
            f"That PDF has {exc.args[0]} pages, which is more than an invoice is expected "
            "to run to. Upload the pages with the line items on them."
        ) from exc
    except Exception as exc:  # noqa: BLE001 - a corrupt PDF raises many things
        raise PermanentScanError("That PDF could not be opened - try uploading it again.") from exc

    if not rendered:
        raise PermanentScanError("That PDF has no pages.")
    return [_image_part(page, "image/jpeg") for page in rendered]


def extract_invoice_data(*, image_bytes: bytes, content_type: str) -> dict:
    """Read one invoice and return the object described by RESPONSE_SCHEMA."""
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
    pages = _pages_for(file_bytes=image_bytes, content_type=content_type)

    try:
        response = client.responses.create(
            model=settings.OPENAI_MODEL,
            input=[
                {"role": "developer", "content": [{"type": "input_text", "text": PROMPT}]},
                {"role": "user", "content": pages},
            ],
            text={
                "format": {
                    "type": "json_schema",
                    "name": "invoice",
                    "schema": RESPONSE_SCHEMA,
                    "strict": True,
                }
            },
            # Not stored on the provider's side. These pages carry a
            # supplier's pricing and our own trading address, and keeping
            # copies somewhere we do not control is a decision to take
            # deliberately rather than by leaving a default on.
            store=False,
        )
    except (openai.RateLimitError, openai.InternalServerError) as exc:
        raise TransientScanError(
            "The invoice scanning service is busy - this will be retried automatically."
        ) from exc
    except (openai.APIConnectionError, openai.APITimeoutError) as exc:
        raise TransientScanError(
            "Could not reach the invoice scanning service - this will be retried automatically."
        ) from exc
    except openai.APIStatusError as exc:
        # 400/401/403/413: the request itself is wrong, and sending it again
        # unchanged produces the same answer.
        logger.exception("Invoice scan rejected by the API")
        raise PermanentScanError(
            "Could not read that invoice - the scanning service rejected it."
        ) from exc

    return _parse(response)


def _parse(response) -> dict:
    text = getattr(response, "output_text", None)
    if not text:
        raise PermanentScanError("Could not read that invoice - try a clearer photo.")

    try:
        data = json.loads(text)
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        raise PermanentScanError("Could not read that invoice - try a clearer photo.") from exc

    if not isinstance(data, dict):
        raise PermanentScanError("Could not read that invoice - try a clearer photo.")

    # Told to us rather than guessed at: a menu or a bank statement photographed
    # by mistake comes back with this false, and saying so is far better than
    # returning an invoice with every field null.
    if data.get("is_invoice") is False:
        raise PermanentScanError(
            "That does not look like an invoice or a credit note. Upload the invoice itself."
        )

    if not isinstance(data.get("items"), list):
        raise PermanentScanError("Could not read that invoice - try a clearer photo.")

    return data
