"""The paperwork a manager produces when an inspector asks for it.

Most of these are about who may not see it. The documents here are a
restaurant's licences, insurance and certificates - its legal identity in a
folder - and the decision was that they are the manager's alone. Staff have no
route to them at all, which is a thing to assert rather than assume: a missing
route is one careless router registration away from existing.
"""

import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image

from apps.common.roles import Role
from apps.compliance.models import ComplianceDocument, DocumentCategory
from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db

DOCUMENTS = "v1:admin:compliance:document-list"
DOCUMENT = "v1:admin:compliance:document-detail"
CATEGORIES = "v1:admin:compliance:document-category-list"
CATEGORY = "v1:admin:compliance:document-category-detail"


@pytest.fixture
def restaurant():
    return Restaurant.objects.create(name="The Test Kitchen", currency="GBP", is_approved=True)


@pytest.fixture
def other_restaurant():
    return Restaurant.objects.create(name="Down The Road", currency="GBP", is_approved=True)


@pytest.fixture
def admin_user(django_user_model, restaurant):
    return django_user_model.objects.create_user(
        email="sam@example.com", password="x", role=Role.ADMIN, restaurant=restaurant
    )


@pytest.fixture
def staff_member(django_user_model, restaurant):
    return django_user_model.objects.create_user(
        email="alex@example.com", password="x", role=Role.STAFF, restaurant=restaurant
    )


def photo(name="certificate.jpg"):
    buffer = io.BytesIO()
    Image.new("RGB", (40, 40), "white").save(buffer, format="JPEG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/jpeg")


def pdf(name="licence.pdf"):
    return SimpleUploadedFile(name, b"%PDF-1.4 a premises licence", content_type="application/pdf")


# ---------------------------------------------------------------------------
# Who may see any of this
# ---------------------------------------------------------------------------


def test_staff_cannot_read_the_documents(api_client, staff_member):
    """The whole access decision, in one assertion."""
    api_client.force_authenticate(user=staff_member)

    assert api_client.get(reverse(DOCUMENTS)).status_code == 403


def test_staff_cannot_upload_one(api_client, staff_member):
    api_client.force_authenticate(user=staff_member)

    response = api_client.post(
        reverse(DOCUMENTS), {"title": "Mine", "file": photo()}, format="multipart"
    )

    assert response.status_code == 403


def test_staff_cannot_see_the_categories_either(api_client, staff_member):
    """The names a restaurant files its paperwork under say what it holds, so
    they are no more public than the documents themselves."""
    api_client.force_authenticate(user=staff_member)

    assert api_client.get(reverse(CATEGORIES)).status_code == 403


def test_another_restaurants_documents_are_not_visible(
    api_client, admin_user, restaurant, other_restaurant
):
    ComplianceDocument.objects.create(
        restaurant=other_restaurant, title="Their licence", file="compliance_documents/x.pdf"
    )
    mine = ComplianceDocument.objects.create(
        restaurant=restaurant, title="My licence", file="compliance_documents/y.pdf"
    )
    api_client.force_authenticate(user=admin_user)

    results = api_client.get(reverse(DOCUMENTS)).data["results"]

    assert [row["title"] for row in results] == [mine.title]


# ---------------------------------------------------------------------------
# Uploading
# ---------------------------------------------------------------------------


