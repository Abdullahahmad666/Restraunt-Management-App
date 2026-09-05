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
    """An established restaurant - already approved, already issuing invite
    codes - not the freshly self-registered, pending-review kind these tests
    are otherwise not about."""
    return Restaurant.objects.create(name="The Test Kitchen", currency="GBP", is_approved=True)


@pytest.fixture
def client():
    return APIClient()


def make_invite(restaurant, role=Role.ADMIN, **kwargs):
    return InviteCode.objects.create(restaurant=restaurant, role=role, **kwargs)


# ---------------------------------------------------------------------------
# The escalation gate
# ---------------------------------------------------------------------------
def test_cannot_register_as_admin_with_neither_a_code_nor_a_restaurant_name(
    client, django_user_model
):
    """Rejected, not silently downgraded to STAFF - an admin needs proof of
    either joining an existing restaurant or starting a new one."""
    response = client.post(
        reverse(REGISTER),
        {"email": "sneaky@example.com", "password": PASSWORD, "role": Role.ADMIN},
    )
    assert response.status_code == 400
    assert "restaurant_name" in response.data
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


# ---------------------------------------------------------------------------
# Starting a brand new restaurant (no code - there is nobody yet to invite you)
# ---------------------------------------------------------------------------
def test_an_admin_can_self_register_a_new_restaurant(client, django_user_model):
    response = client.post(
        reverse(REGISTER),
        {
            "email": "founder@example.com",
            "password": PASSWORD,
            "first_name": "Priya",
            "last_name": "Shah",
            "phone": "07700900123",
            "role": Role.ADMIN,
            "restaurant_name": "Golden Spice",
        },
    )
    assert response.status_code == 201, response.data

    user = django_user_model.objects.get(email="founder@example.com")
    assert user.role == Role.ADMIN
    assert user.phone == "07700900123"
    assert user.restaurant is not None
    assert user.restaurant.name == "Golden Spice"


def test_a_self_registered_restaurant_starts_unapproved(client, django_user_model):
    """A public endpoint that can create a tenant needs a human gate before
    that tenant is actually usable - see RestaurantAdmin's approval action."""
    response = client.post(
        reverse(REGISTER),
        {
            "email": "founder2@example.com",
            "password": PASSWORD,
            "role": Role.ADMIN,
            "restaurant_name": "Golden Spice",
        },
    )
    assert response.status_code == 201, response.data

    user = django_user_model.objects.get(email="founder2@example.com")
    assert user.restaurant.is_approved is False
    assert user.restaurant.approved_at is None
    assert user.restaurant.approved_by is None


def test_me_reports_pending_approval_for_a_new_self_registered_restaurant(
    client, django_user_model
):
    """Drives whether the app shows the real dashboard or a "pending" screen -
    see UserSerializer.restaurant_is_approved."""
    django_user_model.objects.create_user(
        email="founder3@example.com",
        password=PASSWORD,
        role=Role.ADMIN,
        restaurant=Restaurant.objects.create(name="Pending Place"),
        is_email_verified=True,
    )
    client.force_authenticate(user=django_user_model.objects.get(email="founder3@example.com"))

    response = client.get(reverse("v1:users:me"))

    assert response.status_code == 200
    assert response.data["restaurant_is_approved"] is False


def test_me_reports_none_for_a_user_with_no_restaurant(client, django_user_model):
    user = django_user_model.objects.create_user(
        email="loose@example.com", password=PASSWORD, is_email_verified=True
    )
    client.force_authenticate(user=user)

    response = client.get(reverse("v1:users:me"))

    assert response.status_code == 200
    assert response.data["restaurant_is_approved"] is None


def test_joining_an_existing_restaurant_by_code_is_unaffected_by_approval(
    client, restaurant, django_user_model
):
    """restaurant fixture is approved by default (created directly, not
    through self-registration) - joining it by invite must not touch that."""
    invite = make_invite(restaurant, role=Role.STAFF)

    response = client.post(
        reverse(REGISTER),
        {
            "email": "joiner@example.com",
            "password": PASSWORD,
            "role": Role.STAFF,
            "invite_code": invite.code,
        },
    )
    assert response.status_code == 201, response.data
    restaurant.refresh_from_db()
    assert restaurant.is_approved is True


def test_two_founders_get_two_separate_restaurants(client, django_user_model):
    """The same takeaway name typed twice must not be treated as one - there is
    no ownership check yet linking a name to whoever registered it first."""
    for email in ("first@example.com", "second@example.com"):
        response = client.post(
            reverse(REGISTER),
            {
                "email": email,
                "password": PASSWORD,
                "role": Role.ADMIN,
                "restaurant_name": "Golden Spice",
            },
        )
        assert response.status_code == 201, response.data

    first = django_user_model.objects.get(email="first@example.com")
    second = django_user_model.objects.get(email="second@example.com")
    assert first.restaurant_id != second.restaurant_id


