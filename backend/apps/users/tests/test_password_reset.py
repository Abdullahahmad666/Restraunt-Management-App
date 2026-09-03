"""Forgotten-password reset.

Two properties matter more than the happy path and are easy to lose in a
refactor, so they are pinned here:

  - the request endpoint must answer identically for a registered and an
    unregistered address, or it becomes a way to enumerate who works here
  - a token must not survive being used, nor work for a different account
"""

import pytest
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db

REQUEST = "v1:users:password-reset"
CONFIRM = "v1:users:password-reset-confirm"
NEW_PASSWORD = "a-brand-new-password-99"


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def account(django_user_model):
    return django_user_model.objects.create_user(
        email="forgetful@example.com", password="the-old-password-11"
    )


def reset_payload(user, **overrides):
    data = {
        "uid": urlsafe_base64_encode(force_bytes(user.pk)),
        "token": default_token_generator.make_token(user),
        "new_password": NEW_PASSWORD,
    }
    data.update(overrides)
    return data


# ---------------------------------------------------------------------------
# Requesting a link
# ---------------------------------------------------------------------------
def test_request_does_not_reveal_whether_the_account_exists(client, account):
    known = client.post(reverse(REQUEST), {"email": account.email})
    unknown = client.post(reverse(REQUEST), {"email": "nobody@example.com"})

    assert known.status_code == unknown.status_code == 200
    assert known.data == unknown.data, "responses must be indistinguishable"


def test_an_email_is_sent_only_for_a_real_account(client, account):
    client.post(reverse(REQUEST), {"email": account.email})
    assert len(mail.outbox) == 1
    assert account.email in mail.outbox[0].to

    mail.outbox.clear()
    client.post(reverse(REQUEST), {"email": "nobody@example.com"})
    assert mail.outbox == []


def test_the_email_carries_a_deep_link_with_uid_and_token(client, account):
    client.post(reverse(REQUEST), {"email": account.email})
    body = mail.outbox[0].body
    assert "invisiko://reset-password" in body
    assert "uid=" in body and "token=" in body


def test_an_inactive_account_gets_no_email(client, account):
    account.is_active = False
    account.save(update_fields=("is_active",))

    response = client.post(reverse(REQUEST), {"email": account.email})
    assert response.status_code == 200
    assert mail.outbox == []


def test_a_malformed_address_is_rejected(client):
    assert client.post(reverse(REQUEST), {"email": "not-an-email"}).status_code == 400


# ---------------------------------------------------------------------------
# Redeeming the token
# ---------------------------------------------------------------------------
def test_a_valid_token_sets_the_new_password(client, account):
    response = client.post(reverse(CONFIRM), reset_payload(account))
    assert response.status_code == 200, response.data

    account.refresh_from_db()
    assert account.check_password(NEW_PASSWORD)


def test_a_token_cannot_be_used_twice(client, account):
    payload = reset_payload(account)
    assert client.post(reverse(CONFIRM), payload).status_code == 200

    # The token hashes the current password, so changing it invalidates the token.
    second = client.post(reverse(CONFIRM), payload)
    assert second.status_code == 400
    assert "token" in second.data


def test_a_tampered_token_is_rejected(client, account):
    response = client.post(reverse(CONFIRM), reset_payload(account, token="not-a-real-token"))
    assert response.status_code == 400

    account.refresh_from_db()
    assert not account.check_password(NEW_PASSWORD)


def test_one_users_token_does_not_work_for_another(client, account, django_user_model):
    someone_else = django_user_model.objects.create_user(
        email="other@example.com", password="their-own-password-22"
    )
    payload = reset_payload(account)
    payload["uid"] = urlsafe_base64_encode(force_bytes(someone_else.pk))

    assert client.post(reverse(CONFIRM), payload).status_code == 400

    someone_else.refresh_from_db()
    assert not someone_else.check_password(NEW_PASSWORD)


def test_a_garbage_uid_is_rejected_rather_than_raising(client, account):
    response = client.post(reverse(CONFIRM), reset_payload(account, uid="!!!not-base64!!!"))
    assert response.status_code == 400


def test_the_new_password_must_pass_validation(client, account):
    response = client.post(reverse(CONFIRM), reset_payload(account, new_password="123"))
    assert response.status_code == 400
    assert "new_password" in response.data

    account.refresh_from_db()
    assert account.check_password("the-old-password-11"), "the old password must still work"
