"""What the restaurant bought, from whom, into where, and when.

The figures here end up in front of a manager deciding what to spend, so most
of these are about what must *not* be counted: an invoice nobody confirmed,
another restaurant's deliveries, a line with no readable price quietly
counting as zero.
"""

from datetime import date
from decimal import Decimal

import pytest
from django.urls import reverse

from apps.common.roles import Role
from apps.inventory.models import InventoryItem, InvoiceScan, Supplier, Warehouse
from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db

BY_ITEM = "v1:admin:inventory:purchases-by-item"
TIMELINE = "v1:admin:inventory:purchases-timeline"
SUMMARY = "v1:admin:inventory:purchases-summary"


@pytest.fixture
def restaurant():
    return Restaurant.objects.create(name="The Test Kitchen", currency="GBP", is_approved=True)


@pytest.fixture
def other_restaurant():
    return Restaurant.objects.create(name="Down The Road", currency="GBP", is_approved=True)


@pytest.fixture
def admin_user(django_user_model, restaurant):
    return django_user_model.objects.create_user(
        email="sam@example.com", password="x", role=Role.ADMIN, restaurant=restaurant
    )


@pytest.fixture
def staff_member(django_user_model, restaurant):
    return django_user_model.objects.create_user(
        email="alex@example.com", password="x", role=Role.STAFF, restaurant=restaurant
    )


@pytest.fixture
def ketchup(restaurant):
    return InventoryItem.objects.create(restaurant=restaurant, name="Ketchup", unit="bottle")


@pytest.fixture
def rice(restaurant):
    return InventoryItem.objects.create(restaurant=restaurant, name="Rice", unit="kg")


def make_invoice(
    restaurant,
    lines,
    *,
    status=InvoiceScan.Status.CONFIRMED,
    invoice_date=date(2026, 3, 10),
    supplier=None,
    warehouse=None,
):
    """`lines` is (item, quantity, line_total) - line_total may be None."""
    invoice = InvoiceScan.objects.create(
        restaurant=restaurant,
        photo="invoice_scans/x.jpg",
        status=status,
        invoice_date=invoice_date,
        supplier=supplier,
        warehouse=warehouse,
    )
    for index, (item, quantity, line_total) in enumerate(lines):
        invoice.line_items.create(
            raw_name=item.name if item else "Unmatched",
            matched_item=item,
            quantity=Decimal(str(quantity)),
            line_total=None if line_total is None else Decimal(str(line_total)),
            sort_order=index,
        )
    return invoice


# ---------------------------------------------------------------------------
# What counts
# ---------------------------------------------------------------------------


def test_the_same_product_across_invoices_adds_up(api_client, admin_user, restaurant, ketchup):
    """The question the whole feature exists to answer."""
    make_invoice(restaurant, [(ketchup, 10, 25)], invoice_date=date(2026, 3, 1))
    make_invoice(restaurant, [(ketchup, 4, 10)], invoice_date=date(2026, 3, 20))
    api_client.force_authenticate(user=admin_user)

    row = api_client.get(reverse(BY_ITEM)).data["results"][0]

    assert row["item_name"] == "Ketchup"
    assert Decimal(row["total_quantity"]) == Decimal("14")
    assert Decimal(row["total_spend"]) == Decimal("35")
    assert row["invoice_count"] == 2


def test_an_unconfirmed_invoice_is_not_spend_yet(api_client, admin_user, restaurant, ketchup):
    """A pending invoice is a proposal nobody has accepted - a misread
    quantity must not reach the spend figures before someone agrees it."""
    make_invoice(restaurant, [(ketchup, 10, 25)], status=InvoiceScan.Status.PENDING)
    make_invoice(restaurant, [(ketchup, 1, 5)], status=InvoiceScan.Status.DISCARDED)
    api_client.force_authenticate(user=admin_user)

    assert api_client.get(reverse(BY_ITEM)).data["results"] == []
    assert Decimal(api_client.get(reverse(SUMMARY)).data["total_spend"]) == Decimal("0")


def test_another_restaurants_purchases_are_invisible(
    api_client, admin_user, restaurant, other_restaurant
):
    theirs = InventoryItem.objects.create(
        restaurant=other_restaurant, name="Ketchup", unit="bottle"
    )
    make_invoice(other_restaurant, [(theirs, 100, 500)])
    api_client.force_authenticate(user=admin_user)

    assert api_client.get(reverse(BY_ITEM)).data["results"] == []


def test_spend_falls_back_to_quantity_times_unit_price(api_client, admin_user, restaurant, ketchup):
    """Plenty of invoices print a unit price and no line total."""
    invoice = make_invoice(restaurant, [(ketchup, 3, None)])
    invoice.line_items.update(unit_price=Decimal("2.50"))
    api_client.force_authenticate(user=admin_user)

    row = api_client.get(reverse(BY_ITEM)).data["results"][0]

    assert Decimal(row["total_spend"]) == Decimal("7.50")


