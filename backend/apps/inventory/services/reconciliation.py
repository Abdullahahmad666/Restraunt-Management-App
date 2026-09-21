"""Checking an invoice's lines against the invoice's own total.

A misread quantity is the failure mode that matters most here: it is silent,
it moves stock, and it moves a cost figure, and nothing downstream can tell it
from a real delivery. The one thing on the page that disagrees with it is the
total the supplier printed - which is why that figure is copied rather than
calculated (see the extraction schema).

This never blocks anything. Plenty of invoices legitimately fail to add up:
delivery charges, discounts, deposits, a line the reader could not price. The
job is to say "these do not agree, and by how much", and let the person
looking at the paper decide.

Computed on read, never stored. A reviewer correcting a quantity changes the
answer, and a stored flag would be wrong from the moment they did.
"""

from dataclasses import dataclass
from decimal import Decimal

#: Per-line rounding is real - an invoice printing unit prices to the penny
#: and totalling exactly will drift by a penny a line. The flat part absorbs
#: a single rounding on the total itself.
BASE_TOLERANCE = Decimal("0.02")
PER_LINE_TOLERANCE = Decimal("0.01")


@dataclass(frozen=True)
class Reconciliation:
    #: "matches", "mismatch", or "unknown" when the invoice states no total.
    status: str
    #: Which printed figure this was checked against, for showing a human.
    basis: str
    expected: Decimal | None
    actual: Decimal | None
    difference: Decimal | None
    tolerance: Decimal | None


UNKNOWN = Reconciliation(
    status="unknown",
    basis="none",
    expected=None,
    actual=None,
    difference=None,
    tolerance=None,
)


def _expected_from(invoice) -> tuple[Decimal, str] | None:
    """The printed figure the line items should add up to.

    Line items are almost always net of tax, so the subtotal is the right
    comparison when there is one. Falling back to the total means subtracting
    the tax that the total includes - and when the invoice prints a total with
    no tax figure, the comparison is only as good as the assumption that the
    total is net. That assumption is named in `basis` rather than hidden, so
    nobody reads a mismatch as harder evidence than it is.
    """
    if invoice.stated_subtotal is not None:
        return invoice.stated_subtotal, "subtotal"
    if invoice.stated_total is not None and invoice.stated_tax is not None:
        return invoice.stated_total - invoice.stated_tax, "total_less_tax"
    if invoice.stated_total is not None:
        return invoice.stated_total, "total"
    return None


def reconcile(*, invoice, lines_total: Decimal | None) -> Reconciliation:
    """Compare what the lines add up to against what the invoice says."""
    if lines_total is None:
        return UNKNOWN

    expected = _expected_from(invoice)
    if expected is None:
        return UNKNOWN

    amount, basis = expected
    # len() over .all() rather than .count(): the viewset prefetches line
    # items, so this reads the cache, where .count() would be a query per
    # invoice on a list of them.
    line_count = len(invoice.line_items.all())
    tolerance = BASE_TOLERANCE + PER_LINE_TOLERANCE * line_count
    difference = lines_total - amount

    return Reconciliation(
        status="matches" if abs(difference) <= tolerance else "mismatch",
        basis=basis,
        expected=amount,
        actual=lines_total,
        difference=difference,
        tolerance=tolerance,
    )
