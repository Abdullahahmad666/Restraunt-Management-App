"""Uploading an invoice straight to S3 instead of through this service.

S3 itself is mocked - these cover the handshake around it, and above all that
a caller cannot get a scan queued for a file that never arrived.
"""

from unittest.mock import patch

import pytest
from botocore.exceptions import ClientError
from django.urls import reverse

from apps.common.roles import Role
from apps.inventory.models import InvoiceScan
from apps.inventory.services import uploads
from apps.jobs.models import Job
from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db

UPLOAD_URL = "v1:staff:inventory:invoice-scan-upload-url"
UPLOADED = "v1:staff:inventory:invoice-scan-uploaded"

PRESIGNED = {
    "url": "https://bucket.s3.eu-west-2.amazonaws.com/",
    "fields": {"key": "invoice_scans/abc.pdf", "policy": "...", "x-amz-signature": "..."},
}


@pytest.fixture
def staff_member(django_user_model):
    restaurant = Restaurant.objects.create(
        name="The Test Kitchen", currency="GBP", is_approved=True
    )
    return django_user_model.objects.create_user(
        email="alex@example.com", password="x", role=Role.STAFF, restaurant=restaurant
    )


@pytest.fixture
def s3_configured(settings):
    """Direct upload is only offered when a bucket exists."""
    settings.AWS_STORAGE_BUCKET_NAME = "test-bucket"
    settings.AWS_S3_REGION_NAME = "eu-west-2"
    return settings


def _request_url(api_client, content_type="application/pdf"):
    return api_client.post(reverse(UPLOAD_URL), {"content_type": content_type}, format="json")


# ---------------------------------------------------------------------------
# Handing out somewhere to upload to
# ---------------------------------------------------------------------------


def test_asking_for_an_upload_url_reserves_an_invoice(api_client, staff_member, s3_configured):
    api_client.force_authenticate(user=staff_member)

    with patch.object(uploads, "presign_upload", return_value=PRESIGNED):
        response = _request_url(api_client)

    assert response.status_code == 201, response.data
    assert response.data["upload"]["url"] == PRESIGNED["url"]
    assert response.data["upload"]["fields"] == PRESIGNED["fields"]

    invoice = InvoiceScan.objects.get()
    assert invoice.scan_state == InvoiceScan.ScanState.AWAITING_UPLOAD
    assert invoice.content_type == "application/pdf"
    assert invoice.photo.name.startswith("invoice_scans/")
    # Nothing to scan yet - the file does not exist.
    assert not Job.objects.exists()


def test_the_key_is_generated_not_taken_from_the_client(api_client, staff_member, s3_configured):
    """Two phones both sending "invoice.jpg" must not collide, and a
    client-supplied path is not one to build storage keys out of."""
    api_client.force_authenticate(user=staff_member)

    with patch.object(uploads, "presign_upload", return_value=PRESIGNED):
        first = _request_url(api_client).data["invoice"]["id"]
        second = _request_url(api_client).data["invoice"]["id"]

    keys = set(InvoiceScan.objects.values_list("photo", flat=True))
    assert len(keys) == 2, "two uploads must not share a key"
    assert first != second


def test_an_unreadable_type_is_refused_before_a_key_exists(api_client, staff_member, s3_configured):
    api_client.force_authenticate(user=staff_member)

    response = _request_url(api_client, content_type="text/html")

    assert response.status_code == 400
    assert not InvoiceScan.objects.exists()


def test_direct_upload_is_not_offered_without_a_bucket(api_client, staff_member, settings):
    settings.AWS_STORAGE_BUCKET_NAME = ""
    api_client.force_authenticate(user=staff_member)

    response = _request_url(api_client)

    assert response.status_code == 400
    # Plain language, not "on this server": this can reach a screen someone is
    # holding over a delivery note.
    assert "unavailable" in str(response.data).lower()


# ---------------------------------------------------------------------------
# Confirming the file landed
# ---------------------------------------------------------------------------


