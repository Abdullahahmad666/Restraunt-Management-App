"""Learning what a supplier's wording means, so nobody says it twice.

A supplier writes "HZ TOM KTCHP 2.5L"; the restaurant counts "Ketchup".
Nothing connects those except a person who once said so. These cover recording
that, and using it on the next delivery - the difference between a feature
that gets slower the more you use it and one that gets faster.
"""

import io
from decimal import Decimal
from itertools import count
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image

from apps.common.roles import Role
from apps.inventory.models import InventoryItem, InvoiceScan, ItemAlias, normalize_item_text
from apps.inventory.services import matching
from apps.inventory.tests.factories import line, scan_result
from apps.jobs.services import queue
from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db

INVOICES = "v1:staff:inventory:invoice-scan-list"


_photo_counter = count(2)


def _png():
    """A different image each call.

    Two identical files are now recognised as the same upload and the second
    is never read - correct behaviour, and fatal to a test that scans "the
    next delivery" using a copy of the first one's photo.
    """
    buffer = io.BytesIO()
    size = next(_photo_counter)
    Image.new("RGB", (size, size)).save(buffer, format="PNG")
    return SimpleUploadedFile(f"invoice-{size}.png", buffer.getvalue(), content_type="image/png")


@pytest.fixture(autouse=True)
def _media_root(tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path


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


@pytest.fixture
def ketchup(restaurant):
    return InventoryItem.objects.create(
        restaurant=restaurant, name="Ketchup", unit="bottle", quantity_on_hand=Decimal("0")
    )


def _scan(api_client, names):
    result = scan_result(items=[line(name, unit_price=2) for name in names])
    with patch("apps.inventory.services.scanning.extract_invoice_data", return_value=result):
        response = api_client.post(reverse(INVOICES), {"photo": _png()}, format="multipart")
        queue.run_next()
    return InvoiceScan.objects.get(pk=response.data["id"])


# ---------------------------------------------------------------------------
# The key
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Ketchup", "ketchup"),
        ("KETCHUP", "ketchup"),
        ("  Ketchup  ", "ketchup"),
        ("HZ TOM-KTCHP, 2.5L", "hz tom ktchp 2 5l"),
    ],
)
def test_the_key_ignores_case_punctuation_and_spacing(raw, expected):
    assert normalize_item_text(raw) == expected


def test_the_key_keeps_sizes_apart():
    """ "Tomatoes 5kg" and "Tomatoes 10kg" arrive as different lines at
    different prices, and are worth telling apart."""
    assert normalize_item_text("Tomatoes 5kg") != normalize_item_text("Tomatoes 10kg")


# ---------------------------------------------------------------------------
# Matching
# ---------------------------------------------------------------------------


def test_a_line_matches_an_item_by_its_own_name(restaurant, ketchup):
    found = matching.match_item(restaurant_id=restaurant.id, raw_name="KETCHUP")

    assert found == ketchup


def test_a_line_matches_an_alias_somebody_taught_us(restaurant, ketchup):
    ItemAlias.objects.create(restaurant=restaurant, item=ketchup, text="HZ TOM KTCHP 2.5L")

    found = matching.match_item(restaurant_id=restaurant.id, raw_name="hz tom ktchp 2.5l")

    assert found == ketchup


def test_an_alias_outranks_a_coincidence_of_spelling(restaurant, ketchup):
    """A person saying "this wording means that item" beats two names simply
    looking alike."""
    sauce = InventoryItem.objects.create(restaurant=restaurant, name="Brown Sauce", unit="bottle")
    ItemAlias.objects.create(restaurant=restaurant, item=sauce, text="Ketchup")

    assert matching.match_item(restaurant_id=restaurant.id, raw_name="Ketchup") == sauce


def test_nothing_matches_across_restaurants(restaurant, other_restaurant):
    InventoryItem.objects.create(restaurant=other_restaurant, name="Ketchup", unit="bottle")

    assert matching.match_item(restaurant_id=restaurant.id, raw_name="Ketchup") is None


def test_a_retired_item_is_not_matched(restaurant, ketchup):
    ketchup.is_active = False
    ketchup.save()

    assert matching.match_item(restaurant_id=restaurant.id, raw_name="Ketchup") is None


def test_resolving_many_names_takes_a_fixed_number_of_queries(
    restaurant, ketchup, django_assert_num_queries
):
    """A fifty-line delivery note matched one line at a time would be fifty
    lookups and fifty scans of the item list."""
    names = [f"Item {index}" for index in range(50)] + ["Ketchup"]

    with django_assert_num_queries(2):
        found = matching.resolve_items(restaurant_id=restaurant.id, raw_names=names)

    assert found == {"Ketchup": ketchup}


# ---------------------------------------------------------------------------
# Learning, and using what was learned
# ---------------------------------------------------------------------------


def test_confirming_teaches_the_wording_for_next_time(
    api_client, staff_member, restaurant, ketchup
):
    api_client.force_authenticate(user=staff_member)
    invoice = _scan(api_client, ["HZ TOM KTCHP 2.5L"])

    line = invoice.line_items.get()
    assert line.matched_item is None, "nothing taught yet, so nothing to match"

    # The reviewer says what it is, and confirms.
    api_client.patch(
        reverse("v1:staff:inventory:invoice-line-item-detail", kwargs={"pk": line.id}),
        {"matched_item": str(ketchup.id)},
        format="json",
    )
    api_client.post(reverse("v1:staff:inventory:invoice-scan-confirm", kwargs={"pk": invoice.id}))

    assert ItemAlias.objects.filter(restaurant=restaurant, item=ketchup).exists()

    # The next delivery says the same thing and arrives already matched.
    second = _scan(api_client, ["hz tom ktchp 2.5l"])
    assert second.line_items.get().matched_item == ketchup


def test_an_unconfirmed_review_teaches_nothing(api_client, staff_member, restaurant, ketchup):
    """Mid-review is full of matches somebody is still correcting."""
    api_client.force_authenticate(user=staff_member)
    invoice = _scan(api_client, ["MYSTERY ITEM"])

    api_client.patch(
        reverse(
            "v1:staff:inventory:invoice-line-item-detail",
            kwargs={"pk": invoice.line_items.get().id},
        ),
        {"matched_item": str(ketchup.id)},
        format="json",
    )

    assert not ItemAlias.objects.exists()


def test_correcting_a_wording_repoints_it_rather_than_duplicating(restaurant, ketchup):
    """Two answers to the same question is how a line gets matched to whichever
    row happened to be found first."""
    mayo = InventoryItem.objects.create(restaurant=restaurant, name="Mayonnaise", unit="bottle")
    ItemAlias.objects.create(restaurant=restaurant, item=ketchup, text="HZ SAUCE")

    invoice = InvoiceScan.objects.create(restaurant=restaurant, photo="invoice_scans/x.jpg")
    invoice.line_items.create(raw_name="HZ SAUCE", matched_item=mayo, quantity=Decimal("1"))

    matching.learn_aliases(restaurant=restaurant, invoice=invoice)

    alias = ItemAlias.objects.get(restaurant=restaurant, normalized_text="hz sauce")
    assert alias.item == mayo
    assert ItemAlias.objects.count() == 1


def test_an_unmatched_line_teaches_nothing(restaurant):
    invoice = InvoiceScan.objects.create(restaurant=restaurant, photo="invoice_scans/x.jpg")
    invoice.line_items.create(raw_name="MYSTERY", matched_item=None, quantity=Decimal("1"))

    assert matching.learn_aliases(restaurant=restaurant, invoice=invoice) == 0
    assert not ItemAlias.objects.exists()
