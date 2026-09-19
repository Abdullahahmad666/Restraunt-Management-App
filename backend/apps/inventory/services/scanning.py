"""Turning a photographed invoice into structured line items via a
vision-capable AI model.

This only ever produces a *proposal* - apps.inventory.api.staff creates the
InvoiceScan and its InvoiceLineItem rows from what this returns, all still
in PENDING status, and nothing touches actual stock until a human reviews,
corrects and confirms it (see services.stock.confirm_invoice). A misread
quantity or price is an annoyance to fix in review; the same misread
silently applied to stock and cost figures is a real problem, so this
function is not trusted further than "a first draft".
"""

import base64
import json

import requests
from django.conf import settings
from django.core.exceptions import ValidationError

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
# An alias rather than a dated snapshot, so this keeps working as Anthropic
# rolls the alias forward - pin to a dated model string instead if the
# extraction prompt/schema below ever needs to stay locked to one model's
# exact behaviour.
MODEL = "claude-sonnet-4-5"
REQUEST_TIMEOUT_SECONDS = 45

PROMPT = """You are reading a supplier invoice photographed by restaurant \
staff for stock-taking. Extract every line item you can read.

Return ONLY a JSON object, no markdown code fences, no commentary before or \
after it, matching exactly this shape:

{
  "supplier_name": string or null,
  "invoice_date": "YYYY-MM-DD" or null,
  "line_items": [
    {
      "name": string,
      "quantity": number,
      "unit": string or null,
      "unit_price": number or null,
      "line_total": number or null
    }
  ]
}

Rules:
- One entry per line item on the invoice, in the order they appear.
- "quantity" is required for every line item - if it is genuinely illegible, use 1.
- Use null for any other field you cannot read, rather than guessing.
- Do not include tax, subtotal, delivery charge or total rows as line items.
- "unit" is a short unit of measure if the invoice states one (e.g. "kg", "litre", "box", "each") - null if it doesn't.
"""


def _extract_text(payload: dict) -> str:
    return "".join(
        block.get("text", "") for block in payload.get("content", []) if block.get("type") == "text"
    )


def extract_invoice_data(*, image_bytes: bytes, content_type: str) -> dict:
    """Calls the Anthropic Messages API with the invoice photo and returns
    the parsed JSON object described in PROMPT above. Raises
    django.core.exceptions.ValidationError (with a message safe to show a
    user) on any failure - a missing API key, a network/API error, or a
    response that isn't valid JSON in the expected shape."""
    api_key = settings.ANTHROPIC_API_KEY
    if not api_key:
        raise ValidationError("Invoice scanning is not configured on this server.")

    media_type = content_type or "image/jpeg"
    encoded = base64.b64encode(image_bytes).decode("ascii")

    try:
        response = requests.post(
            ANTHROPIC_API_URL,
            headers={
                "x-api-key": api_key,
                "anthropic-version": ANTHROPIC_VERSION,
                "content-type": "application/json",
            },
            json={
                "model": MODEL,
                "max_tokens": 2000,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": media_type,
                                    "data": encoded,
                                },
                            },
                            {"type": "text", "text": PROMPT},
                        ],
                    }
                ],
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise ValidationError(
            "Could not reach the invoice scanning service - check your connection and try again."
        ) from exc

    if response.status_code != 200:
        raise ValidationError(
            "Could not read that invoice - the scanning service returned an error."
        )

    try:
        text = _extract_text(response.json())
        data = json.loads(text)
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        raise ValidationError("Could not read that invoice - try a clearer photo.") from exc

    if not isinstance(data, dict) or not isinstance(data.get("line_items"), list):
        raise ValidationError("Could not read that invoice - try a clearer photo.")

    return data