def test_confirming_an_upload_queues_the_scan(api_client, staff_member, s3_configured):
    api_client.force_authenticate(user=staff_member)
    with patch.object(uploads, "presign_upload", return_value=PRESIGNED):
        invoice_id = _request_url(api_client).data["invoice"]["id"]

    with patch.object(uploads, "verify_upload", return_value=(1234, "application/pdf")):
        response = api_client.post(reverse(UPLOADED, kwargs={"pk": invoice_id}))

    assert response.status_code == 202, response.data
    assert response.data["scan_state"] == "QUEUED"

    job = Job.objects.get()
    assert job.kind == "inventory.scan_invoice"
    assert job.payload == {"invoice_id": invoice_id}


def test_a_scan_is_not_queued_for_a_file_that_never_arrived(
    api_client, staff_member, s3_configured
):
    """The whole reason this call verifies rather than trusts - otherwise a
    caller could queue paid reads of files that do not exist."""
    api_client.force_authenticate(user=staff_member)
    with patch.object(uploads, "presign_upload", return_value=PRESIGNED):
        invoice_id = _request_url(api_client).data["invoice"]["id"]

    with patch.object(uploads, "verify_upload", side_effect=uploads.UploadNotFound("key")):
        response = api_client.post(reverse(UPLOADED, kwargs={"pk": invoice_id}))

    assert response.status_code == 400
    assert not Job.objects.exists()
    # The reservation survives, so the phone can finish uploading and retry.
    assert InvoiceScan.objects.get().scan_state == InvoiceScan.ScanState.AWAITING_UPLOAD


def test_an_unacceptable_file_is_dropped_and_the_reason_kept(
    api_client, staff_member, s3_configured
):
    """The object is junk so it leaves the bucket, but the row stays carrying
    the reason - the same way a failed scan does."""
    api_client.force_authenticate(user=staff_member)
    with patch.object(uploads, "presign_upload", return_value=PRESIGNED):
        invoice_id = _request_url(api_client).data["invoice"]["id"]

    with (
        patch.object(uploads, "verify_upload", side_effect=uploads.UploadRejected("Too large.")),
        patch.object(uploads, "delete_object") as delete_object,
    ):
        response = api_client.post(reverse(UPLOADED, kwargs={"pk": invoice_id}))

    assert response.status_code == 400
    delete_object.assert_called_once()
    assert not Job.objects.exists()

    invoice = InvoiceScan.objects.get()
    assert invoice.scan_state == InvoiceScan.ScanState.FAILED
    assert "Too large." in invoice.scan_error


def test_confirming_twice_is_rejected(api_client, staff_member, s3_configured):
    api_client.force_authenticate(user=staff_member)
    with patch.object(uploads, "presign_upload", return_value=PRESIGNED):
        invoice_id = _request_url(api_client).data["invoice"]["id"]

    with patch.object(uploads, "verify_upload", return_value=(1234, "application/pdf")):
        api_client.post(reverse(UPLOADED, kwargs={"pk": invoice_id}))
        second = api_client.post(reverse(UPLOADED, kwargs={"pk": invoice_id}))

    assert second.status_code == 400
    assert Job.objects.count() == 1, "a second confirmation must not queue a second scan"


# ---------------------------------------------------------------------------
# The verification itself
# ---------------------------------------------------------------------------


def _head(**kwargs):
    return patch.object(uploads, "_client", return_value=_FakeS3(**kwargs))


class _FakeS3:
    def __init__(self, head=None, error=None):
        self._head = head
        self._error = error

    def head_object(self, **kwargs):
        if self._error:
            raise self._error
        return self._head


def test_verify_accepts_a_good_object(s3_configured):
    with _head(head={"ContentLength": 2048, "ContentType": "image/png"}):
        assert uploads.verify_upload(key="k") == (2048, "image/png")


def test_verify_reports_a_missing_object(s3_configured):
    missing = ClientError({"Error": {"Code": "404"}}, "HeadObject")
    with _head(error=missing), pytest.raises(uploads.UploadNotFound):
        uploads.verify_upload(key="k")


@pytest.mark.parametrize(
    "head",
    [
        {"ContentLength": 0, "ContentType": "image/png"},
        {"ContentLength": uploads.MAX_FILE_BYTES + 1, "ContentType": "image/png"},
        {"ContentLength": 10, "ContentType": "text/html"},
    ],
)
def test_verify_rejects_what_we_will_not_read(head, s3_configured):
    with _head(head=head), pytest.raises(uploads.UploadRejected):
        uploads.verify_upload(key="k")
