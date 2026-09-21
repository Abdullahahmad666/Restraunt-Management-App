"""Checking an invoice's lines against the total it prints.

A misread quantity is silent, moves stock, moves a cost figure, and looks like
a real delivery. The supplier's own printed total is the one thing on the page
that disagrees with it.
"""

from decimal import Decimal

import pytest
from django.urls import reverse

from apps.common.roles import Role
from apps.inventory.models import InventoryItem, InvoiceScan
from apps.inventory.services.reconciliation import reconcile
from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db

DETAIL = "v1:staff:inventory:invoice-scan-detail"


@pytest.fixture
def restaurant():
    return Restaurant.objects.create(name="The Test Kitchen", currency="GBP", is_approved=True)


@pytest.fixture
def staff_member(django_user_model, restaurant):
    return django_user_model.objects.create_user(
        email="alex@example.com", password="x", role=Role.STAFF, restaurant=restaurant
    )


@pytest.fixture
def item(restaurant):
    return InventoryItem.objects.create(restaurant=restaurant, name="Ketchup", unit="bottle")


def make_invoice(restaurant, item, lines, **stated):
    invoice = InvoiceScan.objects.create(
        restaurant=restaurant, photo="invoice_scans/x.jpg", **stated
    )
    for index, (quantity, line_total) in enumerate(lines):
        invoice.line_items.create(
            raw_name="Ketchup",
            matched_item=item,
            quantity=Decimal(str(quantity)),
            line_total=Decimal(str(line_total)),
            sort_order=index,
        )
    return invoice


# ---------------------------------------------------------------------------
# Which figure gets compared
# ---------------------------------------------------------------------------


def test_the_subtotal_is_preferred_when_printed(restaurant, item):
    """Line items are net of tax, so the subtotal is the direct comparison."""
    invoice = make_invoice(
        restaurant,
        item,
        [(1, 10), (1, 20)],
        stated_subtotal=Decimal("30"),
        stated_tax=Decimal("6"),
        stated_total=Decimal("36"),
    )

    result = reconcile(invoice=invoice, lines_total=Decimal("30"))

    assert result.status == "matches"
    assert result.basis == "subtotal"


def test_tax_is_subtracted_when_there_is_no_subtotal(restaurant, item):
    invoice = make_invoice(
        restaurant,
        item,
        [(1, 30)],
        stated_tax=Decimal("6"),
        stated_total=Decimal("36"),
    )

    result = reconcile(invoice=invoice, lines_total=Decimal("30"))

    assert result.status == "matches"
    assert result.basis == "total_less_tax"


def test_a_bare_total_is_compared_and_the_assumption_is_named(restaurant, item):
    """Comparing against a gross total assumes it is net. The assumption is
    named in `basis` rather than hidden, so nobody reads a mismatch here as
    harder evidence than it is."""
    invoice = make_invoice(restaurant, item, [(1, 30)], stated_total=Decimal("30"))

    result = reconcile(invoice=invoice, lines_total=Decimal("30"))

    assert result.status == "matches"
    assert result.basis == "total"


def test_an_invoice_that_prints_no_total_says_unknown(restaurant, item):
    invoice = make_invoice(restaurant, item, [(1, 30)])

    result = reconcile(invoice=invoice, lines_total=Decimal("30"))

    assert result.status == "unknown"
    assert result.basis == "none"


# ---------------------------------------------------------------------------
# Catching the thing it exists to catch
# ---------------------------------------------------------------------------


def test_a_misread_quantity_is_caught(restaurant, item):
    """10 bottles read as 100: the lines now say ten times what the invoice
    says, and this is the only thing on the page that notices."""
    invoice = make_invoice(restaurant, item, [(100, 250)], stated_subtotal=Decimal("25"))

    result = reconcile(invoice=invoice, lines_total=Decimal("250"))

    assert result.status == "mismatch"
    assert result.difference == Decimal("225")


def test_penny_rounding_across_many_lines_is_not_a_mismatch(restaurant, item):
    """An invoice printing unit prices to the penny drifts by about a penny a
    line. Flagging that would train everyone to ignore the flag."""
    lines = [(1, "1.00") for _ in range(20)]
    invoice = make_invoice(restaurant, item, lines, stated_subtotal=Decimal("20.15"))

    result = reconcile(invoice=invoice, lines_total=Decimal("20"))

    assert result.status == "matches"
    assert result.tolerance == Decimal("0.22")


def test_a_difference_beyond_the_drift_is_a_mismatch(restaurant, item):
    invoice = make_invoice(restaurant, item, [(1, 10)], stated_subtotal=Decimal("12"))

    result = reconcile(invoice=invoice, lines_total=Decimal("10"))

    assert result.status == "mismatch"
    assert result.difference == Decimal("-2")


# ---------------------------------------------------------------------------
# Through the API
# ---------------------------------------------------------------------------


def test_the_invoice_carries_its_reconciliation(api_client, staff_member, restaurant, item):
    invoice = make_invoice(restaurant, item, [(1, 10)], stated_subtotal=Decimal("25"))
    api_client.force_authenticate(user=staff_member)

    response = api_client.get(reverse(DETAIL, kwargs={"pk": invoice.id}))

    assert response.data["reconciliation"]["status"] == "mismatch"
    assert Decimal(response.data["reconciliation"]["expected"]) == Decimal("25")
    assert Decimal(response.data["reconciliation"]["actual"]) == Decimal("10")


def test_a_mismatch_does_not_block_confirming(api_client, staff_member, restaurant, item):
    """Delivery charges, discounts and deposits all make an invoice
    legitimately fail to add up. This says so; the person decides."""
    invoice = make_invoice(restaurant, item, [(1, 10)], stated_subtotal=Decimal("25"))
    api_client.force_authenticate(user=staff_member)

    response = api_client.post(
        reverse("v1:staff:inventory:invoice-scan-confirm", kwargs={"pk": invoice.id})
    )

    assert response.status_code == 200, response.data
    invoice.refresh_from_db()
    assert invoice.status == InvoiceScan.Status.CONFIRMED
