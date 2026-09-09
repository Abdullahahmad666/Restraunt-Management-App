"""Shift-ending-soon reminders - the mirror of the existing
shift-starting-soon ones, on a separate guard field so a shift gets both
independently."""

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.attendance.models import Shift
from apps.common.roles import Role
from apps.notifications.models import Notification
from apps.notifications.services.rules import send_ending_shift_reminders
from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db


@pytest.fixture
def restaurant():
    return Restaurant.objects.create(name="The Test Kitchen", currency="GBP", is_approved=True)


@pytest.fixture
def staff_member(django_user_model, restaurant):
    return django_user_model.objects.create_user(
        email="staffer@example.com", password="x", role=Role.STAFF, restaurant=restaurant
    )


def test_notifies_a_staff_member_whose_shift_ends_in_15_minutes(restaurant, staff_member):
    now = timezone.now()
    shift = Shift.objects.create(
        restaurant=restaurant,
        staff=staff_member,
        starts_at=now - timedelta(hours=8),
        ends_at=now + timedelta(minutes=15),
    )

    sent = send_ending_shift_reminders(now=now)

    assert sent == 1
    notification = Notification.objects.get(user=staff_member)
    assert notification.kind == Notification.Kind.SHIFT_ENDING_SOON
    shift.refresh_from_db()
    assert shift.end_reminder_sent_at is not None


def test_does_not_send_twice_for_the_same_shift(restaurant, staff_member):
    now = timezone.now()
    Shift.objects.create(
        restaurant=restaurant,
        staff=staff_member,
        starts_at=now - timedelta(hours=8),
        ends_at=now + timedelta(minutes=15),
    )

    send_ending_shift_reminders(now=now)
    sent_again = send_ending_shift_reminders(now=now)

    assert sent_again == 0
    assert Notification.objects.filter(user=staff_member).count() == 1


def test_ignores_a_shift_ending_outside_the_window(restaurant, staff_member):
    now = timezone.now()
    Shift.objects.create(
        restaurant=restaurant,
        staff=staff_member,
        starts_at=now,
        ends_at=now + timedelta(hours=8),
    )

    sent = send_ending_shift_reminders(now=now)

    assert sent == 0
    assert not Notification.objects.filter(user=staff_member).exists()
