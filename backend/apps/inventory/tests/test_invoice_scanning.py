"""Uploading a photographed invoice, reviewing what the (mocked) vision
model read off it, and confirming it into stock. The real AI call
(apps.inventory.services.scanning.extract_invoice_data) is mocked
throughout - these tests are about the review/confirm workflow around it,
not about whether Anthropic's API itself works.

Scanning happens on the background worker, so uploading no longer returns
line items. The helper below uploads, runs the queued job the way the worker
would, and hands back the invoice as it looks afterwards.
"""

import io
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image

from apps.common.roles import Role
from apps.inventory.models import InventoryItem, InvoiceScan
from apps.inventory.services.scanning import PermanentScanError, TransientScanError
from apps.inventory.tests.factories import line, party, scan_result
from apps.jobs.models import Job
from apps.jobs.services import queue
from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db

STAFF_INVOICES = "v1:staff:inventory:invoice-scan-list"
STAFF_INVOICE_DETAIL = "v1:staff:inventory:invoice-scan-detail"


def invoice_photo():
    """A genuinely valid 1x1 PNG - ImageField runs it through Pillow to
    validate, so a hand-written byte string is too fragile to rely on."""
    buffer = io.BytesIO()
    Image.new("RGB", (1, 1)).save(buffer, format="PNG")
    return SimpleUploadedFile("invoice.png", buffer.getvalue(), content_type="image/png")


@pytest.fixture
def restaurant():
    return Restaurant.objects.create(name="The Test Kitchen", currency="GBP", is_approved=True)


@pytest.fixture
def other_restaurant():
    return Restaurant.objects.create(name="Down The Road", currency="GBP", is_approved=True)


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
def chicken(restaurant):
    return InventoryItem.objects.create(
        restaurant=restaurant, name="Chicken Breast", unit="kg", quantity_on_hand=Decimal("5")
    )


SCAN_RESULT = scan_result(
    invoice_date="2026-09-15",
    items=[
        line("Chicken Breast", quantity=10, unit_price=4.5, line_total=45, size="kg"),
        line("Basmati Rice", quantity=5, unit_price=2, line_total=10, size="kg"),
    ],
)


