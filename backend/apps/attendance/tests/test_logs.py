"""A staff member's own attendance log: reading it, filtering it, and
adding their own note to it."""

import pytest
from django.urls import reverse

from apps.attendance.models import AttendanceLog
from apps.common.roles import Role
from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db

STAFF_LOG_LIST = "v1:staff:attendance:attendance-log-list"


@pytest.fixture
def restaurant():
    return Restaurant.objects.create(name="The Test Kitchen", currency="GBP", is_approved=True)


@pytest.fixture
def staff_member(django_user_model, restaurant):
    return django_user_model.objects.create_user(
        email="staffer@example.com", password="x", role=Role.STAFF, restaurant=restaurant
    )


@pytest.fixture
def other_staff_member(django_user_model, restaurant):
    return django_user_model.objects.create_user(
        email="colleague@example.com", password="x", role=Role.STAFF, restaurant=restaurant
    )


def make_log(staff, *, status=AttendanceLog.Status.OPEN, **kwargs):
    return AttendanceLog.objects.create(
        restaurant=staff.restaurant,
        staff=staff,
        clock_in_at="2026-09-08T09:00:00Z",
        clock_in_latitude="51.5",
        clock_in_longitude="-0.1",
        status=status,
        **kwargs,
    )


def test_a_staff_member_can_add_a_note_to_their_own_log(api_client, staff_member):
    log = make_log(staff_member)
    api_client.force_authenticate(user=staff_member)

    response = api_client.patch(
        reverse("v1:staff:attendance:attendance-log-detail", kwargs={"pk": log.id}),
        {"note": "Car trouble, 10 min late"},
    )

    assert response.status_code == 200, response.data
    log.refresh_from_db()
    assert log.note == "Car trouble, 10 min late"


def test_a_staff_member_cannot_edit_someone_elses_log(api_client, staff_member, other_staff_member):
    log = make_log(other_staff_member)
    api_client.force_authenticate(user=staff_member)

    response = api_client.patch(
        reverse("v1:staff:attendance:attendance-log-detail", kwargs={"pk": log.id}),
        {"note": "not mine to edit"},
    )

    assert response.status_code == 404
    log.refresh_from_db()
    assert log.note == ""


def test_a_staff_member_cannot_rewrite_their_own_clock_in_time(api_client, staff_member):
    """Only note is theirs to write - the recorded scan data is not."""
    log = make_log(staff_member)
    api_client.force_authenticate(user=staff_member)

    response = api_client.patch(
        reverse("v1:staff:attendance:attendance-log-detail", kwargs={"pk": log.id}),
        {"note": "fine", "status": AttendanceLog.Status.CLOSED},
    )

    assert response.status_code == 200, response.data
    log.refresh_from_db()
    assert log.status == AttendanceLog.Status.OPEN


def test_a_staff_member_can_filter_their_own_logs_by_status(api_client, staff_member):
    make_log(staff_member, status=AttendanceLog.Status.OPEN)
    make_log(staff_member, status=AttendanceLog.Status.CLOSED, clock_out_at="2026-09-08T17:00:00Z")
    api_client.force_authenticate(user=staff_member)

    response = api_client.get(reverse(STAFF_LOG_LIST), {"status": AttendanceLog.Status.CLOSED})

    assert response.status_code == 200
    assert len(response.data["results"]) == 1
    assert response.data["results"][0]["status"] == AttendanceLog.Status.CLOSED
