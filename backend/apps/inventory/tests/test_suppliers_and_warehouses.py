"""Who supplied an invoice and where it went.

A supplier used to be whatever string a vision model read off the top of the
page, which is fine to display and useless to filter by. These cover turning
that into something two spellings of one supplier agree on - without letting a
misread invent a supplier nobody buys from.
"""

import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image

from apps.common.roles import Role
from apps.inventory.models import InvoiceScan, Supplier, Warehouse, normalize_supplier_name
from apps.inventory.services.suppliers import match_supplier
from apps.inventory.tests.factories import line, scan_result
from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db

STAFF_SUPPLIERS = "v1:staff:inventory:supplier-list"
STAFF_WAREHOUSES = "v1:staff:inventory:warehouse-list"
ADMIN_SUPPLIERS = "v1:admin:inventory:supplier-list"


def _png_upload():
    buffer = io.BytesIO()
    Image.new("RGB", (2, 2)).save(buffer, format="PNG")
    return SimpleUploadedFile("invoice.png", buffer.getvalue(), content_type="image/png")


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
def admin_user(django_user_model, restaurant):
    return django_user_model.objects.create_user(
        email="sam@example.com", password="x", role=Role.ADMIN, restaurant=restaurant
    )


# ---------------------------------------------------------------------------
# Making two spellings of one supplier agree
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Fresh Foods Ltd", "fresh foods"),
        ("FRESH FOODS LTD.", "fresh foods"),
        ("  fresh   foods  limited ", "fresh foods"),
        ("Fresh-Foods, Ltd", "fresh foods"),
        ("Fresh Foods", "fresh foods"),
        ("", ""),
    ],
)
def test_normalizing_collapses_the_differences_that_are_not_differences(raw, expected):
    assert normalize_supplier_name(raw) == expected


def test_normalizing_keeps_suppliers_that_really_are_different_apart():
    assert normalize_supplier_name("Fresh Foods") != normalize_supplier_name("Fresher Foods")
    # "Co" is a legal suffix, but only when it trails - dropping it anywhere
    # would merge these two.
    assert normalize_supplier_name("Co Op Wholesale") != normalize_supplier_name("Wholesale")


def test_a_supplier_cannot_be_added_twice_under_a_different_spelling(restaurant):
    Supplier.objects.create(restaurant=restaurant, name="Fresh Foods Ltd")

    with pytest.raises(Exception):  # noqa: B017 - IntegrityError, surfaced by the constraint
        Supplier.objects.create(restaurant=restaurant, name="FRESH FOODS LIMITED")


def test_two_restaurants_may_each_have_the_same_supplier(restaurant, other_restaurant):
    Supplier.objects.create(restaurant=restaurant, name="Fresh Foods Ltd")
    Supplier.objects.create(restaurant=other_restaurant, name="Fresh Foods Ltd")

    assert Supplier.objects.count() == 2


# ---------------------------------------------------------------------------
# Matching, and the line it will not cross
# ---------------------------------------------------------------------------


def test_matching_finds_a_supplier_spelled_differently(restaurant):
    supplier = Supplier.objects.create(restaurant=restaurant, name="Fresh Foods Ltd")

    found = match_supplier(restaurant_id=restaurant.id, raw_name="FRESH FOODS LTD.")

    assert found == supplier


def test_matching_never_invents_a_supplier(restaurant):
    """A misread line must not become a permanent row in every later filter."""
    assert match_supplier(restaurant_id=restaurant.id, raw_name="Fresh Foods Lfd") is None
    assert not Supplier.objects.exists()


def test_matching_ignores_another_restaurants_supplier(restaurant, other_restaurant):
    Supplier.objects.create(restaurant=other_restaurant, name="Fresh Foods Ltd")

    assert match_supplier(restaurant_id=restaurant.id, raw_name="Fresh Foods Ltd") is None


def test_matching_ignores_a_retired_supplier(restaurant):
    Supplier.objects.create(restaurant=restaurant, name="Fresh Foods Ltd", is_active=False)

    assert match_supplier(restaurant_id=restaurant.id, raw_name="Fresh Foods Ltd") is None


