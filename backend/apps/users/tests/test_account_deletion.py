"""Deleting your own account - Apple's guideline 5.1.1(v).

The thing worth testing here is not that the endpoint returns 204. It is that
the two paths through it both leave the person genuinely unable to sign in and
genuinely unnamed, while the records their employer is legally obliged to keep
survive. Those two requirements pull against each other, and the tests are
written to catch the version of this feature that satisfies one by quietly
breaking the other.

So: that a scrubbed account cannot be logged back into, that its email cannot
be used to reset a password, that nothing on any screen still says its name,
and - separately - that the hours it worked are still there to be paid on.
"""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.attendance.models import AttendanceLog, Shift
from apps.common.roles import Role
from apps.notifications.models import Notification
from apps.payroll.models import PayPeriod, PayrollEntry, StaffPayRate
from apps.restaurants.models import Restaurant
from apps.users.services import deletion

pytestmark = pytest.mark.django_db

User = get_user_model()

DELETE = "v1:users:delete-account"
LOGIN = "v1:users:login"
RESET = "v1:users:password-reset"
PASSWORD = "a-perfectly-fine-password-42"


@pytest.fixture
def restaurant():
    return Restaurant.objects.create(name="The Test Kitchen", currency="GBP", is_approved=True)


@pytest.fixture
def client():
    return APIClient()


def make_user(restaurant, role=Role.STAFF, email="someone@example.com", **kwargs):
    return User.objects.create_user(
        email=email,
        password=PASSWORD,
        restaurant=restaurant,
        role=role,
        is_email_verified=True,
        **kwargs,
    )


@pytest.fixture
def staff(restaurant):
    return make_user(restaurant, email="priya@example.com", first_name="Priya", last_name="Shah")


@pytest.fixture
def admin(restaurant):
    return make_user(restaurant, role=Role.ADMIN, email="boss@example.com", first_name="Sam")


def give_history(user):
    """Make this account one the law says something about.

    A past shift, a closed attendance log against it, a pay rate and a payroll
    entry - the four PROTECT'd relations, so that anything claiming to "delete"
    this user has to deal with all of them.
    """
    started = timezone.now() - timedelta(days=9)
    shift = Shift.objects.create(
        restaurant=user.restaurant,
        staff=user,
        starts_at=started,
        ends_at=started + timedelta(hours=8),
    )
    AttendanceLog.objects.create(
        restaurant=user.restaurant,
        staff=user,
        shift=shift,
        clock_in_at=started,
        clock_in_latitude=Decimal("51.5"),
        clock_in_longitude=Decimal("-0.1"),
        clock_out_at=started + timedelta(hours=8),
        clock_out_latitude=Decimal("51.5"),
        clock_out_longitude=Decimal("-0.1"),
        status=AttendanceLog.Status.CLOSED,
    )
    StaffPayRate.objects.create(staff=user, rate_1=Decimal("12.50"), rate_2=Decimal("11.00"))
    # get_or_create, not create: a pay period's span is unique per restaurant,
    # and two colleagues leaving are two entries in the same period.
    period, _ = PayPeriod.objects.get_or_create(
        restaurant=user.restaurant,
        starts_on=(timezone.now() - timedelta(days=14)).date(),
        ends_on=timezone.now().date(),
    )
    PayrollEntry.objects.create(
        pay_period=period,
        staff=user,
        hours_worked=Decimal("8"),
        hours_at_rate_1=Decimal("8"),
        rate_1_snapshot=Decimal("12.50"),
        total_pay=Decimal("100"),
    )
    return shift


# ---------------------------------------------------------------------------
# The premise these two paths exist for
# ---------------------------------------------------------------------------


def test_a_user_with_history_cannot_simply_be_deleted(staff):
    """The reason this feature is not a one-line `user.delete()`.

    If this test ever fails, somebody has loosened a PROTECT and the
    scrub-and-retain path is no longer protecting anything - at which point
    deleting an account would take the restaurant's payroll with it.
    """
    from django.db.models import ProtectedError

    give_history(staff)
    with pytest.raises(ProtectedError):
        staff.delete()


def test_retained_records_are_detected(restaurant, staff):
    assert deletion.has_retained_records(staff) is False
    give_history(staff)
    assert deletion.has_retained_records(staff) is True


def test_every_protected_relation_is_listed(staff):
    """RETAINED_RELATIONS must stay in step with the schema.

    A fifth PROTECT'd relation added to the user and not added to that list
    would make `plan_for` promise a hard delete that then raises. Caught here
    rather than in production.
    """
    protected = {
        rel.get_accessor_name()
        for rel in User._meta.related_objects
        if getattr(getattr(rel, "on_delete", None), "__name__", "") == "PROTECT"
    }
    listed = set(deletion.RETAINED_RELATIONS) | {"pay_rate"}
    assert protected == listed, f"schema has {protected}, service checks {listed}"


