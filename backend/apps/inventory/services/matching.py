"""Attaching a scanned line to the inventory item it means.

Two sources, in order of how much they are worth trusting:

1. An alias someone taught us by confirming an invoice with that wording.
2. The item's own name, when the line happens to say the same thing.

Both are suggestions. A match still appears in review with the item named
beside it, and a reviewer who disagrees changes it - the same as when there is
no match at all. Nothing here moves stock; only confirming does that.

Resolution is deliberately batched. A fifty-line delivery note matched one line
at a time is fifty alias lookups and fifty scans of the item list; done
together it is two queries whatever the invoice's length.
"""

from ..models import InventoryItem, ItemAlias, normalize_item_text


def resolve_items(*, restaurant_id, raw_names: list[str]) -> dict[str, InventoryItem]:
    """Map each of `raw_names` to an inventory item, where one can be found.

    Names with no match are absent from the result rather than present with a
    None - "we did not recognise this" is the caller's normal case, not an
    error to unpack.
    """
    wanted = {normalize_item_text(name) for name in raw_names}
    wanted.discard("")
    if not wanted:
        return {}

    by_normalized: dict[str, InventoryItem] = {}

    # An item's own name first, so an alias can override it below - a person
    # saying "this wording means that item" outranks a coincidence of spelling.
    for item in InventoryItem.objects.filter(restaurant_id=restaurant_id, is_active=True):
        normalized = normalize_item_text(item.name)
        if normalized in wanted:
            by_normalized[normalized] = item

    aliases = ItemAlias.objects.filter(
        restaurant_id=restaurant_id, normalized_text__in=wanted
    ).select_related("item")
    for alias in aliases:
        if alias.item.is_active:
            by_normalized[alias.normalized_text] = alias.item

    return {
        name: by_normalized[normalize_item_text(name)]
        for name in raw_names
        if normalize_item_text(name) in by_normalized
    }


def match_item(*, restaurant_id, raw_name: str) -> InventoryItem | None:
    """The inventory item one line most likely refers to, or None."""
    return resolve_items(restaurant_id=restaurant_id, raw_names=[raw_name]).get(raw_name)


def learn_aliases(*, restaurant, invoice) -> int:
    """Remember how this invoice's lines were matched.

    Called on confirmation, which is the point a person accepted the whole
    invoice - a half-finished review is full of matches someone is still
    correcting, and learning from those would teach the wrong thing.

    A wording that already means something else is re-pointed rather than
    duplicated: one meaning per wording, and the most recent human decision is
    the one to keep.
    """
    learned = 0
    for line in invoice.line_items.all():
        if line.matched_item_id is None:
            continue
        normalized = normalize_item_text(line.raw_name)
        if not normalized:
            continue

        _, created = ItemAlias.objects.update_or_create(
            restaurant=restaurant,
            normalized_text=normalized,
            defaults={"item_id": line.matched_item_id, "text": line.raw_name},
        )
        learned += int(created)
    return learned