def test_matching_on_nothing_matches_nothing(restaurant):
    assert match_supplier(restaurant_id=restaurant.id, raw_name="") is None
    assert match_supplier(restaurant_id=restaurant.id, raw_name="   ") is None


# ---------------------------------------------------------------------------
# The API
# ---------------------------------------------------------------------------


def test_staff_see_only_their_own_restaurants_suppliers(
    api_client, staff_member, restaurant, other_restaurant
):
    Supplier.objects.create(restaurant=restaurant, name="Ours")
    Supplier.objects.create(restaurant=other_restaurant, name="Theirs")
    api_client.force_authenticate(user=staff_member)

    response = api_client.get(reverse(STAFF_SUPPLIERS))

    assert [row["name"] for row in response.data["results"]] == ["Ours"]


def test_staff_can_add_a_supplier_mid_review(api_client, staff_member, restaurant):
    api_client.force_authenticate(user=staff_member)

    response = api_client.post(reverse(STAFF_SUPPLIERS), {"name": "New Supplier"}, format="json")

    assert response.status_code == 201, response.data
    assert Supplier.objects.get().restaurant == restaurant


def test_staff_cannot_retire_a_supplier(api_client, staff_member, restaurant):
    supplier = Supplier.objects.create(restaurant=restaurant, name="Fresh Foods Ltd")
    api_client.force_authenticate(user=staff_member)

    response = api_client.patch(
        f"{reverse(STAFF_SUPPLIERS)}{supplier.id}/", {"is_active": False}, format="json"
    )

    assert response.status_code in (403, 404, 405)
    supplier.refresh_from_db()
    assert supplier.is_active is True


def test_an_admin_can_retire_a_supplier(api_client, admin_user, restaurant):
    supplier = Supplier.objects.create(restaurant=restaurant, name="Fresh Foods Ltd")
    api_client.force_authenticate(user=admin_user)

    response = api_client.patch(
        f"{reverse(ADMIN_SUPPLIERS)}{supplier.id}/", {"is_active": False}, format="json"
    )

    assert response.status_code == 200, response.data
    supplier.refresh_from_db()
    assert supplier.is_active is False


def test_warehouses_are_read_only_for_staff(api_client, staff_member):
    api_client.force_authenticate(user=staff_member)

    response = api_client.post(reverse(STAFF_WAREHOUSES), {"name": "Cellar"}, format="json")

    assert response.status_code == 405
    assert not Warehouse.objects.exists()


# ---------------------------------------------------------------------------
# Attaching them to an invoice
# ---------------------------------------------------------------------------


def _load_backfill():
    """The migration's own function, by import rather than a copy.

    A copy would pass while the real migration was broken, which is the one
    thing a test of a migration must not do. The module name starts with a
    digit, so it cannot be reached with import syntax.
    """
    import importlib

    module = importlib.import_module("apps.inventory.migrations.0005_supplier_and_warehouse")
    return module.backfill_suppliers


def _invoice(restaurant, **kwargs):
    return InvoiceScan.objects.create(restaurant=restaurant, photo="invoice_scans/x.jpg", **kwargs)


def test_a_reviewer_can_set_the_supplier_and_warehouse(api_client, staff_member, restaurant):
    invoice = _invoice(restaurant)
    supplier = Supplier.objects.create(restaurant=restaurant, name="Fresh Foods Ltd")
    warehouse = Warehouse.objects.create(restaurant=restaurant, name="Dry store")
    api_client.force_authenticate(user=staff_member)

    response = api_client.patch(
        reverse("v1:staff:inventory:invoice-scan-detail", kwargs={"pk": invoice.id}),
        {"supplier": str(supplier.id), "warehouse": str(warehouse.id)},
        format="json",
    )

    assert response.status_code == 200, response.data
    assert response.data["supplier_display"] == "Fresh Foods Ltd"
    assert response.data["warehouse_display"] == "Dry store"