def test_a_line_with_no_price_is_counted_rather_than_hidden(
    api_client, admin_user, restaurant, ketchup
):
    """A total quietly missing a line is worse than one that says so."""
    make_invoice(restaurant, [(ketchup, 5, None)])
    api_client.force_authenticate(user=admin_user)

    summary = api_client.get(reverse(SUMMARY)).data

    assert Decimal(summary["total_spend"]) == Decimal("0")
    assert summary["lines_without_price"] == 1


def test_unmatched_lines_are_reported_not_absorbed(api_client, admin_user, restaurant, ketchup):
    """A line nobody matched has no product to attribute spend to, and an
    "other" bucket would hide exactly the lines that still need a person."""
    make_invoice(restaurant, [(ketchup, 1, 10), (None, 1, 99)])
    api_client.force_authenticate(user=admin_user)

    rows = api_client.get(reverse(BY_ITEM)).data["results"]
    summary = api_client.get(reverse(SUMMARY)).data

    assert len(rows) == 1
    assert summary["unmatched_lines"] == 1
    # The summary still counts the money, because it was spent.
    assert Decimal(summary["total_spend"]) == Decimal("109")


# ---------------------------------------------------------------------------
# Filtering
# ---------------------------------------------------------------------------


def test_filtering_by_supplier(api_client, admin_user, restaurant, ketchup):
    fresh = Supplier.objects.create(restaurant=restaurant, name="Fresh Foods Ltd")
    other = Supplier.objects.create(restaurant=restaurant, name="Someone Else")
    make_invoice(restaurant, [(ketchup, 10, 25)], supplier=fresh)
    make_invoice(restaurant, [(ketchup, 99, 990)], supplier=other)
    api_client.force_authenticate(user=admin_user)

    response = api_client.get(reverse(BY_ITEM), {"supplier": str(fresh.id)})

    assert Decimal(response.data["results"][0]["total_spend"]) == Decimal("25")


def test_filtering_by_warehouse(api_client, admin_user, restaurant, ketchup):
    cellar = Warehouse.objects.create(restaurant=restaurant, name="Cellar")
    dry = Warehouse.objects.create(restaurant=restaurant, name="Dry store")
    make_invoice(restaurant, [(ketchup, 10, 25)], warehouse=cellar)
    make_invoice(restaurant, [(ketchup, 99, 990)], warehouse=dry)
    api_client.force_authenticate(user=admin_user)

    response = api_client.get(reverse(BY_ITEM), {"warehouse": str(cellar.id)})

    assert Decimal(response.data["results"][0]["total_spend"]) == Decimal("25")


def test_filtering_by_date_range(api_client, admin_user, restaurant, ketchup):
    make_invoice(restaurant, [(ketchup, 1, 10)], invoice_date=date(2026, 1, 15))
    make_invoice(restaurant, [(ketchup, 1, 20)], invoice_date=date(2026, 3, 15))
    api_client.force_authenticate(user=admin_user)

    response = api_client.get(
        reverse(BY_ITEM), {"date_from": "2026-03-01", "date_to": "2026-03-31"}
    )

    assert Decimal(response.data["results"][0]["total_spend"]) == Decimal("20")


def test_a_backwards_date_range_is_rejected(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)

    response = api_client.get(
        reverse(BY_ITEM), {"date_from": "2026-03-31", "date_to": "2026-03-01"}
    )

    assert response.status_code == 400


def test_another_restaurants_supplier_cannot_be_used_as_a_filter(
    api_client, admin_user, other_restaurant
):
    """It would match nothing anyway - but answering at all confirms the id
    exists."""
    theirs = Supplier.objects.create(restaurant=other_restaurant, name="Not Ours")
    api_client.force_authenticate(user=admin_user)

    response = api_client.get(reverse(BY_ITEM), {"supplier": str(theirs.id)})

    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Over time
# ---------------------------------------------------------------------------


def test_spend_is_bucketed_by_month(api_client, admin_user, restaurant, ketchup):
    make_invoice(restaurant, [(ketchup, 1, 10)], invoice_date=date(2026, 1, 5))
    make_invoice(restaurant, [(ketchup, 1, 15)], invoice_date=date(2026, 1, 25))
    make_invoice(restaurant, [(ketchup, 1, 40)], invoice_date=date(2026, 2, 3))
    api_client.force_authenticate(user=admin_user)

    rows = api_client.get(reverse(TIMELINE), {"period": "month"}).data["results"]

    assert len(rows) == 2
    assert Decimal(rows[0]["total_spend"]) == Decimal("25")
    assert Decimal(rows[1]["total_spend"]) == Decimal("40")


def test_spend_is_bucketed_by_week(api_client, admin_user, restaurant, ketchup):
    make_invoice(restaurant, [(ketchup, 1, 10)], invoice_date=date(2026, 3, 2))
    make_invoice(restaurant, [(ketchup, 1, 20)], invoice_date=date(2026, 3, 10))
    api_client.force_authenticate(user=admin_user)

    rows = api_client.get(reverse(TIMELINE), {"period": "week"}).data["results"]

    assert len(rows) == 2