# ---------------------------------------------------------------------------
# Path one: nothing retained, so the row really goes
# ---------------------------------------------------------------------------


def test_fresh_account_is_hard_deleted(client, staff):
    client.force_authenticate(user=staff)
    response = client.post(reverse(DELETE), {"password": PASSWORD}, format="json")

    assert response.status_code == 204
    assert not User.objects.filter(pk=staff.pk).exists()


# ---------------------------------------------------------------------------
# Path two: records retained, identity destroyed
# ---------------------------------------------------------------------------


def test_account_with_history_is_scrubbed_not_removed(client, staff):
    give_history(staff)
    client.force_authenticate(user=staff)

    response = client.post(reverse(DELETE), {"password": PASSWORD}, format="json")
    assert response.status_code == 204

    staff.refresh_from_db()
    assert staff.is_deleted
    assert staff.is_active is False
    assert staff.first_name == ""
    assert staff.last_name == ""
    assert staff.phone == ""
    assert "priya" not in staff.email.lower()
    assert staff.email.endswith("@invisiko.invalid")


def test_a_scrubbed_account_cannot_sign_back_in(client, staff):
    give_history(staff)
    client.force_authenticate(user=staff)
    client.post(reverse(DELETE), {"password": PASSWORD}, format="json")

    fresh = APIClient()
    response = fresh.post(
        reverse(LOGIN),
        {"email": "priya@example.com", "password": PASSWORD},
        format="json",
    )
    assert response.status_code == 401


def test_a_scrubbed_account_cannot_be_recovered_by_password_reset(client, staff):
    """The old address must not be a way back in.

    A reset that silently succeeded would hand the account back to whoever
    still controls that mailbox, which is the opposite of deleted.
    """
    give_history(staff)
    client.force_authenticate(user=staff)
    client.post(reverse(DELETE), {"password": PASSWORD}, format="json")

    fresh = APIClient()
    fresh.post(reverse(RESET), {"email": "priya@example.com"}, format="json")

    staff.refresh_from_db()
    assert not staff.has_usable_password()
    assert staff.is_active is False


def test_the_hours_survive_the_account(client, staff):
    """What the whole scrub-instead-of-delete arrangement is for."""
    give_history(staff)
    client.force_authenticate(user=staff)
    client.post(reverse(DELETE), {"password": PASSWORD}, format="json")

    assert AttendanceLog.objects.filter(staff_id=staff.pk).count() == 1
    assert PayrollEntry.objects.filter(staff_id=staff.pk).count() == 1
    assert StaffPayRate.objects.filter(staff_id=staff.pk).exists()


def test_a_retained_record_keeps_the_name_that_attributes_it(client, staff):
    """One override, every serializer.

    Ten of them render `get_full_name() or email`. If this returned the
    scrubbed placeholder instead, a screen would show
    "deleted-ab12...@invisiko.invalid" where a colleague's name used to be.

    The name stays because the record does. An employer holding three years of
    payroll has to be able to say whose it was, and HMRC requires the employee
    on a retained record to be identifiable.
    """
    give_history(staff)
    client.force_authenticate(user=staff)
    client.post(reverse(DELETE), {"password": PASSWORD}, format="json")

    staff.refresh_from_db()
    assert staff.retained_name == "Priya Shah"
    assert staff.get_full_name() == "Priya Shah (former)"
    # The record is named; the account is still destroyed.
    assert "invalid" not in staff.get_full_name()
    assert staff.first_name == ""
    assert staff.phone == ""
    assert not staff.has_usable_password()


def test_two_leavers_can_be_told_apart(client, restaurant):
    """The reason the name is kept at all.

    Two people leave, and the manager is left reconciling two closed pay
    periods. "Former team member" twice is two rows nobody can attribute,
    which is no use to them and no use to HMRC.
    """
    one = make_user(restaurant, email="priya@example.com", first_name="Priya", last_name="Shah")
    two = make_user(restaurant, email="marek@example.com", first_name="Marek", last_name="Kowal")
    give_history(one)
    give_history(two)

    for person in (one, two):
        fresh = APIClient()
        fresh.force_authenticate(user=person)
        assert fresh.post(reverse(DELETE), {"password": PASSWORD}, format="json").status_code == 204

    one.refresh_from_db()
    two.refresh_from_db()
    assert one.get_full_name() != two.get_full_name()
    assert one.get_full_name() == "Priya Shah (former)"
    assert two.get_full_name() == "Marek Kowal (former)"


