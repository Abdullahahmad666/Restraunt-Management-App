"""Keeping the one endpoint that costs money from being able to run away.

Invoice scanning is reachable by every staff account and spends real money per
call. A loop, or a phone retrying an upload in the background, would otherwise
have nothing standing in its way.
"""

import io
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image

from apps.common.roles import Role
from apps.inventory.models import InvoiceScan, ScanUsage
from apps.inventory.services import usage
from apps.jobs.services import queue
from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db

INVOICES = "v1:staff:inventory:invoice-scan-list"

SCAN_RESULT = {
    "supplier_name": "Fresh Foods Ltd",
    "invoice_date": None,
    "line_items": [{"name": "Milk", "quantity": 1}],
}


def _png(size):
    buffer = io.BytesIO()
    Image.new("RGB", (size, size)).save(buffer, format="PNG")
    return SimpleUploadedFile(f"i-{size}.png", buffer.getvalue(), content_type="image/png")


@pytest.fixture(autouse=True)
def _media_root(tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path


@pytest.fixture
def throttle_rate(monkeypatch):
    """Set the invoice_scan throttle rate for one test.

    Not via the `settings` fixture: DRF reads DEFAULT_THROTTLE_RATES into a
    class attribute at import time, so changing the setting afterwards has no
    effect and the test passes for the wrong reason.
    """
    from rest_framework.throttling import SimpleRateThrottle

    def _set(rate: str):
        monkeypatch.setitem(SimpleRateThrottle.THROTTLE_RATES, "invoice_scan", rate)

    return _set


@pytest.fixture
def restaurant():
    return Restaurant.objects.create(name="The Test Kitchen", currency="GBP", is_approved=True)


@pytest.fixture
def other_restaurant():
    return Restaurant.objects.create(name="Down The Road", currency="GBP", is_approved=True)


@pytest.fixture
def staff_member(django_user_model, restaurant):
    return django_user_model.objects.create_user(
        email="alex@example.com", password="x", role=Role.STAFF, restaurant=restaurant
    )


def _upload(api_client, size=2):
    with patch("apps.inventory.services.scanning.extract_invoice_data", return_value=SCAN_RESULT):
        response = api_client.post(reverse(INVOICES), {"photo": _png(size)}, format="multipart")
        queue.run_next()
    return response


# ---------------------------------------------------------------------------
# Counting
# ---------------------------------------------------------------------------


def test_reading_an_invoice_is_counted(api_client, staff_member, restaurant):
    api_client.force_authenticate(user=staff_member)

    _upload(api_client, 2)
    _upload(api_client, 3)

    assert usage.scans_this_month(restaurant_id=restaurant.id) == 2


def test_a_duplicate_is_not_counted(api_client, staff_member, restaurant):
    """It never reaches the API, so counting it would make the ceiling stop
    people sooner than the spending justifies."""
    api_client.force_authenticate(user=staff_member)
    _upload(api_client, 2)
    _upload(api_client, 2)

    assert InvoiceScan.objects.filter(status=InvoiceScan.Status.DUPLICATE).count() == 1
    assert usage.scans_this_month(restaurant_id=restaurant.id) == 1


def test_a_rescan_is_counted(api_client, staff_member, restaurant):
    """It reads the same invoice again and adds no row - which is exactly why
    invoice rows are the wrong thing to count."""
    api_client.force_authenticate(user=staff_member)
    created = _upload(api_client, 2)

    with patch("apps.inventory.services.scanning.extract_invoice_data", return_value=SCAN_RESULT):
        api_client.post(
            reverse("v1:staff:inventory:invoice-scan-rescan", kwargs={"pk": created.data["id"]})
        )
        queue.run_next()

    assert usage.scans_this_month(restaurant_id=restaurant.id) == 2


def test_restaurants_are_counted_separately(restaurant, other_restaurant):
    usage.record_scan(restaurant_id=restaurant.id)
    usage.record_scan(restaurant_id=restaurant.id)
    usage.record_scan(restaurant_id=other_restaurant.id)

    assert usage.scans_this_month(restaurant_id=restaurant.id) == 2
    assert usage.scans_this_month(restaurant_id=other_restaurant.id) == 1
    assert ScanUsage.objects.count() == 2


# ---------------------------------------------------------------------------
# The ceiling
# ---------------------------------------------------------------------------


def test_no_ceiling_by_default(restaurant, settings):
    """A limit nobody chose would refuse real work on the day it was hit."""
    settings.INVOICE_SCAN_MONTHLY_CAP = 0
    for _ in range(50):
        usage.record_scan(restaurant_id=restaurant.id)

    assert usage.cap_reached(restaurant_id=restaurant.id) is False


def test_uploading_past_the_ceiling_is_refused_with_the_invoice_kept(
    api_client, staff_member, restaurant, settings
):
    settings.INVOICE_SCAN_MONTHLY_CAP = 1
    api_client.force_authenticate(user=staff_member)
    _upload(api_client, 2)

    with patch("apps.inventory.services.scanning.extract_invoice_data") as extract:
        response = api_client.post(reverse(INVOICES), {"photo": _png(3)}, format="multipart")
        extract.assert_not_called()

    assert response.status_code == 400
    assert "limit" in str(response.data).lower()


def test_the_worker_refuses_too_even_if_the_upload_slipped_through(
    api_client, staff_member, restaurant, settings
):
    """The upload check is a courtesy; this is the line that spends the money,
    so it is the one that has to hold."""
    api_client.force_authenticate(user=staff_member)
    created = _upload(api_client, 2)
    invoice = InvoiceScan.objects.get(pk=created.data["id"])

    settings.INVOICE_SCAN_MONTHLY_CAP = 1
    invoice.line_items.all().delete()

    from apps.inventory.services import scanning

    with patch("apps.inventory.services.scanning.extract_invoice_data") as extract:
        scanning.populate_invoice_from_scan(invoice)
        extract.assert_not_called()

    invoice.refresh_from_db()
    assert invoice.scan_state == InvoiceScan.ScanState.FAILED
    assert "limit" in invoice.scan_error.lower()
    # The upload survives, so the lines can still be keyed in by hand.
    assert InvoiceScan.objects.filter(pk=invoice.pk).exists()


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------


def test_uploading_is_rate_limited(api_client, staff_member, throttle_rate):
    throttle_rate("2/hour")
    api_client.force_authenticate(user=staff_member)

    with patch("apps.inventory.services.scanning.extract_invoice_data", return_value=SCAN_RESULT):
        first = api_client.post(reverse(INVOICES), {"photo": _png(2)}, format="multipart")
        second = api_client.post(reverse(INVOICES), {"photo": _png(3)}, format="multipart")
        third = api_client.post(reverse(INVOICES), {"photo": _png(4)}, format="multipart")

    assert first.status_code == 202
    assert second.status_code == 202
    assert third.status_code == 429


def test_reading_an_invoice_is_not_rate_limited(api_client, staff_member, throttle_rate):
    """A reviewer polls an invoice every couple of seconds while it scans -
    throttling that would throttle them out of watching it finish."""
    throttle_rate("1/hour")
    api_client.force_authenticate(user=staff_member)
    created = _upload(api_client, 2)
    detail = reverse("v1:staff:inventory:invoice-scan-detail", kwargs={"pk": created.data["id"]})

    for _ in range(10):
        assert api_client.get(detail).status_code == 200