def test_another_restaurants_supplier_cannot_be_attached(
    api_client, staff_member, restaurant, other_restaurant
):
    """A foreign key is not scoped by the queryset mixin, so without an
    explicit check this would quietly corrupt both restaurants' reporting."""
    invoice = _invoice(restaurant)
    theirs = Supplier.objects.create(restaurant=other_restaurant, name="Not Ours")
    api_client.force_authenticate(user=staff_member)

    response = api_client.patch(
        reverse("v1:staff:inventory:invoice-scan-detail", kwargs={"pk": invoice.id}),
        {"supplier": str(theirs.id)},
        format="json",
    )

    assert response.status_code == 400
    invoice.refresh_from_db()
    assert invoice.supplier_id is None


def test_a_confirmed_invoice_cannot_be_reassigned(api_client, staff_member, restaurant):
    invoice = _invoice(restaurant, status=InvoiceScan.Status.CONFIRMED)
    supplier = Supplier.objects.create(restaurant=restaurant, name="Fresh Foods Ltd")
    api_client.force_authenticate(user=staff_member)

    response = api_client.patch(
        reverse("v1:staff:inventory:invoice-scan-detail", kwargs={"pk": invoice.id}),
        {"supplier": str(supplier.id)},
        format="json",
    )

    assert response.status_code == 400
    invoice.refresh_from_db()
    assert invoice.supplier_id is None


def test_a_scan_links_itself_to_a_supplier_the_restaurant_already_has(
    api_client, staff_member, restaurant
):
    """The compounding bit: once a supplier is on the list, every later
    invoice from them attaches itself without anyone picking."""
    from unittest.mock import patch

    from apps.jobs.services import queue

    supplier = Supplier.objects.create(restaurant=restaurant, name="Fresh Foods Ltd")
    api_client.force_authenticate(user=staff_member)

    result = scan_result(supplier_name="FRESH FOODS LTD.", items=[line("Milk")])
    with patch("apps.inventory.services.scanning.extract_invoice_data", return_value=result):
        api_client.post(
            reverse("v1:staff:inventory:invoice-scan-list"),
            {"photo": _png_upload()},
            format="multipart",
        )
        queue.run_next()

    invoice = InvoiceScan.objects.get()
    assert invoice.supplier == supplier
    # The raw text is kept too - it is the evidence for the match.
    assert invoice.supplier_name == "FRESH FOODS LTD."


def test_a_scan_of_an_unknown_supplier_leaves_it_for_the_reviewer(
    api_client, staff_member, restaurant
):
    from unittest.mock import patch

    from apps.jobs.services import queue

    api_client.force_authenticate(user=staff_member)
    result = scan_result(supplier_name="Someone New Ltd", items=[line("Milk")])
    with patch("apps.inventory.services.scanning.extract_invoice_data", return_value=result):
        api_client.post(
            reverse("v1:staff:inventory:invoice-scan-list"),
            {"photo": _png_upload()},
            format="multipart",
        )
        queue.run_next()

    invoice = InvoiceScan.objects.get()
    assert invoice.supplier_id is None
    assert invoice.supplier_name == "Someone New Ltd"
    assert not Supplier.objects.exists()


# ---------------------------------------------------------------------------
# The backfill
# ---------------------------------------------------------------------------


def test_the_backfill_turns_past_invoice_text_into_suppliers(restaurant, other_restaurant):
    """Without it a restaurant's own history is invisible to the filters this
    all exists to enable: the supplier list starts empty while every past
    invoice still reads "Fresh Foods Ltd" and matches nothing.
    """
    from django.apps import apps as django_apps

    backfill_suppliers = _load_backfill()

    # Three spellings of one supplier, one of another, one from a different
    # restaurant, and one with nothing readable.
    for name in ["Fresh Foods Ltd", "FRESH FOODS LTD.", "fresh foods limited", "Dairy Co"]:
        _invoice(restaurant, supplier_name=name)
    _invoice(other_restaurant, supplier_name="Fresh Foods Ltd")
    _invoice(restaurant, supplier_name="")

    Supplier.objects.all().delete()
    InvoiceScan.objects.update(supplier=None)

    backfill_suppliers(django_apps, None)

    # Three spellings collapse to one supplier; the other restaurant keeps its
    # own even though the name is identical.
    assert Supplier.objects.filter(restaurant=restaurant).count() == 2
    assert Supplier.objects.filter(restaurant=other_restaurant).count() == 1

    fresh = Supplier.objects.get(restaurant=restaurant, normalized_name="fresh foods")
    assert InvoiceScan.objects.filter(supplier=fresh).count() == 3

    # An invoice whose supplier was never read stays unassigned rather than
    # being attached to something invented.
    assert InvoiceScan.objects.filter(supplier__isnull=True).count() == 1


