"""Shift swap requests: a staff member offering one of their own upcoming
shifts to a colleague, and a manager approving or declining it."""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.attendance.models import Shift, ShiftSwapRequest
from apps.attendance.services import swap as swap_service
from apps.common.roles import Role
from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db

STAFF_LIST = "v1:staff:attendance:shift-swap-request-list"
STAFF_CANCEL = "v1:staff:attendance:shift-swap-request-cancel"
STAFF_COLLEAGUES = "v1:staff:attendance:colleague-list"
ADMIN_LIST = "v1:admin:attendance:shift-swap-request-list"
ADMIN_APPROVE = "v1:admin:attendance:shift-swap-request-approve"
ADMIN_DECLINE = "v1:admin:attendance:shift-swap-request-decline"


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
def requester(django_user_model, restaurant):
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
def shift(restaurant, requester):
    starts = timezone.now() + timedelta(days=3)
    return Shift.objects.create(
        restaurant=restaurant,
        staff=requester,
        starts_at=starts,
        ends_at=starts + timedelta(hours=8),
    )


def test_staff_can_request_a_swap_for_their_own_shift(api_client, requester, colleague, shift):
    api_client.force_authenticate(user=requester)

    response = api_client.post(
        reverse(STAFF_LIST),
        {"shift": str(shift.id), "target_staff": str(colleague.id), "note": "Doctor's appointment"},
    )

    assert response.status_code == 201, response.data
    assert response.data["status"] == ShiftSwapRequest.Status.PENDING
    assert response.data["target_staff_name"] == "Sam"


def test_staff_cannot_request_a_swap_for_someone_elses_shift(
    api_client, requester, colleague, restaurant, django_user_model
):
    someone_else = django_user_model.objects.create_user(
        email="jo@example.com", password="x", role=Role.STAFF, restaurant=restaurant
    )
    starts = timezone.now() + timedelta(days=3)
    someone_elses_shift = Shift.objects.create(
        restaurant=restaurant,
        staff=someone_else,
        starts_at=starts,
        ends_at=starts + timedelta(hours=8),
    )
    api_client.force_authenticate(user=requester)

    response = api_client.post(
        reverse(STAFF_LIST),
        {"shift": str(someone_elses_shift.id), "target_staff": str(colleague.id)},
    )

    assert response.status_code == 403


def test_cannot_offer_a_shift_to_someone_in_a_different_restaurant(
    api_client, requester, shift, other_restaurant, django_user_model
):
    outsider = django_user_model.objects.create_user(
        email="outsider@example.com", password="x", role=Role.STAFF, restaurant=other_restaurant
    )
    api_client.force_authenticate(user=requester)

    response = api_client.post(
        reverse(STAFF_LIST), {"shift": str(shift.id), "target_staff": str(outsider.id)}
    )

    assert response.status_code == 400


def test_cannot_request_a_swap_for_a_shift_that_already_started(
    api_client, requester, colleague, restaurant
):
    starts = timezone.now() - timedelta(hours=1)
    past_shift = Shift.objects.create(
        restaurant=restaurant,
        staff=requester,
        starts_at=starts,
        ends_at=starts + timedelta(hours=8),
    )
    api_client.force_authenticate(user=requester)

    response = api_client.post(
        reverse(STAFF_LIST), {"shift": str(past_shift.id), "target_staff": str(colleague.id)}
    )

    assert response.status_code == 400


def test_cannot_offer_a_shift_to_someone_already_working_that_time(
    api_client, requester, colleague, shift
):
    Shift.objects.create(
        restaurant=shift.restaurant,
        staff=colleague,
        starts_at=shift.starts_at,
        ends_at=shift.ends_at,
    )
    api_client.force_authenticate(user=requester)

    response = api_client.post(
        reverse(STAFF_LIST), {"shift": str(shift.id), "target_staff": str(colleague.id)}
    )

    assert response.status_code == 400


def test_a_shift_cannot_have_two_pending_swap_requests(
    api_client, requester, colleague, shift, restaurant, django_user_model
):
    swap_service.request_swap(requester=requester, shift=shift, target_staff=colleague)
    third_staffer = django_user_model.objects.create_user(
        email="third@example.com", password="x", role=Role.STAFF, restaurant=restaurant
    )
    api_client.force_authenticate(user=requester)

    response = api_client.post(
        reverse(STAFF_LIST), {"shift": str(shift.id), "target_staff": str(third_staffer.id)}
    )

    assert response.status_code == 400


def test_the_colleague_being_asked_can_see_the_request(api_client, requester, colleague, shift):
    swap_request = swap_service.request_swap(
        requester=requester, shift=shift, target_staff=colleague
    )
    api_client.force_authenticate(user=colleague)

    response = api_client.get(reverse(STAFF_LIST))

    assert response.status_code == 200
    assert [r["id"] for r in response.data["results"]] == [str(swap_request.id)]


