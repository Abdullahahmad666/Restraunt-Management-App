"""Inventory items and the stock ledger - manual deliveries, waste and
corrections, all logged as StockMovement rows rather than editing
quantity_on_hand directly."""

from decimal import Decimal

import pytest
from django.urls import reverse

from apps.common.roles import Role
from apps.inventory.models import InventoryItem
from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db

ADMIN_ITEMS = "v1:admin:inventory:inventory-item-list"
STAFF_ITEMS = "v1:staff:inventory:inventory-item-list"
STAFF_MOVEMENTS = "v1:staff:inventory:stock-movement-list"


@pytest.fixture
def restaurant():
    return Restaurant.objects.create(name="The Test Kitchen", currency="GBP", is_approved=True)


@pytest.fixture
def other_restaurant():
    return Restaurant.objects.create(name="Down The Road", currency="GBP", is_approved=True)


@pytest.fixture
def admin(django_user_model, restaurant):
    return django_user_model.objects.create_user(
        email="owner@example.com", password="x", role=Role.ADMIN, restaurant=restaurant
    )


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
def item(restaurant):
    return InventoryItem.objects.create(
        restaurant=restaurant, name="Chicken Breast", unit="kg", quantity_on_hand=Decimal("10")
    )


# ---------------------------------------------------------------------------
# Managing items
# ---------------------------------------------------------------------------


def test_admin_can_create_an_inventory_item(api_client, admin):
    api_client.force_authenticate(user=admin)

    response = api_client.post(reverse(ADMIN_ITEMS), {"name": "Rice", "unit": "kg"})

    assert response.status_code == 201, response.data
    assert response.data["name"] == "Rice"
    assert response.data["quantity_on_hand"] == "0.00"


def test_staff_can_also_create_an_inventory_item(api_client, staff_member):
    """Needed inline while matching an invoice line to something new -
    see StaffInventoryItemViewSet's docstring."""
    api_client.force_authenticate(user=staff_member)

    response = api_client.post(reverse(STAFF_ITEMS), {"name": "Rice", "unit": "kg"})

    assert response.status_code == 201, response.data


def test_staff_sees_only_active_items(api_client, staff_member, restaurant):
    InventoryItem.objects.create(restaurant=restaurant, name="Retired", unit="kg", is_active=False)
    InventoryItem.objects.create(restaurant=restaurant, name="Rice", unit="kg")
    api_client.force_authenticate(user=staff_member)

    response = api_client.get(reverse(STAFF_ITEMS))

    names = [row["name"] for row in response.data["results"]]
    assert names == ["Rice"]


def test_admin_item_list_is_scoped_to_their_own_restaurant(
    api_client, admin, item, other_restaurant
):
    InventoryItem.objects.create(restaurant=other_restaurant, name="Not yours", unit="kg")
    api_client.force_authenticate(user=admin)

    response = api_client.get(reverse(ADMIN_ITEMS))

    names = [row["name"] for row in response.data["results"]]
    assert names == ["Chicken Breast"]


def test_admin_can_set_a_par_level(api_client, admin, item):
    api_client.force_authenticate(user=admin)

    response = api_client.patch(
        reverse("v1:admin:inventory:inventory-item-detail", kwargs={"pk": item.id}),
        {"par_level": "5.00"},
    )

    assert response.status_code == 200, response.data
    assert response.data["is_below_par"] is False  # 10 on hand, par 5 - not below


# ---------------------------------------------------------------------------
# Manual stock adjustments
# ---------------------------------------------------------------------------


def test_staff_can_log_a_delivery(api_client, staff_member, item):
    api_client.force_authenticate(user=staff_member)

    response = api_client.post(
        reverse(STAFF_MOVEMENTS),
        {"item": str(item.id), "quantity_delta": "5.00", "reason": "DELIVERY"},
    )

    assert response.status_code == 201, response.data
    assert response.data["recorded_by_name"] == "Alex"

    item.refresh_from_db()
    assert item.quantity_on_hand == Decimal("15.00")


def test_staff_can_log_waste_reducing_stock(api_client, staff_member, item):
    api_client.force_authenticate(user=staff_member)

    response = api_client.post(
        reverse(STAFF_MOVEMENTS),
        {"item": str(item.id), "quantity_delta": "-2.00", "reason": "WASTE", "note": "Dropped it"},
    )

    assert response.status_code == 201, response.data

    item.refresh_from_db()
    assert item.quantity_on_hand == Decimal("8.00")


def test_movements_are_filterable_by_item(api_client, staff_member, item, restaurant):
    other_item = InventoryItem.objects.create(restaurant=restaurant, name="Rice", unit="kg")
    api_client.force_authenticate(user=staff_member)
    api_client.post(
        reverse(STAFF_MOVEMENTS),
        {"item": str(item.id), "quantity_delta": "1.00", "reason": "CORRECTION"},
    )
    api_client.post(
        reverse(STAFF_MOVEMENTS),
        {"item": str(other_item.id), "quantity_delta": "1.00", "reason": "CORRECTION"},
    )

    response = api_client.get(reverse(STAFF_MOVEMENTS), {"item": str(item.id)})

    assert response.data["count"] == 1


def test_cannot_adjust_stock_for_another_restaurants_item(
    api_client, staff_member, other_restaurant
):
    outside_item = InventoryItem.objects.create(
        restaurant=other_restaurant, name="Not yours", unit="kg"
    )
    api_client.force_authenticate(user=staff_member)

    response = api_client.post(
        reverse(STAFF_MOVEMENTS),
        {"item": str(outside_item.id), "quantity_delta": "1.00", "reason": "CORRECTION"},
    )

    assert response.status_code == 400
