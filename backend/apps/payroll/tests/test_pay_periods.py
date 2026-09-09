"""The Friday-to-Thursday biweekly pay-period calendar and the rate-1/rate-2
hour split - see the module docstring on apps.payroll.services.pay_periods
for the worked example these tests lock in.
"""

from datetime import date
from decimal import Decimal

import pytest

from apps.attendance.models import AttendanceLog
from apps.common.roles import Role
from apps.payroll.models import PayPeriod, StaffPayRate
from apps.payroll.services.calculation import calculate_entry
from apps.payroll.services.pay_periods import (
    next_period_bounds,
    period_bounds_for,
    period_label,
)
from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "target,starts_on,ends_on",
    [
        (date(2026, 8, 21), date(2026, 8, 21), date(2026, 9, 3)),
        (date(2026, 8, 27), date(2026, 8, 21), date(2026, 9, 3)),  # mid-period
        (date(2026, 9, 3), date(2026, 8, 21), date(2026, 9, 3)),  # last day
        (date(2026, 9, 4), date(2026, 9, 4), date(2026, 9, 17)),
        (date(2026, 9, 18), date(2026, 9, 18), date(2026, 10, 1)),
        (date(2026, 10, 2), date(2026, 10, 2), date(2026, 10, 15)),
        (date(2026, 10, 16), date(2026, 10, 16), date(2026, 10, 29)),
        (date(2026, 10, 30), date(2026, 10, 30), date(2026, 11, 12)),
    ],
)
def test_period_bounds_for(target, starts_on, ends_on):
    assert period_bounds_for(target) == (starts_on, ends_on)


def test_next_period_bounds_chains_with_no_gap():
    starts_on, ends_on = next_period_bounds(after=date(2026, 9, 3))
    assert (starts_on, ends_on) == (date(2026, 9, 4), date(2026, 9, 17))


@pytest.mark.parametrize(
    "ends_on,label",
    [
        (date(2026, 9, 3), "Pay period 1 of September 2026"),
        (date(2026, 9, 17), "Pay period 2 of September 2026"),
        (date(2026, 10, 1), "Pay period 1 of October 2026"),
        (date(2026, 10, 15), "Pay period 2 of October 2026"),
        (date(2026, 10, 29), "Pay period 3 of October 2026"),
        (date(2026, 11, 12), "Pay period 1 of November 2026"),
    ],
)
def test_period_label(ends_on, label):
    """A period is named for the month its END date (payday) falls in, not
    its start - so the Sept 18 - Oct 1 period is "October 1", not
    "September 3", even though most of its days are in September."""
    assert period_label(ends_on=ends_on) == label


def test_period_label_rejects_a_date_that_is_not_a_period_end():
    with pytest.raises(ValueError):
        period_label(ends_on=date(2026, 9, 10))


# ---------------------------------------------------------------------------
# The rate-1/rate-2 split: first 40 hours of the period at rate 1, the rest
# at rate 2.
# ---------------------------------------------------------------------------
@pytest.fixture
def restaurant():
    return Restaurant.objects.create(name="The Test Kitchen", currency="GBP", is_approved=True)


@pytest.fixture
def staff_member(django_user_model, restaurant):
    return django_user_model.objects.create_user(
        email="staffer@example.com", password="x", role=Role.STAFF, restaurant=restaurant
    )


@pytest.fixture
def pay_period(restaurant):
    return PayPeriod.objects.create(
        restaurant=restaurant, starts_on=date(2026, 8, 21), ends_on=date(2026, 9, 3)
    )


def make_closed_log(staff, *, day, hours):
    from django.utils import timezone

    clock_in_at = timezone.make_aware(timezone.datetime(day.year, day.month, day.day, 9, 0))
    return AttendanceLog.objects.create(
        restaurant=staff.restaurant,
        staff=staff,
        clock_in_at=clock_in_at,
        clock_in_latitude=Decimal("51.5"),
        clock_in_longitude=Decimal("-0.1"),
        clock_out_at=clock_in_at + timezone.timedelta(hours=hours),
        clock_out_latitude=Decimal("51.5"),
        clock_out_longitude=Decimal("-0.1"),
        status=AttendanceLog.Status.CLOSED,
    )


def test_worked_85_hours_splits_40_at_rate_1_and_45_at_rate_2(pay_period, staff_member):
    StaffPayRate.objects.create(
        staff=staff_member, rate_1=Decimal("10.00"), rate_2=Decimal("15.00")
    )
    # 85 hours across the period, in a few closed logs.
    make_closed_log(staff_member, day=date(2026, 8, 21), hours=40)
    make_closed_log(staff_member, day=date(2026, 8, 26), hours=45)

    entry = calculate_entry(pay_period=pay_period, staff=staff_member)

    assert entry.hours_worked == Decimal("85.00")
    assert entry.hours_at_rate_1 == Decimal("40")
    assert entry.hours_at_rate_2 == Decimal("45.00")
    assert entry.total_pay == Decimal("40") * Decimal("10.00") + Decimal("45.00") * Decimal("15.00")


def test_worked_under_40_hours_is_entirely_rate_1(pay_period, staff_member):
    StaffPayRate.objects.create(
        staff=staff_member, rate_1=Decimal("10.00"), rate_2=Decimal("15.00")
    )
    make_closed_log(staff_member, day=date(2026, 8, 21), hours=12)

    entry = calculate_entry(pay_period=pay_period, staff=staff_member)

    assert entry.hours_at_rate_1 == Decimal("12.00")
    assert entry.hours_at_rate_2 == Decimal("0")


def test_recalculating_does_not_clobber_an_admins_manual_split(pay_period, staff_member):
    StaffPayRate.objects.create(
        staff=staff_member, rate_1=Decimal("10.00"), rate_2=Decimal("15.00")
    )
    make_closed_log(staff_member, day=date(2026, 8, 21), hours=50)

    entry = calculate_entry(pay_period=pay_period, staff=staff_member)
    entry.hours_at_rate_1 = Decimal("30")
    entry.hours_at_rate_2 = Decimal("20")
    entry.save()

    entry = calculate_entry(pay_period=pay_period, staff=staff_member)

    assert entry.hours_at_rate_1 == Decimal("30")
    assert entry.hours_at_rate_2 == Decimal("20")


# ---------------------------------------------------------------------------
# A period that isn't on a real Friday-to-Thursday boundary (still possible
# through the manual create endpoint) must not 500 a screen that just wants
# a label for it.
# ---------------------------------------------------------------------------
def test_admin_serializer_falls_back_for_a_period_off_the_real_calendar(restaurant):
    from apps.payroll.api.admin import AdminPayPeriodSerializer

    period = PayPeriod.objects.create(
        restaurant=restaurant, starts_on=date(2026, 8, 31), ends_on=date(2026, 9, 6)
    )

    data = AdminPayPeriodSerializer(period).data

    assert data["label"] == "Pay period 31 Aug - 06 Sep 2026"


def test_staff_summary_serializer_falls_back_for_a_period_off_the_real_calendar(
    restaurant, staff_member
):
    from apps.payroll.api.common import PayPeriodEntrySerializer

    period = PayPeriod.objects.create(
        restaurant=restaurant, starts_on=date(2026, 8, 31), ends_on=date(2026, 9, 6)
    )
    entry = calculate_entry(pay_period=period, staff=staff_member)

    data = PayPeriodEntrySerializer(entry).data

    assert data["pay_period_label"] == "Pay period 31 Aug - 06 Sep 2026"
