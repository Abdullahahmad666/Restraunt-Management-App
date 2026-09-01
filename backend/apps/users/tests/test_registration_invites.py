"""Registration is a public endpoint that can now set a role, so these tests
exist to prove it cannot be used to award oneself an admin account.

An admin here edits attendance records - the hours people are paid on - and
reads payroll. Self-service escalation would be a real hole, not a theoretical
one, which is why every route to ADMIN is checked rather than only the happy
path.
"""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.common.roles import Role
from apps.restaurants.models import Restaurant
from apps.users.models import InviteCode

pytestmark = pytest.mark.django_db

REGISTER = "v1:users:register"
PASSWORD = "a-perfectly-fine-password-42"


@pytest.fixture
def restaurant():
    return Restaurant.objects.create(name="The Test Kitchen", currency="GBP")


@pytest.fixture
def client():
    return APIClient()


def make_invite(restaurant, role=Role.ADMIN, **kwargs):
    return InviteCode.objects.create(restaurant=restaurant, role=role, **kwargs)


# ---------------------------------------------------------------------------
# The escalation gate
# ---------------------------------------------------------------------------
def test_cannot_register_as_admin_without_a_code(client, django_user_model):
    response = client.post(
        reverse(REGISTER),
        {"email": "sneaky@example.com", "password": PASSWORD, "role": Role.ADMIN},
    )
    assert response.status_code == 400
    assert "invite_code" in response.data
    assert not django_user_model.objects.filter(email="sneaky@example.com").exists()


def test_cannot_register_as_admin_with_a_made_up_code(client, django_user_model):
    response = client.post(
        reverse(REGISTER),
        {
            "email": "sneaky@example.com",
            "password": PASSWORD,
            "role": Role.ADMIN,
            "invite_code": "NOTREAL1",
        },
    )
    assert response.status_code == 400
    assert not django_user_model.objects.filter(email="sneaky@example.com").exists()


def test_a_staff_code_cannot_be_redeemed_for_an_admin_account(
    client, restaurant, django_user_model
):
    """The code must match the role being claimed, not merely exist."""
    staff_invite = make_invite(restaurant, role=Role.STAFF)

    response = client.post(
        reverse(REGISTER),
        {
            "email": "sneaky@example.com",
            "password": PASSWORD,
            "role": Role.ADMIN,
            "invite_code": staff_invite.code,
        },
    )
    assert response.status_code == 400
    assert not django_user_model.objects.filter(email="sneaky@example.com").exists()

    staff_invite.refresh_from_db()
    assert not staff_invite.is_used, "a rejected attempt must not burn the code"


def test_an_expired_code_is_rejected(client, restaurant, django_user_model):
    invite = make_invite(restaurant, expires_at=timezone.now() - timedelta(seconds=1))

    response = client.post(
        reverse(REGISTER),
        {
            "email": "late@example.com",
            "password": PASSWORD,
            "role": Role.ADMIN,
            "invite_code": invite.code,
        },
    )
    assert response.status_code == 400
    assert not django_user_model.objects.filter(email="late@example.com").exists()


def test_a_code_cannot_be_used_twice(client, restaurant, django_user_model):
    invite = make_invite(restaurant)

    first = client.post(
        reverse(REGISTER),
        {
            "email": "first@example.com",
            "password": PASSWORD,
            "role": Role.ADMIN,
            "invite_code": invite.code,
        },
    )
    assert first.status_code == 201

    second = client.post(
        reverse(REGISTER),
        {
            "email": "second@example.com",
            "password": PASSWORD,
            "role": Role.ADMIN,
            "invite_code": invite.code,
        },
    )
    assert second.status_code == 400
    assert not django_user_model.objects.filter(email="second@example.com").exists()


# ---------------------------------------------------------------------------
# The happy paths
# ---------------------------------------------------------------------------
def test_a_valid_admin_code_creates_an_admin_in_that_restaurant(
    client, restaurant, django_user_model
):
    invite = make_invite(restaurant)

    response = client.post(
        reverse(REGISTER),
        {
            "email": "owner@example.com",
            "password": PASSWORD,
            "role": Role.ADMIN,
            "invite_code": invite.code,
        },
    )
    assert response.status_code == 201, response.data

    user = django_user_model.objects.get(email="owner@example.com")
    assert user.role == Role.ADMIN
    assert user.restaurant_id == restaurant.id

    invite.refresh_from_db()
    assert invite.is_used and invite.used_by_id == user.id


def test_staff_can_register_with_no_code_but_get_no_restaurant(client, django_user_model):
    """Allowed, but inert: every queryset is restaurant-scoped and fails closed."""
    response = client.post(
        reverse(REGISTER),
        {"email": "newbie@example.com", "password": PASSWORD},
    )
    assert response.status_code == 201, response.data

    user = django_user_model.objects.get(email="newbie@example.com")
    assert user.role == Role.STAFF
    assert user.restaurant_id is None


def test_a_staff_code_attaches_the_account_to_the_restaurant(client, restaurant, django_user_model):
    invite = make_invite(restaurant, role=Role.STAFF)

    response = client.post(
        reverse(REGISTER),
        {
            "email": "waiter@example.com",
            "password": PASSWORD,
            "role": Role.STAFF,
            "invite_code": invite.code,
        },
    )
    assert response.status_code == 201, response.data

    user = django_user_model.objects.get(email="waiter@example.com")
    assert user.role == Role.STAFF
    assert user.restaurant_id == restaurant.id


def test_codes_are_matched_case_insensitively_and_trimmed(client, restaurant):
    """Someone reading a code off a screen will type it however they like."""
    invite = make_invite(restaurant, role=Role.STAFF)

    response = client.post(
        reverse(REGISTER),
        {
            "email": "casing@example.com",
            "password": PASSWORD,
            "role": Role.STAFF,
            "invite_code": f"  {invite.code.lower()}  ",
        },
    )
    assert response.status_code == 201, response.data


# ---------------------------------------------------------------------------
# The generated codes themselves
# ---------------------------------------------------------------------------
def test_generated_codes_avoid_ambiguous_characters(restaurant):
    """0/O and 1/I/L get misread when a code is passed on verbally."""
    codes = [make_invite(restaurant).code for _ in range(25)]
    assert all(len(c) == 8 for c in codes)
    assert not set("".join(codes)) & set("01OIL")
    assert len(set(codes)) == len(codes), "codes must be unique"


def test_a_new_code_is_usable_and_expires_in_the_future(restaurant):
    invite = make_invite(restaurant)
    assert invite.is_usable
    assert not invite.is_used
    assert invite.expires_at > timezone.now()