def test_a_photographed_certificate_is_stored_as_an_image(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(
        reverse(DOCUMENTS), {"title": "Food hygiene rating", "file": photo()}, format="multipart"
    )

    assert response.status_code == 201
    assert response.data["content_type"] == "image/jpeg"
    # What the screen reads to decide between drawing it and handing it to the
    # phone's own viewer.
    assert response.data["is_image"] is True
    assert response.data["uploaded_by_name"] == admin_user.email


def test_a_pdf_is_stored_as_a_pdf(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(
        reverse(DOCUMENTS), {"title": "Premises licence", "file": pdf()}, format="multipart"
    )

    assert response.status_code == 201
    assert response.data["content_type"] == "application/pdf"
    assert response.data["is_image"] is False


def test_the_bytes_beat_the_name_and_the_label(api_client, admin_user):
    """A phone will upload a perfectly good PDF as application/octet-stream,
    and a JPEG called .pdf is still a JPEG. Whatever is stored has to be what
    the file actually is, because the screen decides how to open it from
    that."""
    api_client.force_authenticate(user=admin_user)
    mislabelled = SimpleUploadedFile(
        "scan.pdf", b"%PDF-1.4 really a pdf", content_type="application/octet-stream"
    )

    response = api_client.post(
        reverse(DOCUMENTS), {"title": "Insurance", "file": mislabelled}, format="multipart"
    )

    assert response.data["content_type"] == "application/pdf"


def test_a_file_we_cannot_read_is_refused(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    spreadsheet = SimpleUploadedFile("accounts.xlsx", b"PK\x03\x04 zip", content_type="")

    response = api_client.post(
        reverse(DOCUMENTS), {"title": "Accounts", "file": spreadsheet}, format="multipart"
    )

    assert response.status_code == 400
    assert "photo" in str(response.data).lower() or "pdf" in str(response.data).lower()


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------


def test_a_category_counts_what_is_filed_under_it(api_client, admin_user, restaurant):
    licences = DocumentCategory.objects.create(restaurant=restaurant, name="Licences")
    DocumentCategory.objects.create(restaurant=restaurant, name="Insurance")
    ComplianceDocument.objects.create(
        restaurant=restaurant, category=licences, title="Premises", file="x.pdf"
    )
    api_client.force_authenticate(user=admin_user)

    rows = {
        row["name"]: row["document_count"]
        for row in api_client.get(reverse(CATEGORIES)).data["results"]
    }

    assert rows == {"Licences": 1, "Insurance": 0}


def test_a_category_with_documents_cannot_be_deleted(api_client, admin_user, restaurant):
    """It is their only label. Retiring is how you stop using one - deleting
    it would leave the certificates filed under nothing."""
    licences = DocumentCategory.objects.create(restaurant=restaurant, name="Licences")
    ComplianceDocument.objects.create(
        restaurant=restaurant, category=licences, title="Premises", file="x.pdf"
    )
    api_client.force_authenticate(user=admin_user)

    response = api_client.delete(reverse(CATEGORY, args=[licences.id]))

    assert response.status_code == 400
    assert DocumentCategory.objects.filter(id=licences.id).exists()


def test_an_empty_category_can_be_deleted(api_client, admin_user, restaurant):
    spare = DocumentCategory.objects.create(restaurant=restaurant, name="Typo")
    api_client.force_authenticate(user=admin_user)

    assert api_client.delete(reverse(CATEGORY, args=[spare.id])).status_code == 204


def test_a_document_cannot_be_filed_under_another_restaurants_category(
    api_client, admin_user, other_restaurant
):
    """Scoped on read by the queryset; this is the write side of the same
    rule, which the queryset does not cover."""
    theirs = DocumentCategory.objects.create(restaurant=other_restaurant, name="Theirs")
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(
        reverse(DOCUMENTS),
        {"title": "Mine", "file": photo(), "category": str(theirs.id)},
        format="multipart",
    )

    assert response.status_code == 400


def test_documents_can_be_filtered_to_one_category(api_client, admin_user, restaurant):
    licences = DocumentCategory.objects.create(restaurant=restaurant, name="Licences")
    insurance = DocumentCategory.objects.create(restaurant=restaurant, name="Insurance")
    ComplianceDocument.objects.create(
        restaurant=restaurant, category=licences, title="Premises", file="x.pdf"
    )
    ComplianceDocument.objects.create(
        restaurant=restaurant, category=insurance, title="Liability", file="y.pdf"
    )
    api_client.force_authenticate(user=admin_user)

    response = api_client.get(reverse(DOCUMENTS), {"category": str(licences.id)})

    assert [row["title"] for row in response.data["results"]] == ["Premises"]


def test_deleting_a_document_is_allowed(api_client, admin_user, restaurant):
    """Paperwork gets replaced - a renewed certificate makes the old one
    clutter in front of an inspector."""
    document = ComplianceDocument.objects.create(
        restaurant=restaurant, title="Old licence", file="x.pdf"
    )
    api_client.force_authenticate(user=admin_user)

    assert api_client.delete(reverse(DOCUMENT, args=[document.id])).status_code == 204
    assert not ComplianceDocument.objects.filter(id=document.id).exists()


def test_categories_come_back_in_the_order_the_manager_set(api_client, admin_user, restaurant):
    """`sort_order` exists because an inspector asks for the hygiene
    certificate first and the pest contract last. Counting the documents in
    each adds a GROUP BY, and Django drops the model's ordering when it does -
    so this is the assertion that keeps the field meaning anything."""
    DocumentCategory.objects.create(restaurant=restaurant, name="Pest control", sort_order=3)
    DocumentCategory.objects.create(restaurant=restaurant, name="Food hygiene", sort_order=1)
    DocumentCategory.objects.create(restaurant=restaurant, name="Insurance", sort_order=2)
    api_client.force_authenticate(user=admin_user)

    names = [row["name"] for row in api_client.get(reverse(CATEGORIES)).data["results"]]

    assert names == ["Food hygiene", "Insurance", "Pest control"]
