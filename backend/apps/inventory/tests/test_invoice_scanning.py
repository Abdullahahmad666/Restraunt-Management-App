"""Uploading a photographed invoice, reviewing what the (mocked) vision
model read off it, and confirming it into stock. The real AI call
(apps.inventory.services.scanning.extract_invoice_data) is mocked
throughout - these tests are about the review/confirm workflow around it,
not about whether Anthropic's API itself works.
"""

import io
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image

from apps.common.roles import Role
from apps.inventory.models import InventoryItem, InvoiceScan
from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db

STAFF_INVOICES = "v1:staff:inventory:invoice-scan-list"


def invoice_photo():
    """A genuinely valid 1x1 PNG - ImageField runs it through Pillow to
    validate, so a hand-written byte string is too fragile to rely on."""
    buffer = io.BytesIO()
    Image.new("RGB", (1, 1)).save(buffer, format="PNG")
    return SimpleUploadedFile("invoice.png", buffer.getvalue(), content_type="image/png")


@pytest.fixture
def restaurant():
    return Restaurant.objects.create(name="The Test Kitchen", currency="GBP", is_approved=True)


@pytest.fixture
def other_restaurant():
    return Restaurant.objects.create(name="Down The Road", currency="GBP", is_approved=True)


@pytest.fixture
def staff_member(django_user_model, restaurant):
    return django_user_model.objects.create_user(
        email="alex@example.com",
        first_name="Alex",
        password="x",
        role=Role.STAFF,
        restaurant=restaurant,
    )


@pytest.fixture
def chicken(restaurant):
    return InventoryItem.objects.create(
        restaurant=restaurant, name="Chicken Breast", unit="kg", quantity_on_hand=Decimal("5")
    )


SCAN_RESULT = {
    "supplier_name": "Fresh Foods Ltd",
    "invoice_date": "2026-09-15",
    "line_items": [
        {
            "name": "Chicken Breast",
            "quantity": 10,
            "unit": "kg",
            "unit_price": 4.5,
            "line_total": 45,
        },
        {"name": "Basmati Rice", "quantity": 5, "unit": "kg", "unit_price": 2, "line_total": 10},
    ],
}