def test_an_unknown_period_is_rejected(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)

    assert api_client.get(reverse(TIMELINE), {"period": "fortnight"}).status_code == 400


def test_an_invoice_with_no_readable_date_still_appears(
    api_client, admin_user, restaurant, ketchup
):
    """Falling back to the upload date keeps the line in the history, which
    beats dropping it out of every total."""
    make_invoice(restaurant, [(ketchup, 1, 10)], invoice_date=None)
    api_client.force_authenticate(user=admin_user)

    rows = api_client.get(reverse(TIMELINE)).data["results"]

    assert len(rows) == 1
    assert rows[0]["bucket"] is not None


# ---------------------------------------------------------------------------
# Who may look
# ---------------------------------------------------------------------------


def test_staff_cannot_read_purchase_history(api_client, staff_member):
    api_client.force_authenticate(user=staff_member)

    assert api_client.get(reverse(BY_ITEM)).status_code == 403
    assert api_client.get(reverse(SUMMARY)).status_code == 403
    assert api_client.get(reverse(TIMELINE)).status_code == 403


def test_an_invoice_carries_its_own_total(api_client, admin_user, restaurant, ketchup, rice):
    """Per-invoice, alongside the cumulative figures - and from the same
    definition, so the two cannot disagree."""
    invoice = make_invoice(restaurant, [(ketchup, 2, 12), (rice, 1, 8)])
    api_client.force_authenticate(user=admin_user)

    response = api_client.get(
        reverse("v1:staff:inventory:invoice-scan-detail", kwargs={"pk": invoice.id})
    )

    assert Decimal(response.data["lines_total"]) == Decimal("20")


def test_listing_invoices_does_not_query_per_invoice(
    api_client, admin_user, restaurant, ketchup, django_assert_max_num_queries
):
    """The total is annotated, not summed row by row - otherwise a list of
    thirty invoices is thirty extra queries."""
    for _ in range(5):
        make_invoice(restaurant, [(ketchup, 1, 10)])
    api_client.force_authenticate(user=admin_user)

    with django_assert_max_num_queries(8):
        response = api_client.get(reverse("v1:staff:inventory:invoice-scan-list"))

    assert len(response.data["results"]) == 5
    assert all(Decimal(row["lines_total"]) == Decimal("10") for row in response.data["results"])


# ---------------------------------------------------------------------------
# VAT
# ---------------------------------------------------------------------------


def test_vat_is_counted_once_per_invoice_not_once_per_line(
    api_client, admin_user, restaurant, ketchup, rice
):
    """The trap this exists for.

    Tax is printed once on an invoice; the lines are what the goods cost. Sum
    it through the line join and a four-line delivery reports four times its
    VAT - a figure wrong by a factor nobody can see, because it still looks
    like money.
    """
    invoice = make_invoice(restaurant, [(ketchup, 10, 40), (rice, 2, 60)])
    invoice.stated_tax = Decimal("20.00")
    invoice.save(update_fields=["stated_tax"])
    api_client.force_authenticate(user=admin_user)

    summary = api_client.get(reverse(SUMMARY)).data

    assert Decimal(summary["total_spend"]) == Decimal("100")
    assert Decimal(summary["tax_total"]) == Decimal("20")
    assert summary["invoices_stating_tax"] == 1


def test_an_invoice_printing_no_vat_is_counted_as_printing_none(
    api_client, admin_user, restaurant, ketchup
):
    """Half a restaurant's suppliers showing no VAT means a tax figure that
    covers half its spending, so the count of invoices that stated any is
    reported beside it rather than left to be assumed."""
    priced = make_invoice(restaurant, [(ketchup, 1, 50)])
    priced.stated_tax = Decimal("10.00")
    priced.save(update_fields=["stated_tax"])
    make_invoice(restaurant, [(ketchup, 1, 50)])
    api_client.force_authenticate(user=admin_user)

    summary = api_client.get(reverse(SUMMARY)).data

    assert Decimal(summary["tax_total"]) == Decimal("10")
    assert summary["invoice_count"] == 2
    assert summary["invoices_stating_tax"] == 1


def test_a_credit_notes_vat_comes_back_off_the_total(api_client, admin_user, restaurant, ketchup):
    """A credit note reduces what was spent, and reduces the tax on it too -
    otherwise a month of returns reports tax on goods that went back."""
    bought = make_invoice(restaurant, [(ketchup, 10, 100)])
    bought.stated_tax = Decimal("20.00")
    bought.save(update_fields=["stated_tax"])

    returned = make_invoice(restaurant, [(ketchup, 2, 20)])
    returned.document_type = InvoiceScan.DocumentType.CREDIT_NOTE
    returned.stated_tax = Decimal("4.00")
    returned.save(update_fields=["document_type", "stated_tax"])
    api_client.force_authenticate(user=admin_user)

    summary = api_client.get(reverse(SUMMARY)).data

    assert Decimal(summary["total_spend"]) == Decimal("80")
    assert Decimal(summary["tax_total"]) == Decimal("16")
