"""The role split is only worth having if it is enforced. These tests are the
proof, and they are the template for every domain app that follows.

Two things are being checked, and they fail in different ways:
  - namespace access: can a staff token reach /api/v1/admin/ at all
  - row scoping: does a staff user see other restaurants' rows
"""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.common.roles import Role
from apps.restaurants.models import Restaurant, Table

pytestmark = pytest.mark.django_db


@pytest.fixture
def restaurant(db):
    return Restaurant.objects.create(name="The Test Kitchen", currency="PKR")


@pytest.fixture
def other_restaurant(db):
    return Restaurant.objects.create(name="Somebody Else's Place", currency="PKR")


@pytest.fixture
def staff_user(db, django_user_model, restaurant):
    return django_user_model.objects.create_user(
        email="waiter@example.com",
        password="test-password-123",
        role=Role.STAFF,
        restaurant=restaurant,
    )


@pytest.fixture
def admin_user(db, django_user_model, restaurant):
    return django_user_model.objects.create_user(
        email="owner@example.com",
        password="test-password-123",
        role=Role.ADMIN,
        restaurant=restaurant,
    )


@pytest.fixture
def staff_client(staff_user):
    client = APIClient()
    client.force_authenticate(user=staff_user)
    return client


@pytest.fixture
def admin_client(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


# --------------------------------------------------------------------------
# Namespace access
# --------------------------------------------------------------------------
def test_staff_cannot_reach_the_admin_namespace(staff_client):
    response = staff_client.get(reverse("v1:admin:restaurants:restaurant-list"))
    assert response.status_code == 403


def test_admin_can_reach_the_staff_namespace(admin_client):
    """Admins are inside STAFF_ROLES so an owner needs only one account."""
    response = admin_client.get(reverse("v1:staff:restaurants:restaurant-list"))
    assert response.status_code == 200


def test_anonymous_is_rejected_from_both_namespaces():
    client = APIClient()
    assert client.get(reverse("v1:staff:restaurants:restaurant-list")).status_code == 401
    assert client.get(reverse("v1:admin:restaurants:restaurant-list")).status_code == 401


# --------------------------------------------------------------------------
# Row scoping
# --------------------------------------------------------------------------
def test_staff_sees_only_their_own_restaurant(staff_client, restaurant, other_restaurant):
    response = staff_client.get(reverse("v1:staff:restaurants:restaurant-list"))
    assert response.status_code == 200
    returned = [row["id"] for row in response.data["results"]]
    assert returned == [str(restaurant.id)]


def test_staff_sees_only_their_own_restaurants_tables(staff_client, restaurant, other_restaurant):
    Table.objects.create(restaurant=restaurant, number="1")
    Table.objects.create(restaurant=other_restaurant, number="1")

    response = staff_client.get(reverse("v1:staff:restaurants:table-list"))
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_user_with_no_restaurant_sees_nothing(db, django_user_model, restaurant):
    """Fails closed: an unassigned account gets an empty list, not everything."""
    orphan = django_user_model.objects.create_user(
        email="unassigned@example.com", password="test-password-123", role=Role.STAFF
    )
    client = APIClient()
    client.force_authenticate(user=orphan)

    response = client.get(reverse("v1:staff:restaurants:restaurant-list"))
    assert response.status_code == 200
    assert response.data["count"] == 0


# --------------------------------------------------------------------------
# Write access differs by role
# --------------------------------------------------------------------------
def test_staff_cannot_create_a_restaurant(staff_client):
    response = staff_client.post(
        reverse("v1:staff:restaurants:restaurant-list"), {"name": "Not Allowed"}
    )
    assert response.status_code == 405


def test_admin_can_create_a_restaurant(admin_client):
    response = admin_client.post(
        reverse("v1:admin:restaurants:restaurant-list"), {"name": "Second Branch"}
    )
    assert response.status_code == 201, response.data
    assert Restaurant.objects.filter(name="Second Branch").exists()


def test_serializers_differ_by_role(admin_client, staff_client, restaurant):
    """Admin sees timezone/is_active; staff does not - the whole point of the split."""
    admin_response = admin_client.get(
        reverse("v1:admin:restaurants:restaurant-detail", args=[restaurant.id])
    )
    assert admin_response.status_code == 200
    assert {"timezone", "is_active"} <= set(admin_response.data)

    staff_response = staff_client.get(
        reverse("v1:staff:restaurants:restaurant-detail", args=[restaurant.id])
    )
    assert staff_response.status_code == 200
    assert {"timezone", "is_active"}.isdisjoint(staff_response.data)