def test_the_backfill_normalizes_the_same_way_the_matcher_does(restaurant):
    """A backfill that normalized differently would create rows the matcher
    could never find again."""
    from django.apps import apps as django_apps

    backfill_suppliers = _load_backfill()

    _invoice(restaurant, supplier_name="FRESH FOODS LTD.")
    Supplier.objects.all().delete()

    backfill_suppliers(django_apps, None)

    assert match_supplier(restaurant_id=restaurant.id, raw_name="Fresh Foods Limited") is not None


# ---------------------------------------------------------------------------
# Warehouses read off the invoice
# ---------------------------------------------------------------------------


def test_a_scan_creates_a_warehouse_it_has_not_seen(restaurant):
    from apps.inventory.services.warehouses import resolve_warehouse

    created = resolve_warehouse(restaurant_id=restaurant.id, raw_name="Cellar")

    assert created is not None
    assert created.name == "Cellar"
    assert Warehouse.objects.count() == 1


def test_the_next_invoice_reuses_it_rather_than_adding_another(restaurant):
    """A restaurant has a handful of storage areas and they repeat on every
    delivery note - the second invoice must match the first."""
    from apps.inventory.services.warehouses import resolve_warehouse

    first = resolve_warehouse(restaurant_id=restaurant.id, raw_name="Cellar")
    second = resolve_warehouse(restaurant_id=restaurant.id, raw_name="  CELLAR  ")

    assert first == second
    assert Warehouse.objects.count() == 1


def test_a_retired_warehouse_is_reused_not_recreated(restaurant):
    """Creating a second row with the same name would be worse than naming one
    an admin has put away."""
    from apps.inventory.services.warehouses import resolve_warehouse

    retired = Warehouse.objects.create(restaurant=restaurant, name="Cellar", is_active=False)

    assert resolve_warehouse(restaurant_id=restaurant.id, raw_name="cellar") == retired
    assert Warehouse.objects.count() == 1


@pytest.mark.parametrize("junk", ["", "   ", "-", "."])
def test_nothing_usable_creates_nothing(restaurant, junk):
    """Most invoices say nothing about where the goods ended up, and a stray
    character off the page is not a storage area."""
    from apps.inventory.services.warehouses import resolve_warehouse

    assert resolve_warehouse(restaurant_id=restaurant.id, raw_name=junk) is None
    assert not Warehouse.objects.exists()


def test_two_restaurants_may_each_have_a_cellar(restaurant, other_restaurant):
    from apps.inventory.services.warehouses import resolve_warehouse

    resolve_warehouse(restaurant_id=restaurant.id, raw_name="Cellar")
    resolve_warehouse(restaurant_id=other_restaurant.id, raw_name="Cellar")

    assert Warehouse.objects.count() == 2


def test_a_scanned_invoice_is_filed_where_it_says_it_went(api_client, staff_member, restaurant):
    from unittest.mock import patch

    from apps.jobs.services import queue

    api_client.force_authenticate(user=staff_member)
    result = scan_result(shipping_address="Dry Store", items=[line("Milk")])
    with patch("apps.inventory.services.scanning.extract_invoice_data", return_value=result):
        api_client.post(
            reverse("v1:staff:inventory:invoice-scan-list"),
            {"photo": _png_upload()},
            format="multipart",
        )
        queue.run_next()

    invoice = InvoiceScan.objects.get()
    assert invoice.warehouse is not None
    assert invoice.warehouse.name == "Dry Store"
    # The text it was resolved from is kept beside it, as the evidence.
    assert invoice.delivery_location == "Dry Store"
