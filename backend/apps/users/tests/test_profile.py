"""The profile endpoint.

Two things worth pinning: the fields a user may change about themselves, and
the ones they must not - role and restaurant decide what they can see and do,
so a user editing their own is privilege escalation by another route.
"""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.common.roles import Role
from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db

ME = "v1:users:me"


@pytest.fixture
def restaurant():
    return Restaurant.objects.create(name="The Test Kitchen", currency="GBP")


@pytest.fixture
def staff(django_user_model, restaurant):
    return django_user_model.objects.create_user(
        email="waiter@example.com",
        password="test-password-123",
        role=Role.STAFF,
        restaurant=restaurant,
        first_name="Alex",
        last_name="Morgan",
    )


@pytest.fixture
def client(staff):
    api = APIClient()
    api.force_authenticate(user=staff)
    return api


def test_reading_your_own_profile(client, staff):
    response = client.get(reverse(ME))
    assert response.status_code == 200
    assert response.data["email"] == staff.email
    assert response.data["role"] == Role.STAFF


def test_a_json_patch_is_accepted(client, staff):
    """Most edits are plain fields; requiring multipart for them would be odd."""
    response = client.patch(
        reverse(ME),
        {"first_name": "Alexandra", "phone": "+44 7700 900123"},
        format="json",
    )
    assert response.status_code == 200, response.data

    staff.refresh_from_db()
    assert staff.first_name == "Alexandra"
    assert staff.phone == "+44 7700 900123"


def test_a_multipart_patch_is_also_accepted(client, staff):
    """The same endpoint takes the avatar upload, which has to be multipart."""
    response = client.patch(reverse(ME), {"last_name": "Morgan-Reid"}, format="multipart")
    assert response.status_code == 200, response.data

    staff.refresh_from_db()
    assert staff.last_name == "Morgan-Reid"


def test_a_user_cannot_promote_themselves(client, staff):
    response = client.patch(reverse(ME), {"role": Role.ADMIN}, format="json")
    assert response.status_code == 200, "read-only fields are ignored, not rejected"

    staff.refresh_from_db()
    assert staff.role == Role.STAFF, "role must be read-only on this endpoint"


def test_a_user_cannot_move_themselves_to_another_restaurant(client, staff, restaurant):
    somewhere_else = Restaurant.objects.create(name="Rival Kitchen", currency="GBP")

    client.patch(reverse(ME), {"restaurant": str(somewhere_else.id)}, format="json")

    staff.refresh_from_db()
    assert staff.restaurant_id == restaurant.id


def test_anonymous_callers_are_rejected():
    assert APIClient().get(reverse(ME)).status_code == 401
