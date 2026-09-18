"""The venue's single check-in QR code - creating it, and regenerating the
token, which also refreshes the geofence position/radius at the same time
(see AdminVenueQRCodeViewSet.regenerate)."""

from decimal import Decimal

import pytest
from django.urls import reverse

from apps.attendance.models import VenueQRCode
from apps.common.roles import Role
from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db

QR_CODES = "v1:admin:attendance:qr-code-list"


def regenerate_url(pk):
    return reverse("v1:admin:attendance:qr-code-regenerate", kwargs={"pk": pk})


@pytest.fixture
def restaurant():
    return Restaurant.objects.create(name="The Test Kitchen", currency="GBP", is_approved=True)


@pytest.fixture
def admin(django_user_model, restaurant):
    return django_user_model.objects.create_user(
        email="owner@example.com", password="x", role=Role.ADMIN, restaurant=restaurant
    )


@pytest.fixture
def qr_code(restaurant):
    return VenueQRCode.objects.create(
        restaurant=restaurant,
        latitude=Decimal("51.509865"),
        longitude=Decimal("-0.118092"),
        radius_meters=100,
    )


def test_admin_can_create_a_qr_code(api_client, admin, restaurant):
    api_client.force_authenticate(user=admin)

    response = api_client.post(
        reverse(QR_CODES),
        {
            "restaurant": str(restaurant.id),
            "latitude": "51.509865",
            "longitude": "-0.118092",
            "radius_meters": 150,
        },
    )

    assert response.status_code == 201, response.data
    assert response.data["radius_meters"] == 150


def test_regenerating_rotates_the_token(api_client, admin, qr_code):
    api_client.force_authenticate(user=admin)
    old_token = qr_code.token

    response = api_client.post(
        regenerate_url(qr_code.id),
        {"latitude": "51.509865", "longitude": "-0.118092", "radius_meters": 100},
    )

    assert response.status_code == 200, response.data
    assert response.data["token"] != str(old_token)


def test_regenerating_updates_the_venue_position_and_radius(api_client, admin, qr_code):
    """The old position/radius must not silently carry over - the whole
    point of asking again is that the venue may have moved."""
    api_client.force_authenticate(user=admin)

    response = api_client.post(
        regenerate_url(qr_code.id),
        {"latitude": "51.500000", "longitude": "-0.200000", "radius_meters": 250},
    )

    assert response.status_code == 200, response.data
    assert response.data["latitude"] == "51.500000"
    assert response.data["longitude"] == "-0.200000"
    assert response.data["radius_meters"] == 250

    qr_code.refresh_from_db()
    assert qr_code.radius_meters == 250


def test_regenerating_without_a_location_is_rejected(api_client, admin, qr_code):
    api_client.force_authenticate(user=admin)

    response = api_client.post(regenerate_url(qr_code.id), {})

    assert response.status_code == 400
