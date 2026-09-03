"""The rota: an admin creating shifts, with the job_title a staff member is
covering on that shift (Chef / Driver / Till operator - see Shift.JobTitle).

This app previously had no tests at all, so nothing here is a regression
guard for prior behaviour - it exists to cover job_title as it's added.
"""

import pytest
from django.urls import reverse

from apps.attendance.models import Shift
from apps.common.roles import Role
from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db

SHIFT_LIST = "v1:admin:attendance:shift-list"


@pytest.fixture
def restaurant():
    return Restaurant.objects.create(name="The Test Kitchen", currency="GBP", is_approved=True)


@pytest.fixture
def admin(django_user_model, restaurant):
    return django_user_model.objects.create_user(
        email="owner@example.com", password="x", role=Role.ADMIN, restaurant=restaurant
    )


@pytest.fixture
def staff_member(django_user_model, restaurant):
    return django_user_model.objects.create_user(
        email="staffer@example.com", password="x", role=Role.STAFF, restaurant=restaurant
    )


def test_an_admin_can_create_a_shift_with_a_job_title(api_client, admin, staff_member):
    api_client.force_authenticate(user=admin)

    response = api_client.post(
        reverse(SHIFT_LIST),
        {
            "staff": str(staff_member.id),
            "starts_at": "2026-09-08T09:00:00Z",
            "ends_at": "2026-09-08T17:00:00Z",
            "job_title": Shift.JobTitle.CHEF,
        },
    )

    assert response.status_code == 201, response.data
    assert response.data["job_title"] == Shift.JobTitle.CHEF


def test_job_title_defaults_to_blank_when_omitted(api_client, admin, staff_member):
    api_client.force_authenticate(user=admin)

    response = api_client.post(
        reverse(SHIFT_LIST),
        {
            "staff": str(staff_member.id),
            "starts_at": "2026-09-08T09:00:00Z",
            "ends_at": "2026-09-08T17:00:00Z",
        },
    )

    assert response.status_code == 201, response.data
    assert response.data["job_title"] == ""


def test_an_unknown_job_title_is_rejected(api_client, admin, staff_member):
    api_client.force_authenticate(user=admin)

    response = api_client.post(
        reverse(SHIFT_LIST),
        {
            "staff": str(staff_member.id),
            "starts_at": "2026-09-08T09:00:00Z",
            "ends_at": "2026-09-08T17:00:00Z",
            "job_title": "MANAGER",
        },
    )

    assert response.status_code == 400
    assert "job_title" in response.data


def test_a_staff_member_sees_the_job_title_on_their_own_rota(api_client, admin, staff_member):
    Shift.objects.create(
        restaurant=staff_member.restaurant,
        staff=staff_member,
        starts_at="2026-09-08T09:00:00Z",
        ends_at="2026-09-08T17:00:00Z",
        job_title=Shift.JobTitle.DRIVER,
        created_by=admin,
    )
    api_client.force_authenticate(user=staff_member)

    response = api_client.get(reverse("v1:staff:attendance:shift-list"))

    assert response.status_code == 200
    assert response.data["results"][0]["job_title"] == Shift.JobTitle.DRIVER