def test_someone_who_never_gave_a_name_is_still_distinguishable(client, restaurant):
    """A blank name must not collapse two records into one label.

    Nobody typed a name in, so there is none to keep - but the records still
    have to be told apart, and the id's first block does that.
    """
    one = make_user(restaurant, email="a@example.com")
    two = make_user(restaurant, email="b@example.com")
    give_history(one)
    give_history(two)

    for person in (one, two):
        fresh = APIClient()
        fresh.force_authenticate(user=person)
        fresh.post(reverse(DELETE), {"password": PASSWORD}, format="json")

    one.refresh_from_db()
    two.refresh_from_db()
    assert one.retained_name == ""
    assert one.get_full_name().startswith("Former team member (")
    assert one.get_full_name() != two.get_full_name()


def test_a_hard_deleted_account_keeps_nothing_at_all(client, staff):
    """No record to attribute means no name to keep."""
    client.force_authenticate(user=staff)
    client.post(reverse(DELETE), {"password": PASSWORD}, format="json")

    assert not User.objects.filter(pk=staff.pk).exists()
    assert not User.objects.filter(retained_name="Priya Shah").exists()


def test_future_shifts_go_but_past_ones_stay(client, staff):
    """A deleted person must not be on next week's rota."""
    past = give_history(staff)
    upcoming = Shift.objects.create(
        restaurant=staff.restaurant,
        staff=staff,
        starts_at=timezone.now() + timedelta(days=3),
        ends_at=timezone.now() + timedelta(days=3, hours=6),
    )

    client.force_authenticate(user=staff)
    client.post(reverse(DELETE), {"password": PASSWORD}, format="json")

    assert not Shift.objects.filter(pk=upcoming.pk).exists()
    assert Shift.objects.filter(pk=past.pk).exists()


def test_push_tokens_and_notifications_go(client, staff):
    from apps.notifications.models import DeviceToken

    DeviceToken.objects.create(user=staff, token="ExponentPushToken[xxx]", platform="ios")
    Notification.objects.create(
        user=staff,
        kind=Notification.Kind.SHIFT_ADDED,
        title="Shift added",
        body="You are on Friday.",
    )
    give_history(staff)

    client.force_authenticate(user=staff)
    client.post(reverse(DELETE), {"password": PASSWORD}, format="json")

    assert not DeviceToken.objects.filter(user_id=staff.pk).exists()
    assert not Notification.objects.filter(user_id=staff.pk).exists()


# ---------------------------------------------------------------------------
# Confirmation
# ---------------------------------------------------------------------------


def test_the_wrong_password_deletes_nothing(client, staff):
    client.force_authenticate(user=staff)
    response = client.post(reverse(DELETE), {"password": "not-it"}, format="json")

    assert response.status_code == 400
    assert User.objects.filter(pk=staff.pk).exists()


def test_a_password_is_required(client, staff):
    """An unlocked phone on a kitchen counter should not be able to do this."""
    client.force_authenticate(user=staff)
    response = client.post(reverse(DELETE), {}, format="json")

    assert response.status_code == 400
    assert "password" in response.data
    assert User.objects.filter(pk=staff.pk).exists()


def test_deletion_needs_a_signed_in_caller(client):
    assert client.post(reverse(DELETE), {"password": PASSWORD}, format="json").status_code == 401


# ---------------------------------------------------------------------------
# The admin case
# ---------------------------------------------------------------------------


def test_an_admin_with_a_colleague_deletes_only_themselves(client, restaurant, admin, staff):
    make_user(restaurant, role=Role.ADMIN, email="other.boss@example.com")

    client.force_authenticate(user=admin)
    response = client.post(reverse(DELETE), {"password": PASSWORD}, format="json")

    assert response.status_code == 204
    assert Restaurant.objects.filter(pk=restaurant.pk).exists()
    assert User.objects.filter(pk=staff.pk).exists()


def test_the_last_admin_must_type_the_restaurant_name(client, restaurant, admin, staff):
    client.force_authenticate(user=admin)
    response = client.post(reverse(DELETE), {"password": PASSWORD}, format="json")

    assert response.status_code == 400
    assert "restaurant_name" in response.data
    assert Restaurant.objects.filter(pk=restaurant.pk).exists()
    assert User.objects.filter(pk=staff.pk).exists()


def test_a_mistyped_restaurant_name_deletes_nothing(client, restaurant, admin):
    client.force_authenticate(user=admin)
    response = client.post(
        reverse(DELETE),
        {"password": PASSWORD, "restaurant_name": "The Test Kitchin"},
        format="json",
    )

    assert response.status_code == 400
    assert Restaurant.objects.filter(pk=restaurant.pk).exists()