def test_a_bystander_cannot_see_someone_elses_swap_request(
    api_client, requester, colleague, shift, restaurant, django_user_model
):
    swap_service.request_swap(requester=requester, shift=shift, target_staff=colleague)
    bystander = django_user_model.objects.create_user(
        email="bystander@example.com", password="x", role=Role.STAFF, restaurant=restaurant
    )
    api_client.force_authenticate(user=bystander)

    response = api_client.get(reverse(STAFF_LIST))

    assert response.status_code == 200
    assert response.data["results"] == []


def test_requester_can_cancel_their_own_pending_request(api_client, requester, colleague, shift):
    swap_request = swap_service.request_swap(
        requester=requester, shift=shift, target_staff=colleague
    )
    api_client.force_authenticate(user=requester)

    response = api_client.post(reverse(STAFF_CANCEL, kwargs={"pk": swap_request.id}))

    assert response.status_code == 200
    assert response.data["status"] == ShiftSwapRequest.Status.CANCELLED


def test_the_target_cannot_cancel_someone_elses_request(api_client, requester, colleague, shift):
    swap_request = swap_service.request_swap(
        requester=requester, shift=shift, target_staff=colleague
    )
    api_client.force_authenticate(user=colleague)

    response = api_client.post(reverse(STAFF_CANCEL, kwargs={"pk": swap_request.id}))

    assert response.status_code == 403


def test_colleagues_list_excludes_self_and_inactive_staff(
    api_client, requester, colleague, restaurant, django_user_model
):
    inactive = django_user_model.objects.create_user(
        email="gone@example.com",
        password="x",
        role=Role.STAFF,
        restaurant=restaurant,
        is_active=False,
    )
    api_client.force_authenticate(user=requester)

    response = api_client.get(reverse(STAFF_COLLEAGUES))

    ids = {row["id"] for row in response.data["results"]}
    assert str(colleague.id) in ids
    assert str(requester.id) not in ids
    assert str(inactive.id) not in ids


def test_admin_approving_a_swap_reassigns_the_shift(api_client, admin, requester, colleague, shift):
    swap_request = swap_service.request_swap(
        requester=requester, shift=shift, target_staff=colleague
    )
    api_client.force_authenticate(user=admin)

    response = api_client.post(reverse(ADMIN_APPROVE, kwargs={"pk": swap_request.id}))

    assert response.status_code == 200
    assert response.data["status"] == ShiftSwapRequest.Status.APPROVED
    shift.refresh_from_db()
    assert shift.staff_id == colleague.id


def test_admin_declining_a_swap_leaves_the_shift_untouched(
    api_client, admin, requester, colleague, shift
):
    swap_request = swap_service.request_swap(
        requester=requester, shift=shift, target_staff=colleague
    )
    api_client.force_authenticate(user=admin)

    response = api_client.post(
        reverse(ADMIN_DECLINE, kwargs={"pk": swap_request.id}), {"decision_note": "Short-staffed"}
    )

    assert response.status_code == 200
    assert response.data["status"] == ShiftSwapRequest.Status.DECLINED
    shift.refresh_from_db()
    assert shift.staff_id == requester.id


def test_a_decided_swap_cannot_be_decided_again(api_client, admin, requester, colleague, shift):
    swap_request = swap_service.request_swap(
        requester=requester, shift=shift, target_staff=colleague
    )
    swap_service.decide_swap(swap_request=swap_request, approve=True, decided_by=admin)
    api_client.force_authenticate(user=admin)

    response = api_client.post(reverse(ADMIN_DECLINE, kwargs={"pk": swap_request.id}))

    assert response.status_code == 400


def test_admin_cannot_create_a_swap_request_directly(
    api_client, admin, requester, colleague, shift
):
    api_client.force_authenticate(user=admin)

    response = api_client.post(
        reverse(ADMIN_LIST), {"shift": str(shift.id), "target_staff": str(colleague.id)}
    )

    assert response.status_code == 405


def test_admin_list_is_scoped_to_their_own_restaurant(
    api_client, admin, requester, colleague, shift, other_restaurant, django_user_model
):
    swap_service.request_swap(requester=requester, shift=shift, target_staff=colleague)
    other_admin = django_user_model.objects.create_user(
        email="other-owner@example.com", password="x", role=Role.ADMIN, restaurant=other_restaurant
    )
    api_client.force_authenticate(user=other_admin)

    response = api_client.get(reverse(ADMIN_LIST))

    assert response.status_code == 200
    assert response.data["results"] == []
