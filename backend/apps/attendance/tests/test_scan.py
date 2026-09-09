"""A manager hears about every check-in and check-out, as it happens - see
apps.notifications.services.rules.notify_admins_of_scan, wired into
apps.attendance.services.scan.scan().
"""

from decimal import Decimal

import pytest

from apps.attendance.models import VenueQRCode
from apps.attendance.services.scan import scan
from apps.common.roles import Role
from apps.notifications.models import Notification
from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db


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


@pytest.fixture
def qr_code(restaurant):
    return VenueQRCode.objects.create(
        restaurant=restaurant,
        latitude=Decimal("51.509865"),
        longitude=Decimal("-0.118092"),
        radius_meters=100,
    )


def test_checking_in_notifies_the_admin(admin, staff_member, qr_code):
    scan(staff=staff_member, token=qr_code.token, latitude=51.509865, longitude=-0.118092)

    notification = Notification.objects.get(user=admin)
    assert notification.kind == Notification.Kind.STAFF_CHECKED_IN
    assert staff_member.email in notification.body or staff_member.first_name in notification.title


def test_checking_out_notifies_the_admin(admin, staff_member, qr_code):
    from django.utils import timezone

    from apps.attendance.models import AttendanceLog

    # An open log old enough that the next scan is a check-out, not a no-op.
    AttendanceLog.objects.create(
        restaurant=staff_member.restaurant,
        staff=staff_member,
        clock_in_at=timezone.now() - timezone.timedelta(hours=1),
        clock_in_latitude=Decimal("51.509865"),
        clock_in_longitude=Decimal("-0.118092"),
    )
    Notification.objects.all().delete()

    scan(staff=staff_member, token=qr_code.token, latitude=51.509865, longitude=-0.118092)

    notification = Notification.objects.get(user=admin)
    assert notification.kind == Notification.Kind.STAFF_CHECKED_OUT


def test_a_no_op_rescan_does_not_notify_the_admin(admin, staff_member, qr_code):
    # First scan: checks in.
    scan(staff=staff_member, token=qr_code.token, latitude=51.509865, longitude=-0.118092)
    Notification.objects.all().delete()

    # Immediately again: too soon to be a check-out, so nothing changes.
    scan(staff=staff_member, token=qr_code.token, latitude=51.509865, longitude=-0.118092)

    assert not Notification.objects.filter(user=admin).exists()


def test_only_admins_of_the_same_restaurant_are_notified(staff_member, qr_code):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    other_restaurant = Restaurant.objects.create(
        name="Somewhere Else", currency="GBP", is_approved=True
    )
    other_admin = User.objects.create_user(
        email="other-owner@example.com", password="x", role=Role.ADMIN, restaurant=other_restaurant
    )

    scan(staff=staff_member, token=qr_code.token, latitude=51.509865, longitude=-0.118092)

    assert not Notification.objects.filter(user=other_admin).exists()
