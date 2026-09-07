"""Creating a staff account emails a set-password link.

The property worth pinning: an admin never ends up holding the new person's
password. Generating one here would either strand the account - nobody could
tell them what it was - or make it a secret two people share, and in this app
an account signs off the attendance records that decide someone's pay.
"""

import pytest
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.urls import reverse
from rest_framework.test import APIClient

from apps.common.roles import Role
from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db

STAFF_ACCOUNTS = "v1:admin:users:staff-account-list"
CONFIRM = "v1:users:password-reset-confirm"


@pytest.fixture
def restaurant():
    return Restaurant.objects.create(name="The Test Kitchen", currency="GBP")


@pytest.fixture
def admin_client(django_user_model, restaurant):
    admin = django_user_model.objects.create_user(
        email="owner@example.com",
        password="admin-password-123",
        role=Role.ADMIN,
        restaurant=restaurant,
    )
    client = APIClient()
    client.force_authenticate(user=admin)
    return client


def create_staff(client, **overrides):
    payload = {"email": "newhire@example.com", "first_name": "Alex"}
    payload.update(overrides)
    return client.post(reverse(STAFF_ACCOUNTS), payload, format="json")


def test_creating_staff_sends_a_setup_email(admin_client, django_user_model):
    response = create_staff(admin_client)
    assert response.status_code == 201, response.data

    assert len(mail.outbox) == 1
    message = mail.outbox[0]
    assert "newhire@example.com" in message.to
    assert "invisiko://reset-password" in message.body
    assert "uid=" in message.body and "token=" in message.body


def test_the_new_account_has_no_usable_password(admin_client, django_user_model):
    create_staff(admin_client)

    user = django_user_model.objects.get(email="newhire@example.com")
    assert not user.has_usable_password(), (
        "a generated password would either strand the account or become a "
        "secret the admin also knows"
    )
    assert user.role == Role.STAFF


def test_the_emailed_link_lets_them_set_a_password(admin_client, django_user_model):
    create_staff(admin_client)
    user = django_user_model.objects.get(email="newhire@example.com")

    # Rebuild what the email carried, then redeem it like the app would.
    from django.utils.encoding import force_bytes
    from django.utils.http import urlsafe_base64_encode

    response = APIClient().post(
        reverse(CONFIRM),
        {
            "uid": urlsafe_base64_encode(force_bytes(user.pk)),
            "token": default_token_generator.make_token(user),
            "new_password": "their-own-password-77",
        },
    )
    assert response.status_code == 200, response.data

    user.refresh_from_db()
    assert user.check_password("their-own-password-77")
    assert user.has_usable_password()


def test_an_explicit_password_is_respected_and_sends_no_email(admin_client, django_user_model):
    """Supported for handing over credentials in person - clearly deliberate."""
    response = create_staff(admin_client, password="chosen-by-the-admin-42")
    assert response.status_code == 201, response.data

    user = django_user_model.objects.get(email="newhire@example.com")
    assert user.check_password("chosen-by-the-admin-42")
    assert mail.outbox == [], "no setup link is needed when a password was set"


def test_the_new_account_lands_in_the_admins_restaurant(
    admin_client, django_user_model, restaurant
):
    create_staff(admin_client)
    user = django_user_model.objects.get(email="newhire@example.com")
    assert user.restaurant_id == restaurant.id