@pytest.fixture(autouse=True)
def _media_root(tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path


def _upload(api_client, mock_extract):
    with patch(
        "apps.inventory.api.staff.scanning_service.extract_invoice_data",
        return_value=mock_extract,
    ):
        return api_client.post(
            reverse(STAFF_INVOICES), {"photo": invoice_photo()}, format="multipart"
        )


# ---------------------------------------------------------------------------
# Uploading and scanning
# ---------------------------------------------------------------------------


def test_uploading_an_invoice_creates_line_items_from_the_scan(api_client, staff_member):
    api_client.force_authenticate(user=staff_member)

    response = _upload(api_client, SCAN_RESULT)

    assert response.status_code == 201, response.data
    assert response.data["status"] == "PENDING"
    assert response.data["supplier_name"] == "Fresh Foods Ltd"
    assert response.data["invoice_date"] == "2026-09-15"
    assert len(response.data["line_items"]) == 2
    assert response.data["line_items"][0]["raw_name"] == "Chicken Breast"
    assert response.data["line_items"][0]["matched_item"] is None


def test_a_failed_scan_leaves_the_invoice_pending_with_an_error(api_client, staff_member):
    api_client.force_authenticate(user=staff_member)

    with patch(
        "apps.inventory.api.staff.scanning_service.extract_invoice_data",
        side_effect=DjangoValidationError("Could not read that invoice - try a clearer photo."),
    ):
        response = api_client.post(
            reverse(STAFF_INVOICES), {"photo": invoice_photo()}, format="multipart"
        )

    assert response.status_code == 201, response.data
    assert response.data["status"] == "PENDING"
    assert response.data["line_items"] == []
    assert "clearer photo" in response.data["scan_error"]


def test_rescan_replaces_the_line_items(api_client, staff_member):
    api_client.force_authenticate(user=staff_member)
    created = _upload(api_client, SCAN_RESULT).data

    new_result = {
        "supplier_name": None,
        "invoice_date": None,
        "line_items": [{"name": "Milk", "quantity": 1}],
    }
    with patch(
        "apps.inventory.api.staff.scanning_service.extract_invoice_data", return_value=new_result
    ):
        response = api_client.post(
            reverse("v1:staff:inventory:invoice-scan-rescan", kwargs={"pk": created["id"]})
        )

    assert response.status_code == 200, response.data
    assert len(response.data["line_items"]) == 1
    assert response.data["line_items"][0]["raw_name"] == "Milk"


# ---------------------------------------------------------------------------
# Reviewing and matching line items
# ---------------------------------------------------------------------------


def test_staff_can_match_a_line_item_to_an_inventory_item(api_client, staff_member, chicken):
    api_client.force_authenticate(user=staff_member)
    created = _upload(api_client, SCAN_RESULT).data
    line_id = created["line_items"][0]["id"]

    response = api_client.patch(
        reverse("v1:staff:inventory:invoice-line-item-detail", kwargs={"pk": line_id}),
        {"matched_item": str(chicken.id)},
    )

    assert response.status_code == 200, response.data
    assert response.data["matched_item_name"] == "Chicken Breast"


def test_cannot_match_a_line_item_to_another_restaurants_inventory_item(
    api_client, staff_member, other_restaurant
):
    outside_item = InventoryItem.objects.create(
        restaurant=other_restaurant, name="Not yours", unit="kg"
    )
    api_client.force_authenticate(user=staff_member)
    created = _upload(api_client, SCAN_RESULT).data
    line_id = created["line_items"][0]["id"]

    response = api_client.patch(
        reverse("v1:staff:inventory:invoice-line-item-detail", kwargs={"pk": line_id}),
        {"matched_item": str(outside_item.id)},
    )

    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Confirming
# ---------------------------------------------------------------------------


def test_confirming_requires_every_line_matched(api_client, staff_member, chicken):
    api_client.force_authenticate(user=staff_member)
    created = _upload(api_client, SCAN_RESULT).data
    line_id = created["line_items"][0]["id"]
    api_client.patch(
        reverse("v1:staff:inventory:invoice-line-item-detail", kwargs={"pk": line_id}),
        {"matched_item": str(chicken.id)},
    )
    # The second line item is left unmatched.

    response = api_client.post(
        reverse("v1:staff:inventory:invoice-scan-confirm", kwargs={"pk": created["id"]})
    )

    assert response.status_code == 400


def test_confirming_applies_stock_and_cost_from_matched_lines(api_client, staff_member, chicken):
    api_client.force_authenticate(user=staff_member)
    created = _upload(
        api_client,
        {
            "supplier_name": "Fresh Foods Ltd",
            "invoice_date": None,
            "line_items": [
                {"name": "Chicken Breast", "quantity": 10, "unit": "kg", "unit_price": 4.5}
            ],
        },
    ).data
    line_id = created["line_items"][0]["id"]
    api_client.patch(
        reverse("v1:staff:inventory:invoice-line-item-detail", kwargs={"pk": line_id}),
        {"matched_item": str(chicken.id)},
    )

    response = api_client.post(
        reverse("v1:staff:inventory:invoice-scan-confirm", kwargs={"pk": created["id"]})
    )

    assert response.status_code == 200, response.data
    assert response.data["status"] == "CONFIRMED"

    chicken.refresh_from_db()
    assert chicken.quantity_on_hand == Decimal("15.00")  # 5 on hand + 10 delivered
    assert chicken.cost_per_unit == Decimal("4.50")


def test_confirming_twice_is_rejected(api_client, staff_member, chicken):
    api_client.force_authenticate(user=staff_member)
    created = _upload(
        api_client,
        {"supplier_name": None, "invoice_date": None, "line_items": [{"name": "x", "quantity": 1}]},
    ).data
    line_id = created["line_items"][0]["id"]
    api_client.patch(
        reverse("v1:staff:inventory:invoice-line-item-detail", kwargs={"pk": line_id}),
        {"matched_item": str(chicken.id)},
    )
    confirm_url = reverse("v1:staff:inventory:invoice-scan-confirm", kwargs={"pk": created["id"]})
    api_client.post(confirm_url)

    response = api_client.post(confirm_url)

    assert response.status_code == 400


def test_line_items_cannot_be_edited_after_confirmation(api_client, staff_member, chicken):
    api_client.force_authenticate(user=staff_member)
    created = _upload(
        api_client,
        {"supplier_name": None, "invoice_date": None, "line_items": [{"name": "x", "quantity": 1}]},
    ).data
    line_id = created["line_items"][0]["id"]
    api_client.patch(
        reverse("v1:staff:inventory:invoice-line-item-detail", kwargs={"pk": line_id}),
        {"matched_item": str(chicken.id)},
    )
    api_client.post(
        reverse("v1:staff:inventory:invoice-scan-confirm", kwargs={"pk": created["id"]})
    )

    response = api_client.patch(
        reverse("v1:staff:inventory:invoice-line-item-detail", kwargs={"pk": line_id}),
        {"quantity": "99.00"},
    )

    assert response.status_code == 400


def test_discarding_an_invoice(api_client, staff_member):
    api_client.force_authenticate(user=staff_member)
    created = _upload(api_client, SCAN_RESULT).data

    response = api_client.post(
        reverse("v1:staff:inventory:invoice-scan-discard", kwargs={"pk": created["id"]})
    )

    assert response.status_code == 200, response.data
    assert response.data["status"] == "DISCARDED"
    assert InvoiceScan.objects.get(id=created["id"]).status == InvoiceScan.Status.DISCARDED
