import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db

User = get_user_model()


@pytest.fixture
def client():
    return APIClient()


def test_register_then_login(client):
    register_url = reverse("v1:users:register")
    response = client.post(
        register_url,
        {"email": "waiter@example.com", "password": "an-ok-password-42"},
    )
    assert response.status_code == 201, response.data

    login_url = reverse("v1:users:login")

    # Login is blocked until the user verifies their email.
    response = client.post(
        login_url,
        {"email": "waiter@example.com", "password": "an-ok-password-42"},
    )
    assert response.status_code == 400

    user = User.objects.get(email="waiter@example.com")
    verify_url = reverse("v1:users:verify-email")
    response = client.post(
        verify_url,
        {"email": "waiter@example.com", "otp": user.email_otp},
    )
    assert response.status_code == 200, response.data

    response = client.post(
        login_url,
        {"email": "waiter@example.com", "password": "an-ok-password-42"},
    )
    assert response.status_code == 200
    assert "access" in response.data and "refresh" in response.data


def test_me_requires_authentication(client):
    assert client.get(reverse("v1:users:me")).status_code == 401
