"""Which files an invoice upload accepts, and how each reaches the model.

Suppliers email PDF invoices at least as often as staff photograph paper
ones, so both have to work - and a PDF has to arrive as a PDF rather than as
a picture of one.
"""

import io
from types import SimpleNamespace

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image

from apps.common.roles import Role
from apps.inventory.models import InvoiceScan
from apps.inventory.services import extraction, rasterise, scanning
from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db

STAFF_INVOICES = "v1:staff:inventory:invoice-scan-list"

# Enough of a PDF to be identified as one. The scan itself is mocked, so the
# body never has to be a document a reader would accept.
PDF_BYTES = b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"


def png_bytes():
    buffer = io.BytesIO()
    Image.new("RGB", (2, 2)).save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture
def staff_member(django_user_model):
    restaurant = Restaurant.objects.create(
        name="The Test Kitchen", currency="GBP", is_approved=True
    )
    return django_user_model.objects.create_user(
        email="alex@example.com", password="x", role=Role.STAFF, restaurant=restaurant
    )


@pytest.fixture(autouse=True)
def _media_root(tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path


def _post(api_client, upload):
    return api_client.post(reverse(STAFF_INVOICES), {"photo": upload}, format="multipart")


# ---------------------------------------------------------------------------
# What is accepted
# ---------------------------------------------------------------------------


def test_a_pdf_invoice_is_accepted(api_client, staff_member):
    api_client.force_authenticate(user=staff_member)

    response = _post(
        api_client, SimpleUploadedFile("invoice.pdf", PDF_BYTES, content_type="application/pdf")
    )

    assert response.status_code == 202, response.data
    assert InvoiceScan.objects.get().content_type == "application/pdf"


def test_a_photo_is_still_accepted(api_client, staff_member):
    api_client.force_authenticate(user=staff_member)

    response = _post(
        api_client, SimpleUploadedFile("invoice.png", png_bytes(), content_type="image/png")
    )

    assert response.status_code == 202, response.data
    assert InvoiceScan.objects.get().content_type == "image/png"


def test_a_file_we_cannot_read_is_rejected(api_client, staff_member):
    api_client.force_authenticate(user=staff_member)

    response = _post(
        api_client, SimpleUploadedFile("notes.txt", b"just some text", content_type="text/plain")
    )

    assert response.status_code == 400
    assert not InvoiceScan.objects.exists()


def test_an_oversized_file_is_rejected(api_client, staff_member):
    api_client.force_authenticate(user=staff_member)
    too_big = b"%PDF-1.7\n" + b"0" * scanning.MAX_FILE_BYTES

    response = _post(
        api_client, SimpleUploadedFile("huge.pdf", too_big, content_type="application/pdf")
    )

    assert response.status_code == 400
    assert not InvoiceScan.objects.exists()


# ---------------------------------------------------------------------------
# Working out what a file actually is
# ---------------------------------------------------------------------------


def test_the_file_itself_beats_what_the_client_called_it(api_client, staff_member):
    """Phones routinely send a perfectly good PDF as application/octet-stream.
    Trusting the declared type would turn those away."""
    api_client.force_authenticate(user=staff_member)

    response = _post(
        api_client,
        SimpleUploadedFile("invoice.pdf", PDF_BYTES, content_type="application/octet-stream"),
    )

    assert response.status_code == 202, response.data
    assert InvoiceScan.objects.get().content_type == "application/pdf"


@pytest.mark.parametrize(
    ("head", "expected"),
    [
        (b"%PDF-1.7", "application/pdf"),
        (b"\x89PNG\r\n\x1a\n", "image/png"),
        (b"\xff\xd8\xff\xe0", "image/jpeg"),
        (b"GIF89a", "image/gif"),
        (b"RIFF\x00\x00\x00\x00WEBP", "image/webp"),
        (b"not a known format", ""),
    ],
)
def test_sniffing_leading_bytes(head, expected):
    assert scanning.sniff_content_type(head) == expected


def test_sniffing_falls_back_to_a_credible_declared_type():
    assert scanning.sniff_content_type(b"unknown", "image/jpeg") == "image/jpeg"
    assert scanning.sniff_content_type(b"unknown", "text/html") == ""


# ---------------------------------------------------------------------------
# How each type reaches the model
# ---------------------------------------------------------------------------


def real_pdf(pages=1):
    """A genuinely valid PDF. Pillow writes one, which beats a hand-rolled
    byte string that only has to survive a magic-number check."""
    first, *rest = [Image.new("RGB", (120, 160), "white") for _ in range(pages)]
    buffer = io.BytesIO()
    first.save(buffer, format="PDF", save_all=bool(rest), append_images=rest)
    return buffer.getvalue()


def test_a_photo_is_sent_as_one_image():
    parts = extraction._pages_for(file_bytes=png_bytes(), content_type="image/png")

    assert len(parts) == 1
    assert parts[0]["type"] == "input_image"
    assert parts[0]["image_url"].startswith("data:image/png;base64,")


def test_a_pdf_is_rendered_to_one_image_per_page():
    parts = extraction._pages_for(file_bytes=real_pdf(pages=3), content_type="application/pdf")

    assert len(parts) == 3
    assert all(part["type"] == "input_image" for part in parts)
    # Rendered, so they arrive as JPEGs rather than as the PDF itself.
    assert all(part["image_url"].startswith("data:image/jpeg;base64,") for part in parts)


def test_pages_are_sent_at_full_detail():
    """Dot-matrix print, carbon copies and watermarked scans need it - "low"
    downsamples past the point those are readable."""
    parts = extraction._pages_for(file_bytes=png_bytes(), content_type="image/png")

    assert parts[0]["detail"] == "high"


def test_a_pdf_longer_than_an_invoice_is_refused():
    """Every page costs money whether it holds line items or terms and
    conditions - and reading only the first few would drop most of a long
    document's lines with nothing to show that it had happened."""
    with pytest.raises(extraction.PermanentScanError) as caught:
        extraction._pages_for(
            file_bytes=real_pdf(pages=rasterise.MAX_PAGES + 1), content_type="application/pdf"
        )

    assert "pages" in str(caught.value)


def test_a_corrupt_pdf_fails_with_something_a_person_can_act_on():
    with pytest.raises(extraction.PermanentScanError):
        extraction._pages_for(file_bytes=b"%PDF-1.7 not really", content_type="application/pdf")


def test_an_unsupported_type_never_reaches_the_api():
    with pytest.raises(scanning.PermanentScanError):
        scanning.extract_invoice_data(image_bytes=b"whatever", content_type="text/html")


def test_an_oversized_file_never_reaches_the_api():
    with pytest.raises(scanning.PermanentScanError):
        scanning.extract_invoice_data(
            image_bytes=b"0" * (scanning.MAX_FILE_BYTES + 1), content_type="image/png"
        )


def test_an_old_row_without_a_stored_type_falls_back_to_its_extension():
    """Rows uploaded before content_type existed still have to scan, and a
    .pdf among them must not be sent as a JPEG."""
    assert scanning._type_from_name("invoice_scans/abc.pdf") == "application/pdf"
    assert scanning._type_from_name("invoice_scans/abc.PNG") == "image/png"
    assert scanning._type_from_name("invoice_scans/abc") == "image/jpeg"


# ---------------------------------------------------------------------------
# Pages worth paying for
# ---------------------------------------------------------------------------


class FakePage:
    """A PDF page with whatever text layer a test wants, or none."""

    def __init__(self, text=None, raises=False):
        self._text = text
        self._raises = raises

    def get_textpage(self):
        if self._raises:
            raise RuntimeError("no text layer")
        return SimpleNamespace(get_text_range=lambda: self._text)


def test_a_page_with_no_digits_on_it_is_not_sent():
    """Terms and conditions, delivery instructions, a blank back page. Each
    costs about a thousand tokens to send and cannot hold a line item: every
    quantity, price, date, invoice number and total is digits."""
    page = FakePage("TERMS AND CONDITIONS\nGoods remain the property of the seller")

    assert rasterise._carries_nothing(page) is True


def test_a_page_with_figures_on_it_is_always_sent():
    page = FakePage("Ketchup 1L x 6 @ 3.99")

    assert rasterise._carries_nothing(page) is False


def test_a_scanned_page_is_sent_rather_than_guessed_at():
    """A photographed page has no text layer, so an empty read says nothing
    about whether the page is empty. The expensive answer is the safe one."""
    assert rasterise._carries_nothing(FakePage("")) is False
    assert rasterise._carries_nothing(FakePage(None)) is False
    assert rasterise._carries_nothing(FakePage(raises=True)) is False