def test_the_last_admin_takes_the_restaurant_with_them(client, restaurant, admin, staff):
    """The decision this feature turns on, with history in the way of it.

    The staff member has attendance, a pay rate and a payroll entry, all
    PROTECT'd - so a naive `restaurant.delete()` raises here, and this test is
    what proves the ordered teardown actually works rather than only looking
    like it should.
    """
    give_history(staff)
    restaurant_pk = restaurant.pk
    staff_pk = staff.pk

    client.force_authenticate(user=admin)
    response = client.post(
        reverse(DELETE),
        {"password": PASSWORD, "restaurant_name": "The Test Kitchen"},
        format="json",
    )

    assert response.status_code == 204
    assert not Restaurant.objects.filter(pk=restaurant_pk).exists()
    assert not User.objects.filter(pk=staff_pk).exists()
    assert not User.objects.filter(pk=admin.pk).exists()
    assert not AttendanceLog.objects.filter(staff_id=staff_pk).exists()
    assert not PayrollEntry.objects.filter(staff_id=staff_pk).exists()


def test_the_name_check_forgives_case_and_space(client, restaurant, admin):
    client.force_authenticate(user=admin)
    response = client.post(
        reverse(DELETE),
        {"password": PASSWORD, "restaurant_name": "  the test kitchen "},
        format="json",
    )
    assert response.status_code == 204
    assert not Restaurant.objects.filter(pk=restaurant.pk).exists()


def test_a_deactivated_admin_does_not_count_as_cover(client, restaurant, admin):
    """A switched-off manager cannot run a pay period, so leaving a restaurant
    with nothing but those is the same as leaving it with none."""
    make_user(restaurant, role=Role.ADMIN, email="gone@example.com", is_active=False)

    client.force_authenticate(user=admin)
    plan = deletion.plan_for(admin)
    assert plan.deletes_restaurant is True


# ---------------------------------------------------------------------------
# The preview the confirmation screen is built from
# ---------------------------------------------------------------------------


def test_the_preview_describes_a_plain_deletion(client, restaurant, staff):
    make_user(restaurant, role=Role.ADMIN, email="boss2@example.com")
    client.force_authenticate(user=staff)

    body = client.get(reverse(DELETE)).data
    assert body["deletes_restaurant"] is False
    assert body["requires_name_confirmation"] is False
    assert body["restaurant_name"] is None


def test_the_preview_counts_what_a_teardown_would_take(client, restaurant, admin, staff):
    give_history(staff)
    client.force_authenticate(user=admin)

    body = client.get(reverse(DELETE)).data
    assert body["deletes_restaurant"] is True
    assert body["requires_name_confirmation"] is True
    assert body["restaurant_name"] == "The Test Kitchen"
    assert body["staff_accounts"] == 1
    assert body["attendance_records"] == 1


# ---------------------------------------------------------------------------
# What the manager is told
# ---------------------------------------------------------------------------


def test_the_manager_is_told_who_deleted_their_account(client, restaurant, admin, staff):
    """Named, because the records it points at are named.

    Refusing to say which of four people had gone would withhold something
    the manager can read off the rota anyway.
    """
    give_history(staff)
    client.force_authenticate(user=staff)
    client.post(reverse(DELETE), {"password": PASSWORD}, format="json")

    notes = Notification.objects.filter(user=admin, kind=Notification.Kind.ACCOUNT_DELETED)
    assert notes.count() == 1
    note = notes.get()
    assert "Priya Shah" in note.title
    assert "team member" in note.body
    # The name is a record attribution. The login identity is not, and must
    # not travel into a notification row.
    assert "priya@example.com" not in note.title + note.body
    assert "invisiko.invalid" not in note.title + note.body


def test_nobody_is_notified_when_the_restaurant_went_too(client, restaurant, admin):
    client.force_authenticate(user=admin)
    client.post(
        reverse(DELETE),
        {"password": PASSWORD, "restaurant_name": "The Test Kitchen"},
        format="json",
    )
    assert not Notification.objects.filter(kind=Notification.Kind.ACCOUNT_DELETED).exists()


def test_the_notification_matches_the_label_on_the_records(client, restaurant, admin):
    """A manager has to be able to tie the push to the payroll row.

    Somebody who never typed a name shows as "Former team member (abcd1234)"
    on their retained entry, so the notification has to say the same thing. It
    said "Someone" at first, which left the two unconnectable.
    """
    nameless = make_user(restaurant, email="nameless@example.com")
    give_history(nameless)

    client.force_authenticate(user=nameless)
    client.post(reverse(DELETE), {"password": PASSWORD}, format="json")

    nameless.refresh_from_db()
    note = Notification.objects.get(user=admin, kind=Notification.Kind.ACCOUNT_DELETED)
    assert nameless.get_full_name() in note.title
    assert "Someone" not in note.title
