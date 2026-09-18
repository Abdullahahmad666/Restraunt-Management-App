"""Fridge/freezer units, opening/closing checklists, and the shared
(not-per-staff) temperature readings and completions recorded against them."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.urls import reverse

from apps.common.roles import Role
from apps.compliance.models import ChecklistItem, FridgeUnit, Routine
from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db

ADMIN_FRIDGES = "v1:admin:compliance:fridge-unit-list"
ADMIN_CHECKLIST_ITEMS = "v1:admin:compliance:checklist-item-list"
STAFF_FRIDGES = "v1:staff:compliance:fridge-unit-list"
STAFF_CHECKLIST_ITEMS = "v1:staff:compliance:checklist-item-list"
STAFF_READINGS = "v1:staff:compliance:temperature-reading-list"
STAFF_COMPLETIONS = "v1:staff:compliance:checklist-completion-list"


@pytest.fixture
def restaurant():
    return Restaurant.objects.create(name="The Test Kitchen", currency="GBP", is_approved=True)


@pytest.fixture
def other_restaurant():
    return Restaurant.objects.create(name="Down The Road", currency="GBP", is_approved=True)


@pytest.fixture
def admin(django_user_model, restaurant):
    return django_user_model.objects.create_user(
        email="owner@example.com", password="x", role=Role.ADMIN, restaurant=restaurant
    )


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
def colleague(django_user_model, restaurant):
    return django_user_model.objects.create_user(
        email="sam@example.com",
        first_name="Sam",
        password="x",
        role=Role.STAFF,
        restaurant=restaurant,
    )


@pytest.fixture
def fridge(restaurant):
    return FridgeUnit.objects.create(
        restaurant=restaurant,
        name="Fridge 1",
        kind=FridgeUnit.Kind.FRIDGE,
        recommended_max_celsius=Decimal("5.0"),
    )


@pytest.fixture
def opening_item(restaurant):
    return ChecklistItem.objects.create(
        restaurant=restaurant, routine=Routine.OPENING, text="Staff fit for work"
    )


# ---------------------------------------------------------------------------
# Admin: managing fridges and checklist items
# ---------------------------------------------------------------------------


def test_admin_can_register_a_fridge(api_client, admin):
    api_client.force_authenticate(user=admin)

    response = api_client.post(
        reverse(ADMIN_FRIDGES),
        {"name": "Walk-in Freezer", "kind": "FREEZER", "recommended_max_celsius": "-18.0"},
    )

    assert response.status_code == 201, response.data
    assert response.data["name"] == "Walk-in Freezer"


def test_admin_can_add_a_checklist_item(api_client, admin):
    api_client.force_authenticate(user=admin)

    response = api_client.post(
        reverse(ADMIN_CHECKLIST_ITEMS), {"routine": "CLOSING", "text": "Floors swept and clean"}
    )

    assert response.status_code == 201, response.data
    assert response.data["routine"] == "CLOSING"


def test_admin_fridge_list_is_scoped_to_their_own_restaurant(
    api_client, admin, fridge, other_restaurant
):
    FridgeUnit.objects.create(
        restaurant=other_restaurant,
        name="Someone else's fridge",
        recommended_max_celsius=Decimal("5.0"),
    )
    api_client.force_authenticate(user=admin)

    response = api_client.get(reverse(ADMIN_FRIDGES))

    names = [row["name"] for row in response.data["results"]]
    assert names == ["Fridge 1"]


# ---------------------------------------------------------------------------
# Staff: reading the shared setup
# ---------------------------------------------------------------------------


def test_staff_sees_only_active_fridges_at_their_restaurant(
    api_client, staff_member, fridge, restaurant, other_restaurant
):
    FridgeUnit.objects.create(
        restaurant=restaurant,
        name="Retired fridge",
        is_active=False,
        recommended_max_celsius=Decimal("5.0"),
    )
    FridgeUnit.objects.create(
        restaurant=other_restaurant,
        name="Someone else's fridge",
        recommended_max_celsius=Decimal("5.0"),
    )
    api_client.force_authenticate(user=staff_member)

    response = api_client.get(reverse(STAFF_FRIDGES))

    names = [row["name"] for row in response.data["results"]]
    assert names == ["Fridge 1"]


def test_staff_can_filter_checklist_items_by_routine(api_client, staff_member, restaurant):
    ChecklistItem.objects.create(restaurant=restaurant, routine=Routine.OPENING, text="Opening one")
    ChecklistItem.objects.create(restaurant=restaurant, routine=Routine.CLOSING, text="Closing one")
    api_client.force_authenticate(user=staff_member)

    response = api_client.get(reverse(STAFF_CHECKLIST_ITEMS), {"routine": "OPENING"})

    texts = [row["text"] for row in response.data["results"]]
    assert texts == ["Opening one"]


# ---------------------------------------------------------------------------
# Staff: recording a temperature reading - shared, not per staff member
# ---------------------------------------------------------------------------


def test_staff_can_record_a_temperature_reading(api_client, staff_member, fridge):
    api_client.force_authenticate(user=staff_member)

    response = api_client.post(
        reverse(STAFF_READINGS),
        {"fridge_unit": str(fridge.id), "routine": "OPENING", "celsius": "3.5"},
    )

    assert response.status_code == 201, response.data
    assert response.data["recorded_by_name"] == "Alex"
    assert response.data["is_within_range"] is True


def test_an_out_of_range_reading_is_flagged(api_client, staff_member, fridge):
    api_client.force_authenticate(user=staff_member)

    response = api_client.post(
        reverse(STAFF_READINGS),
        {"fridge_unit": str(fridge.id), "routine": "OPENING", "celsius": "9.0"},
    )

    assert response.status_code == 201, response.data
    assert response.data["is_within_range"] is False


def test_recording_again_corrects_the_shared_reading_rather_than_erroring(
    api_client, staff_member, colleague, fridge
):
    api_client.force_authenticate(user=staff_member)
    api_client.post(
        reverse(STAFF_READINGS),
        {"fridge_unit": str(fridge.id), "routine": "OPENING", "celsius": "3.5"},
    )

    api_client.force_authenticate(user=colleague)
    response = api_client.post(
        reverse(STAFF_READINGS),
        {"fridge_unit": str(fridge.id), "routine": "OPENING", "celsius": "4.0"},
    )

    assert response.status_code == 201, response.data
    assert response.data["celsius"] == "4.0"
    assert response.data["recorded_by_name"] == "Sam"
    # Still exactly one row for this fridge/routine/day, not two.
    list_response = api_client.get(reverse(STAFF_READINGS))
    assert list_response.data["count"] == 1


def test_a_colleague_sees_the_reading_someone_else_already_logged(
    api_client, staff_member, colleague, fridge
):
    api_client.force_authenticate(user=staff_member)
    api_client.post(
        reverse(STAFF_READINGS),
        {"fridge_unit": str(fridge.id), "routine": "OPENING", "celsius": "3.5"},
    )

    api_client.force_authenticate(user=colleague)
    response = api_client.get(reverse(STAFF_READINGS))

    assert response.data["count"] == 1
    assert response.data["results"][0]["recorded_by_name"] == "Alex"


def test_reading_defaults_to_todays_date(api_client, staff_member, fridge):
    api_client.force_authenticate(user=staff_member)

    response = api_client.post(
        reverse(STAFF_READINGS),
        {"fridge_unit": str(fridge.id), "routine": "OPENING", "celsius": "3.5"},
    )

    assert response.data["date"] == date.today().isoformat()


def test_a_reading_can_carry_an_optional_note(api_client, staff_member, fridge):
    api_client.force_authenticate(user=staff_member)

    response = api_client.post(
        reverse(STAFF_READINGS),
        {
            "fridge_unit": str(fridge.id),
            "routine": "OPENING",
            "celsius": "3.5",
            "note": "Door was left ajar overnight",
        },
    )

    assert response.status_code == 201, response.data
    assert response.data["note"] == "Door was left ajar overnight"


def test_a_reading_with_no_note_defaults_to_blank(api_client, staff_member, fridge):
    api_client.force_authenticate(user=staff_member)

    response = api_client.post(
        reverse(STAFF_READINGS),
        {"fridge_unit": str(fridge.id), "routine": "OPENING", "celsius": "3.5"},
    )

    assert response.data["note"] == ""


def test_history_can_be_filtered_to_a_date_range(api_client, staff_member, fridge):
    from apps.compliance.models import TemperatureReading

    TemperatureReading.objects.create(
        restaurant=fridge.restaurant,
        fridge_unit=fridge,
        routine="OPENING",
        date=date.today() - timedelta(days=10),
        celsius=Decimal("3.5"),
        recorded_by=staff_member,
    )
    TemperatureReading.objects.create(
        restaurant=fridge.restaurant,
        fridge_unit=fridge,
        routine="OPENING",
        date=date.today() - timedelta(days=2),
        celsius=Decimal("4.0"),
        recorded_by=staff_member,
    )
    api_client.force_authenticate(user=staff_member)

    response = api_client.get(
        reverse(STAFF_READINGS), {"date__gte": (date.today() - timedelta(days=7)).isoformat()}
    )

    assert response.data["count"] == 1
    assert response.data["results"][0]["celsius"] == "4.0"


def test_cannot_record_a_reading_for_another_restaurants_fridge(
    api_client, staff_member, other_restaurant
):
    outside_fridge = FridgeUnit.objects.create(
        restaurant=other_restaurant, name="Not yours", recommended_max_celsius=Decimal("5.0")
    )
    api_client.force_authenticate(user=staff_member)

    response = api_client.post(
        reverse(STAFF_READINGS),
        {"fridge_unit": str(outside_fridge.id), "routine": "OPENING", "celsius": "3.5"},
    )

    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Staff: completing a checklist item - shared, not per staff member
# ---------------------------------------------------------------------------


def test_staff_can_complete_a_checklist_item(api_client, staff_member, opening_item):
    api_client.force_authenticate(user=staff_member)

    response = api_client.post(reverse(STAFF_COMPLETIONS), {"checklist_item": str(opening_item.id)})

    assert response.status_code == 201, response.data
    assert response.data["completed_by_name"] == "Alex"


def test_a_colleague_completing_an_already_done_item_does_not_reassign_it(
    api_client, staff_member, colleague, opening_item
):
    api_client.force_authenticate(user=staff_member)
    api_client.post(reverse(STAFF_COMPLETIONS), {"checklist_item": str(opening_item.id)})

    api_client.force_authenticate(user=colleague)
    response = api_client.post(reverse(STAFF_COMPLETIONS), {"checklist_item": str(opening_item.id)})

    assert response.status_code == 201, response.data
    assert response.data["completed_by_name"] == "Alex"
    list_response = api_client.get(reverse(STAFF_COMPLETIONS))
    assert list_response.data["count"] == 1


def test_staff_can_uncheck_a_completed_item(api_client, staff_member, opening_item):
    api_client.force_authenticate(user=staff_member)
    created = api_client.post(
        reverse(STAFF_COMPLETIONS), {"checklist_item": str(opening_item.id)}
    ).data

    response = api_client.delete(
        reverse("v1:staff:compliance:checklist-completion-detail", kwargs={"pk": created["id"]})
    )

    assert response.status_code == 204
    list_response = api_client.get(reverse(STAFF_COMPLETIONS))
    assert list_response.data["count"] == 0


def test_a_note_can_be_added_to_an_already_completed_item_without_reassigning_it(
    api_client, staff_member, colleague, opening_item
):
    api_client.force_authenticate(user=staff_member)
    api_client.post(reverse(STAFF_COMPLETIONS), {"checklist_item": str(opening_item.id)})

    api_client.force_authenticate(user=colleague)
    response = api_client.post(
        reverse(STAFF_COMPLETIONS),
        {"checklist_item": str(opening_item.id), "note": "Fridge 2 was still warm, rechecked"},
    )

    assert response.status_code == 201, response.data
    assert response.data["note"] == "Fridge 2 was still warm, rechecked"
    # Still attributed to whoever completed it first.
    assert response.data["completed_by_name"] == "Alex"


def test_completions_only_count_for_the_day_they_were_made(api_client, staff_member, opening_item):
    """A completion from yesterday shouldn't make today's list look done -
    the uniqueness is per (item, date), not just per item."""
    from apps.compliance.models import ChecklistCompletion

    ChecklistCompletion.objects.create(
        restaurant=opening_item.restaurant,
        checklist_item=opening_item,
        date=date.today() - timedelta(days=1),
        completed_by=staff_member,
    )
    api_client.force_authenticate(user=staff_member)

    response = api_client.get(reverse(STAFF_COMPLETIONS), {"date": date.today().isoformat()})

    assert response.data["count"] == 0