@pytest.fixture(autouse=True)
def _media_root(tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path


def _upload(api_client, mock_extract):
    """Upload an invoice, run the scan the worker would have run, and return
    the invoice as the client would next see it."""
    with patch(
        "apps.inventory.services.scanning.extract_invoice_data",
        return_value=mock_extract,
    ):
        created = api_client.post(
            reverse(STAFF_INVOICES), {"photo": invoice_photo()}, format="multipart"
        )
        assert created.status_code == 202, created.data
        assert queue.run_next() is True, "upload did not queue a scan"

    return api_client.get(reverse(STAFF_INVOICE_DETAIL, kwargs={"pk": created.data["id"]}))


# ---------------------------------------------------------------------------
# Uploading and scanning
# ---------------------------------------------------------------------------


def test_uploading_returns_immediately_and_queues_the_scan(api_client, staff_member):
    """The upload must not wait on the vision model - that is the whole point
    of the worker. The response carries no line items yet."""
    api_client.force_authenticate(user=staff_member)

    with patch("apps.inventory.services.scanning.extract_invoice_data") as extract:
        response = api_client.post(
            reverse(STAFF_INVOICES), {"photo": invoice_photo()}, format="multipart"
        )
        extract.assert_not_called()

    assert response.status_code == 202, response.data
    assert response.data["scan_state"] == "QUEUED"
    assert response.data["line_items"] == []

    job = Job.objects.get()
    assert job.kind == "inventory.scan_invoice"
    assert job.payload == {"invoice_id": response.data["id"]}


def test_the_worker_fills_in_the_line_items(api_client, staff_member):
    api_client.force_authenticate(user=staff_member)

    response = _upload(api_client, SCAN_RESULT)

    assert response.status_code == 200, response.data
    assert response.data["status"] == "PENDING"
    assert response.data["scan_state"] == "DONE"
    assert response.data["supplier_name"] == "Fresh Foods Ltd"
    assert response.data["invoice_date"] == "2026-09-15"
    assert len(response.data["line_items"]) == 2
    assert response.data["line_items"][0]["raw_name"] == "Chicken Breast"
    assert response.data["line_items"][0]["matched_item"] is None


def test_an_unreadable_photo_is_recorded_and_not_retried(api_client, staff_member):
    """Nothing about sending the same bad photo again would help, so the job
    finishes rather than burning its retries."""
    api_client.force_authenticate(user=staff_member)

    with patch(
        "apps.inventory.services.scanning.extract_invoice_data",
        side_effect=PermanentScanError("Could not read that invoice - try a clearer photo."),
    ):
        created = api_client.post(
            reverse(STAFF_INVOICES), {"photo": invoice_photo()}, format="multipart"
        )
        queue.run_next()

    response = api_client.get(reverse(STAFF_INVOICE_DETAIL, kwargs={"pk": created.data["id"]}))

    assert response.data["status"] == "PENDING"
    assert response.data["scan_state"] == "FAILED"
    assert response.data["line_items"] == []
    assert "clearer photo" in response.data["scan_error"]
    # The upload is deliberately kept so staff can retake it or key it in.
    assert InvoiceScan.objects.count() == 1
    assert Job.objects.get().status == Job.Status.SUCCEEDED


def test_a_busy_service_is_retried_rather_than_recorded_as_a_failure(api_client, staff_member):
    api_client.force_authenticate(user=staff_member)

    with patch(
        "apps.inventory.services.scanning.extract_invoice_data",
        side_effect=TransientScanError("The invoice scanning service is busy."),
    ):
        api_client.post(reverse(STAFF_INVOICES), {"photo": invoice_photo()}, format="multipart")
        queue.run_next()

    job = Job.objects.get()
    assert job.status == Job.Status.QUEUED, "a busy service should be retried"
    assert job.attempts == 1

    invoice = InvoiceScan.objects.get()
    assert invoice.scan_state == InvoiceScan.ScanState.SCANNING
    assert invoice.scan_error == "", "a retryable blip should not be shown to staff as a failure"


def test_rescan_replaces_the_line_items(api_client, staff_member):
    api_client.force_authenticate(user=staff_member)
    created = _upload(api_client, SCAN_RESULT).data
    assert len(created["line_items"]) == 2

    new_result = scan_result(supplier_name=None, items=[line("Milk")])
    with patch("apps.inventory.services.scanning.extract_invoice_data", return_value=new_result):
        queued = api_client.post(
            reverse("v1:staff:inventory:invoice-scan-rescan", kwargs={"pk": created["id"]})
        )
        assert queued.status_code == 202, queued.data
        assert queue.run_next() is True

    response = api_client.get(reverse(STAFF_INVOICE_DETAIL, kwargs={"pk": created["id"]}))

    assert len(response.data["line_items"]) == 1
    assert response.data["line_items"][0]["raw_name"] == "Milk"


def test_scanning_twice_does_not_duplicate_line_items(api_client, staff_member):
    """A job retried after a half-finished attempt must not leave every line
    on the invoice twice."""
    api_client.force_authenticate(user=staff_member)
    created = _upload(api_client, SCAN_RESULT).data
    invoice = InvoiceScan.objects.get(pk=created["id"])

    with patch("apps.inventory.services.scanning.extract_invoice_data", return_value=SCAN_RESULT):
        from apps.inventory.services import scanning

        scanning.populate_invoice_from_scan(invoice)

    assert invoice.line_items.count() == 2


# ---------------------------------------------------------------------------
# Reviewing and matching line items
# ---------------------------------------------------------------------------


def test_staff_can_match_a_line_item_to_an_inventory_item(api_client, staff_member, chicken):
    api_client.force_authenticate(user=staff_member)
    created = _upload(api_client, SCAN_RESULT).data
    line_id = created["line_items"][0]["id"]

    response = api_client.patch(
        reverse("v1:staff:inventory:invoice-line-item-detail", kwargs={"pk": line_id}),
        {"matched_item": str(chicken.id)},
    )

    assert response.status_code == 200, response.data
    assert response.data["matched_item_name"] == "Chicken Breast"


def test_cannot_match_a_line_item_to_another_restaurants_inventory_item(
    api_client, staff_member, other_restaurant
):
    outside_item = InventoryItem.objects.create(
        restaurant=other_restaurant, name="Not yours", unit="kg"
    )
    api_client.force_authenticate(user=staff_member)
    created = _upload(api_client, SCAN_RESULT).data
    line_id = created["line_items"][0]["id"]

    response = api_client.patch(
        reverse("v1:staff:inventory:invoice-line-item-detail", kwargs={"pk": line_id}),
        {"matched_item": str(outside_item.id)},
    )

    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Confirming
# ---------------------------------------------------------------------------


def test_confirming_requires_every_line_matched(api_client, staff_member, chicken):
    api_client.force_authenticate(user=staff_member)
    created = _upload(api_client, SCAN_RESULT).data
    line_id = created["line_items"][0]["id"]
    api_client.patch(
        reverse("v1:staff:inventory:invoice-line-item-detail", kwargs={"pk": line_id}),
        {"matched_item": str(chicken.id)},
    )
    # The second line item is left unmatched.

    response = api_client.post(
        reverse("v1:staff:inventory:invoice-scan-confirm", kwargs={"pk": created["id"]})
    )

    assert response.status_code == 400


def test_confirming_applies_stock_and_cost_from_matched_lines(api_client, staff_member, chicken):
    api_client.force_authenticate(user=staff_member)
    created = _upload(
        api_client,
        scan_result(items=[line("Chicken Breast", quantity=10, unit_price=4.5, size="kg")]),
    ).data
    line_id = created["line_items"][0]["id"]
    api_client.patch(
        reverse("v1:staff:inventory:invoice-line-item-detail", kwargs={"pk": line_id}),
        {"matched_item": str(chicken.id)},
    )

    response = api_client.post(
        reverse("v1:staff:inventory:invoice-scan-confirm", kwargs={"pk": created["id"]})
    )

    assert response.status_code == 200, response.data
    assert response.data["status"] == "CONFIRMED"

    chicken.refresh_from_db()
    assert chicken.quantity_on_hand == Decimal("15.00")  # 5 on hand + 10 delivered
    assert chicken.cost_per_unit == Decimal("4.50")


def test_confirming_twice_is_rejected(api_client, staff_member, chicken):
    api_client.force_authenticate(user=staff_member)
    created = _upload(
        api_client,
        scan_result(supplier_name=None, items=[line("x")]),
    ).data
    line_id = created["line_items"][0]["id"]
    api_client.patch(
        reverse("v1:staff:inventory:invoice-line-item-detail", kwargs={"pk": line_id}),
        {"matched_item": str(chicken.id)},
    )
    confirm_url = reverse("v1:staff:inventory:invoice-scan-confirm", kwargs={"pk": created["id"]})
    api_client.post(confirm_url)

    response = api_client.post(confirm_url)

    assert response.status_code == 400


def test_line_items_cannot_be_edited_after_confirmation(api_client, staff_member, chicken):
    api_client.force_authenticate(user=staff_member)
    created = _upload(
        api_client,
        scan_result(supplier_name=None, items=[line("x")]),
    ).data
    line_id = created["line_items"][0]["id"]
    api_client.patch(
        reverse("v1:staff:inventory:invoice-line-item-detail", kwargs={"pk": line_id}),
        {"matched_item": str(chicken.id)},
    )
    api_client.post(
        reverse("v1:staff:inventory:invoice-scan-confirm", kwargs={"pk": created["id"]})
    )

    response = api_client.patch(
        reverse("v1:staff:inventory:invoice-line-item-detail", kwargs={"pk": line_id}),
        {"quantity": "99.00"},
    )

    assert response.status_code == 400


def test_discarding_an_invoice(api_client, staff_member):
    api_client.force_authenticate(user=staff_member)
    created = _upload(api_client, SCAN_RESULT).data

    response = api_client.post(
        reverse("v1:staff:inventory:invoice-scan-discard", kwargs={"pk": created["id"]})
    )

    assert response.status_code == 200, response.data
    assert response.data["status"] == "DISCARDED"
    assert InvoiceScan.objects.get(id=created["id"]).status == InvoiceScan.Status.DISCARDED


def test_an_invoice_stops_saying_scanning_once_the_queue_gives_up(api_client, staff_member):
    """A scan that exhausts its retries must not leave the invoice reading
    "scanning" forever - the app polls that state and would never stop."""
    api_client.force_authenticate(user=staff_member)

    with patch(
        "apps.inventory.services.scanning.extract_invoice_data",
        side_effect=TransientScanError("busy"),
    ):
        created = api_client.post(
            reverse(STAFF_INVOICES), {"photo": invoice_photo()}, format="multipart"
        )
        Job.objects.update(max_attempts=1)
        queue.run_next()

    assert Job.objects.get().status == Job.Status.FAILED

    response = api_client.get(reverse(STAFF_INVOICE_DETAIL, kwargs={"pk": created.data["id"]}))
    assert response.data["scan_state"] == "FAILED"
    assert response.data["scan_error"] != ""


def test_the_invoices_own_figures_are_recorded(api_client, staff_member):
    """The invoice number identifies a re-upload; the stated totals are the
    only independent thing the lines can be checked against."""
    api_client.force_authenticate(user=staff_member)

    result = {
        **SCAN_RESULT,
        "invoice_number": "INV-2026-0042",
        "shipping_address": "Cellar",
        "subtotal": 55,
        "tax_total": 11,
        "total": 66,
    }
    with patch("apps.inventory.services.scanning.extract_invoice_data", return_value=result):
        created = api_client.post(
            reverse(STAFF_INVOICES), {"photo": invoice_photo()}, format="multipart"
        )
        queue.run_next()

    invoice = InvoiceScan.objects.get(pk=created.data["id"])
    assert invoice.invoice_number == "INV-2026-0042"
    assert invoice.delivery_location == "Cellar"
    assert invoice.stated_total == Decimal("66")
    assert invoice.stated_tax == Decimal("11")


def test_an_invoice_that_states_none_of_that_still_scans(api_client, staff_member):
    """Plenty of delivery notes carry no reference and no totals at all."""
    api_client.force_authenticate(user=staff_member)

    with patch("apps.inventory.services.scanning.extract_invoice_data", return_value=SCAN_RESULT):
        created = api_client.post(
            reverse(STAFF_INVOICES), {"photo": invoice_photo()}, format="multipart"
        )
        queue.run_next()

    invoice = InvoiceScan.objects.get(pk=created.data["id"])
    assert invoice.scan_state == InvoiceScan.ScanState.DONE
    assert invoice.invoice_number == ""
    assert invoice.stated_total is None


# ---------------------------------------------------------------------------
# The same invoice twice
# ---------------------------------------------------------------------------


def distinct_photo(size):
    """A photo with different bytes from the last one.

    invoice_photo() renders the same 1x1 PNG every time, which the file-hash
    check correctly treats as the same file - so a test about two *different*
    photos of one invoice has to actually produce two.
    """
    buffer = io.BytesIO()
    Image.new("RGB", (size, size)).save(buffer, format="PNG")
    return SimpleUploadedFile(f"invoice-{size}.png", buffer.getvalue(), content_type="image/png")


def _upload_bytes(api_client, photo, result=None):
    with patch(
        "apps.inventory.services.scanning.extract_invoice_data",
        return_value=result if result is not None else SCAN_RESULT,
    ):
        response = api_client.post(reverse(STAFF_INVOICES), {"photo": photo}, format="multipart")
        queue.run_next()
    return InvoiceScan.objects.get(pk=response.data["id"])


def test_the_same_file_twice_is_caught_without_paying_to_read_it(api_client, staff_member):
    """Identical bytes are not a second delivery, they are the same photo sent
    twice - and recognising that should not cost what reading it costs."""
    api_client.force_authenticate(user=staff_member)
    photo_bytes = invoice_photo().read()

    first = _upload_bytes(
        api_client, SimpleUploadedFile("a.png", photo_bytes, content_type="image/png")
    )

    with patch("apps.inventory.services.scanning.extract_invoice_data") as extract:
        api_client.post(
            reverse(STAFF_INVOICES),
            {"photo": SimpleUploadedFile("b.png", photo_bytes, content_type="image/png")},
            format="multipart",
        )
        queue.run_next()
        extract.assert_not_called()

    second = InvoiceScan.objects.exclude(pk=first.pk).get()
    assert second.status == InvoiceScan.Status.DUPLICATE
    assert second.duplicate_of == first
    assert second.line_items.count() == 0


def test_a_duplicate_cannot_be_confirmed_into_stock(api_client, staff_member, chicken):
    api_client.force_authenticate(user=staff_member)
    photo_bytes = invoice_photo().read()
    _upload_bytes(api_client, SimpleUploadedFile("a.png", photo_bytes, content_type="image/png"))
    _upload_bytes(api_client, SimpleUploadedFile("b.png", photo_bytes, content_type="image/png"))

    duplicate = InvoiceScan.objects.get(status=InvoiceScan.Status.DUPLICATE)
    response = api_client.post(
        reverse("v1:staff:inventory:invoice-scan-confirm", kwargs={"pk": duplicate.id})
    )

    assert response.status_code == 400
    assert "twice" in str(response.data)


def test_a_different_photo_of_the_same_invoice_is_flagged_not_blocked(api_client, staff_member):
    """Weaker evidence: a supplier can reuse a reference and a scan can misread
    one, so the reviewer decides. Throwing away a real delivery is worse."""
    from apps.inventory.models import Supplier

    api_client.force_authenticate(user=staff_member)
    Supplier.objects.create(restaurant=staff_member.restaurant, name="Fresh Foods Ltd")
    result = {**SCAN_RESULT, "invoice_number": "INV-77"}

    first = _upload_bytes(api_client, distinct_photo(2), result)
    second = _upload_bytes(api_client, distinct_photo(3), result)

    assert second.status == InvoiceScan.Status.PENDING, "still reviewable"
    assert second.duplicate_of == first
    assert second.line_items.count() == 2, "it was read, so the reviewer can compare"


def test_two_suppliers_numbering_from_one_are_not_each_others_duplicates(api_client, staff_member):
    from apps.inventory.models import Supplier

    api_client.force_authenticate(user=staff_member)
    Supplier.objects.create(restaurant=staff_member.restaurant, name="Fresh Foods Ltd")
    Supplier.objects.create(restaurant=staff_member.restaurant, name="Dairy Direct")

    first = _upload_bytes(api_client, distinct_photo(4), {**SCAN_RESULT, "invoice_number": "1"})
    second = _upload_bytes(
        api_client,
        distinct_photo(5),
        {**SCAN_RESULT, "supplier": party("Dairy Direct"), "invoice_number": "1"},
    )

    assert first.duplicate_of is None
    assert second.duplicate_of is None


def test_a_discarded_invoice_is_not_worth_duplicating(api_client, staff_member):
    """The original will never be confirmed, so this copy repeats nothing that
    counts."""
    api_client.force_authenticate(user=staff_member)
    photo_bytes = invoice_photo().read()

    first = _upload_bytes(
        api_client, SimpleUploadedFile("a.png", photo_bytes, content_type="image/png")
    )
    api_client.post(reverse("v1:staff:inventory:invoice-scan-discard", kwargs={"pk": first.id}))

    second = _upload_bytes(
        api_client, SimpleUploadedFile("b.png", photo_bytes, content_type="image/png")
    )

    assert second.status == InvoiceScan.Status.PENDING
    assert second.duplicate_of is None