def test_an_invite_code_takes_precedence_over_a_restaurant_name(
    client, restaurant, django_user_model
):
    """Sending both is not a real scenario the app builds, but if it happens
    the code - proof of an actual invitation - must win over a name anyone
    could type."""
    invite = make_invite(restaurant)

    response = client.post(
        reverse(REGISTER),
        {
            "email": "either@example.com",
            "password": PASSWORD,
            "role": Role.ADMIN,
            "invite_code": invite.code,
            "restaurant_name": "A Different Place",
        },
    )
    assert response.status_code == 201, response.data

    user = django_user_model.objects.get(email="either@example.com")
    assert user.restaurant_id == restaurant.id


def test_staff_cannot_start_a_new_restaurant_with_a_name_alone(client, django_user_model):
    """restaurant_name is an admin-only path - staff joins via a code or not
    at all, never by typing a takeaway name into existence."""
    response = client.post(
        reverse(REGISTER),
        {
            "email": "confused@example.com",
            "password": PASSWORD,
            "role": Role.STAFF,
            "restaurant_name": "Golden Spice",
        },
    )
    assert response.status_code == 201, response.data

    user = django_user_model.objects.get(email="confused@example.com")
    assert user.restaurant_id is None


# ---------------------------------------------------------------------------
# The public invite lookup - what a join link may reveal before sign-up
# ---------------------------------------------------------------------------
INVITE_LOOKUP = "v1:users:invite-code-lookup"


def test_invite_lookup_returns_restaurant_and_inviter(client, restaurant, django_user_model):
    admin = django_user_model.objects.create_user(
        email="manager@example.com",
        password=PASSWORD,
        first_name="Priya",
        last_name="Shah",
    )
    invite = make_invite(restaurant, role=Role.STAFF, created_by=admin)

    response = client.get(reverse(INVITE_LOOKUP, kwargs={"code": invite.code}))

    assert response.status_code == 200
    assert response.data == {
        "restaurant_name": restaurant.name,
        "invited_by_name": "Priya Shah",
        "role": Role.STAFF,
        "is_usable": True,
    }


def test_invite_lookup_is_case_insensitive(client, restaurant):
    invite = make_invite(restaurant, role=Role.STAFF)
    response = client.get(reverse(INVITE_LOOKUP, kwargs={"code": invite.code.lower()}))
    assert response.status_code == 200


def test_invite_lookup_404s_for_an_unknown_code(client):
    response = client.get(reverse(INVITE_LOOKUP, kwargs={"code": "NOTREAL1"}))
    assert response.status_code == 404


def test_invite_lookup_still_resolves_a_used_code_but_marks_it_unusable(
    client, restaurant, django_user_model
):
    """The join screen should say "this invite has already been used", not a
    bare 404 - it still needs the restaurant/inviter names to say that well."""
    invite = make_invite(restaurant, role=Role.STAFF)
    invite.consume(
        django_user_model.objects.create_user(email="used@example.com", password=PASSWORD)
    )

    response = client.get(reverse(INVITE_LOOKUP, kwargs={"code": invite.code}))

    assert response.status_code == 200
    assert response.data["is_usable"] is False


def test_invite_lookup_falls_back_when_the_inviter_has_no_name_on_file(client, restaurant):
    invite = make_invite(restaurant, role=Role.STAFF, created_by=None)
    response = client.get(reverse(INVITE_LOOKUP, kwargs={"code": invite.code}))
    assert response.status_code == 200
    assert response.data["invited_by_name"] == "your manager"


# ---------------------------------------------------------------------------
# invite_link on the admin-facing serializer
# ---------------------------------------------------------------------------
def test_invite_serializer_builds_a_shareable_link(restaurant, settings):
    from apps.users.api.serializers import InviteCodeSerializer

    settings.INVITE_URL = "invisiko://join"
    invite = make_invite(restaurant, role=Role.STAFF)

    data = InviteCodeSerializer(invite).data

    assert data["invite_link"] == f"invisiko://join?code={invite.code}"


# ---------------------------------------------------------------------------
# An admin issuing an invite code through the real endpoint - as opposed to
# the tests above, which build InviteCode rows directly and so never
# exercised deserializing a POST body. expires_at is filled in by
# InviteCode.save(), not the client, and previously wasn't marked read_only
# on the serializer - meaning DRF demanded it from the client and every real
# invite request from the app failed with 400 despite every other test here
# passing.
# ---------------------------------------------------------------------------
def test_an_admin_can_issue_a_staff_invite_through_the_api(client, restaurant, django_user_model):
    admin = django_user_model.objects.create_user(
        email="owner@example.com",
        password=PASSWORD,
        role=Role.ADMIN,
        restaurant=restaurant,
    )
    client.force_authenticate(user=admin)

    response = client.post(reverse("v1:admin:users:invite-code-list"), {"role": Role.STAFF})

    assert response.status_code == 201, response.data
    assert response.data["invite_link"].endswith(response.data["code"])
    assert response.data["expires_at"] is not None
