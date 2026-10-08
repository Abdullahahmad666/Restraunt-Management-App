"""A supplier crediting goods back.

A credit note is an invoice run backwards: a short delivery, a return,
something damaged. On paper it looks almost identical to an invoice, and in
effect it is the exact opposite - its lines came *out* of stock and its money
came back.

Read as an ordinary invoice it adds the stock it should remove and adds the
spend it should return, and nothing downstream can tell that from a real
delivery. These cover getting the direction right.
"""

import io
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image

from apps.common.roles import Role
from apps.inventory.models import InventoryItem, InvoiceScan, StockMovement
from apps.inventory.tests.factories import line, scan_result
from apps.jobs.services import queue
from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db

INVOICES = "v1:staff:inventory:invoice-scan-list"
BY_ITEM = "v1:admin:inventory:purchases-by-item"
SUMMARY = "v1:admin:inventory:purchases-summary"


def _png(size):
    buffer = io.BytesIO()
    Image.new("RGB", (size, size)).save(buffer, format="PNG")
    return SimpleUploadedFile(f"d-{size}.png", buffer.getvalue(), content_type="image/png")


@pytest.fixture(autouse=True)
def _media_root(tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path


@pytest.fixture
def restaurant():
    return Restaurant.objects.create(name="The Test Kitchen", currency="GBP", is_approved=True)


@pytest.fixture
def staff_member(django_user_model, restaurant):
    return django_user_model.objects.create_user(
        email="alex@example.com", password="x", role=Role.STAFF, restaurant=restaurant
    )


@pytest.fixture
def admin_user(django_user_model, restaurant):
    return django_user_model.objects.create_user(
        email="sam@example.com", password="x", role=Role.ADMIN, restaurant=restaurant
    )


@pytest.fixture
def chicken(restaurant):
    return InventoryItem.objects.create(
        restaurant=restaurant,
        name="Chicken",
        unit="kg",
        quantity_on_hand=Decimal("20"),
        cost_per_unit=Decimal("5"),
    )


def scan_and_confirm(api_client, chicken, *, document_type, quantity, unit_price, size):
    """Scan a document, match its one line, and confirm it."""
    result = scan_result(
        document_type=document_type,
        items=[
            line(
                "Chicken",
                quantity=quantity,
                unit_price=unit_price,
                line_total=quantity * unit_price,
                size="kg",
            )
        ],
    )
    with patch("apps.inventory.services.scanning.extract_invoice_data", return_value=result):
        created = api_client.post(reverse(INVOICES), {"photo": _png(size)}, format="multipart")
        queue.run_next()

    invoice = InvoiceScan.objects.get(pk=created.data["id"])
    api_client.post(reverse("v1:staff:inventory:invoice-scan-confirm", kwargs={"pk": invoice.id}))
    invoice.refresh_from_db()
    return invoice


# ---------------------------------------------------------------------------
# Direction
# ---------------------------------------------------------------------------


def test_a_credit_note_takes_stock_back_out(api_client, staff_member, chicken):
    """The failure this exists to prevent: read as an invoice, these 4kg would
    be *added* to a count they actually left."""
    api_client.force_authenticate(user=staff_member)

    scan_and_confirm(
        api_client, chicken, document_type="credit_note", quantity=4, unit_price=5, size=2
    )

    chicken.refresh_from_db()
    assert chicken.quantity_on_hand == Decimal("16")


def test_an_ordinary_invoice_still_adds(api_client, staff_member, chicken):
    api_client.force_authenticate(user=staff_member)

    scan_and_confirm(api_client, chicken, document_type="invoice", quantity=4, unit_price=5, size=3)

    chicken.refresh_from_db()
    assert chicken.quantity_on_hand == Decimal("24")


def test_a_credit_is_logged_as_a_return_not_as_waste(api_client, staff_member, chicken):
    """The stock left but was not thrown away and the money came back - a
    manager reading the ledger has to be able to tell those apart."""
    api_client.force_authenticate(user=staff_member)

    scan_and_confirm(
        api_client, chicken, document_type="credit_note", quantity=4, unit_price=5, size=4
    )

    movement = StockMovement.objects.get()
    assert movement.reason == StockMovement.Reason.RETURN
    assert movement.quantity_delta == Decimal("-4")
    assert "credit note" in movement.note


def test_a_credit_note_does_not_rewrite_what_something_costs(api_client, staff_member, chicken):
    """It says what went back, not what things now cost. Letting it set the
    price would make a returned item's price the newest on record."""
    api_client.force_authenticate(user=staff_member)

    scan_and_confirm(
        api_client, chicken, document_type="credit_note", quantity=4, unit_price=99, size=5
    )

    chicken.refresh_from_db()
    assert chicken.cost_per_unit == Decimal("5")


# ---------------------------------------------------------------------------
# Spending
# ---------------------------------------------------------------------------


def test_a_credit_reduces_the_month_s_spend(api_client, staff_member, admin_user, chicken):
    """Otherwise a month where a lot went back looks like a month where a lot
    was bought."""
    api_client.force_authenticate(user=staff_member)
    scan_and_confirm(
        api_client, chicken, document_type="invoice", quantity=10, unit_price=5, size=6
    )
    scan_and_confirm(
        api_client, chicken, document_type="credit_note", quantity=4, unit_price=5, size=7
    )

    api_client.force_authenticate(user=admin_user)
    summary = api_client.get(reverse(SUMMARY)).data
    row = api_client.get(reverse(BY_ITEM)).data["results"][0]

    assert Decimal(summary["total_spend"]) == Decimal("30")
    assert Decimal(row["total_spend"]) == Decimal("30")
    assert Decimal(row["total_quantity"]) == Decimal("6")


def test_the_invoice_still_shows_what_the_page_says(api_client, staff_member, chicken):
    """A credit note printed as GBP 20 reads as GBP 20 on the page and as
    -GBP 20 in the month's spending. Both are right."""
    api_client.force_authenticate(user=staff_member)
    invoice = scan_and_confirm(
        api_client, chicken, document_type="credit_note", quantity=4, unit_price=5, size=8
    )

    response = api_client.get(
        reverse("v1:staff:inventory:invoice-scan-detail", kwargs={"pk": invoice.id})
    )

    assert response.data["document_type"] == "CREDIT_NOTE"
    assert Decimal(response.data["lines_total"]) == Decimal("20")


# ---------------------------------------------------------------------------
# A returned line inside an ordinary invoice
# ---------------------------------------------------------------------------


def test_a_negative_line_on_a_normal_invoice_subtracts(api_client, staff_member, chicken):
    """Suppliers credit a single line on an otherwise normal invoice. The
    prompt reserves a negative quantity for exactly that."""
    api_client.force_authenticate(user=staff_member)
    result = scan_result(
        items=[
            line("Chicken", quantity=10, unit_price=5, line_total=50, size="kg"),
            line("Chicken", quantity=-2, unit_price=5, line_total=-10, size="kg"),
        ]
    )
    with patch("apps.inventory.services.scanning.extract_invoice_data", return_value=result):
        created = api_client.post(reverse(INVOICES), {"photo": _png(9)}, format="multipart")
        queue.run_next()

    api_client.post(
        reverse("v1:staff:inventory:invoice-scan-confirm", kwargs={"pk": created.data["id"]})
    )

    chicken.refresh_from_db()
    assert chicken.quantity_on_hand == Decimal("28")


def test_the_same_item_on_two_lines_does_not_lose_one_of_them(api_client, staff_member, chicken):
    """Both lines carry their own instance of the item, each loaded at the
    same starting value. Adding to that in Python and writing it back erases
    whichever line was applied first."""
    api_client.force_authenticate(user=staff_member)
    result = scan_result(
        items=[
            line("Chicken", quantity=3, unit_price=5, line_total=15, size="kg"),
            line("Chicken", quantity=7, unit_price=5, line_total=35, size="kg"),
        ]
    )
    with patch("apps.inventory.services.scanning.extract_invoice_data", return_value=result):
        created = api_client.post(reverse(INVOICES), {"photo": _png(11)}, format="multipart")
        queue.run_next()

    api_client.post(
        reverse("v1:staff:inventory:invoice-scan-confirm", kwargs={"pk": created.data["id"]})
    )

    chicken.refresh_from_db()
    assert chicken.quantity_on_hand == Decimal("30"), "both lines must count"
