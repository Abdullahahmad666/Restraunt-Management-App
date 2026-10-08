"""Turning the supplier name a scan read into a supplier we already know.

Matching only. Creating a supplier from scanned text would mean one misread
line - "Fresh Foods Lfd" - becomes a permanent row that shows up in every
filter, splits that supplier's price history in two, and needs a human to
notice and merge it later. A scan is a first draft; the supplier list is not
the place to find that out.

So: an invoice whose read name matches something already on the list gets
linked automatically, and anything else is left for the reviewer, who can pick
from the list or add a genuinely new supplier.
"""

from ..models import Supplier, normalize_supplier_name


def match_supplier(*, restaurant_id, raw_name: str) -> Supplier | None:
    """The supplier this name refers to, if the restaurant already has one.

    Matches on the normalized form, so "FRESH FOODS LTD." finds the supplier
    stored as "Fresh Foods Ltd". Takes an id rather than an instance because
    every caller already holds one and none of them needs the row.
    """
    normalized = normalize_supplier_name(raw_name)
    if not normalized:
        return None

    return Supplier.objects.filter(
        restaurant_id=restaurant_id, normalized_name=normalized, is_active=True
    ).first()
