"""Turning the destination printed on an invoice into a storage area.

Unlike suppliers and products, this one *does* create what it does not find.
The trade is deliberate and worth stating, because it cuts against the rule
everywhere else in this app: a misread here becomes a permanent row in every
warehouse filter, and nothing notices until a person does.

What makes it acceptable is the shape of the data. A restaurant has a handful
of storage areas and they repeat on every delivery note, so the second invoice
matches the first rather than adding another. Products are the opposite -
hundreds of them, each spelled differently by each supplier - which is why
those are only ever matched.

The guard is that nothing short or blank is ever created, and an admin can
retire anything that slips through without losing the invoices that named it.
"""

import logging

from ..models import Warehouse, normalize_warehouse_name

logger = logging.getLogger(__name__)

#: Below this, a "location" is more likely a stray character off the page than
#: somewhere a delivery went.
MIN_NAME_LENGTH = 2


def resolve_warehouse(*, restaurant_id, raw_name: str) -> Warehouse | None:
    """The storage area this text names, creating it if it is new.

    Returns None when there is nothing usable to work from, which is the
    normal case - most invoices say nothing about where goods ended up.
    """
    cleaned = " ".join((raw_name or "").split())
    normalized = normalize_warehouse_name(cleaned)
    if len(normalized) < MIN_NAME_LENGTH:
        return None

    existing = Warehouse.objects.filter(
        restaurant_id=restaurant_id, normalized_name=normalized
    ).first()
    if existing is not None:
        # Returned even when retired: the invoice did go there, and silently
        # creating a second row with the same name would be worse than
        # naming a warehouse an admin has since put away.
        return existing

    warehouse = Warehouse.objects.create(restaurant_id=restaurant_id, name=cleaned[:120])
    logger.info("Created warehouse %s from a scanned invoice", warehouse.id)
    return warehouse
