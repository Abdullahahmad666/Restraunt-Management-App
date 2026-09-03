"""RestaurantAdmin's approval action - the only way a self-registered
takeaway (see RegisterSerializer) becomes usable. There is no REST endpoint
for this on purpose (see the Super Admin scoping decision), so it can only be
exercised through the ModelAdmin directly, the same way Django Admin itself
calls it.
"""

from unittest.mock import patch

import pytest
from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import RequestFactory

from apps.common.roles import Role
from apps.restaurants.admin import RestaurantAdmin
from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db

User = get_user_model()


@pytest.fixture
def super_admin(django_user_model):
    return django_user_model.objects.create_user(
        email="platform-owner@example.com",
        password="whatever-42",
        is_superuser=True,
        is_staff=True,
    )


@pytest.fixture
def pending_restaurant():
    return Restaurant.objects.create(name="New Takeaway")


@pytest.fixture
def admin_request(rf: RequestFactory, super_admin):
    request = rf.get("/admin/restaurants/restaurant/")
    request.user = super_admin
    # message_user() needs the messages framework, which normal middleware
    # attaches - patch it out rather than assemble that middleware by hand.
    with patch("django.contrib.messages.add_message"):
        yield request


@pytest.fixture
def restaurant_admin():
    return RestaurantAdmin(Restaurant, AdminSite())


def test_approving_sets_the_review_fields(
    restaurant_admin, admin_request, pending_restaurant, super_admin
):
    restaurant_admin.approve_takeaways(
        admin_request, Restaurant.objects.filter(id=pending_restaurant.id)
    )

    pending_restaurant.refresh_from_db()
    assert pending_restaurant.is_approved is True
    assert pending_restaurant.approved_by_id == super_admin.id
    assert pending_restaurant.approved_at is not None


def test_approving_emails_every_active_admin_on_that_restaurant(
    restaurant_admin, admin_request, pending_restaurant
):
    active_admin = User.objects.create_user(
        email="manager@example.com",
        password="x",
        role=Role.ADMIN,
        restaurant=pending_restaurant,
    )
    User.objects.create_user(
        email="ex-manager@example.com",
        password="x",
        role=Role.ADMIN,
        restaurant=pending_restaurant,
        is_active=False,
    )
    User.objects.create_user(
        email="staffer@example.com",
        password="x",
        role=Role.STAFF,
        restaurant=pending_restaurant,
    )

    restaurant_admin.approve_takeaways(
        admin_request, Restaurant.objects.filter(id=pending_restaurant.id)
    )

    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == [active_admin.email]
    assert pending_restaurant.name in mail.outbox[0].subject


def test_approving_a_restaurant_with_no_admin_sends_no_mail(
    restaurant_admin, admin_request, pending_restaurant
):
    """Should not happen in practice - self-registration always creates the
    admin in the same transaction - but must not crash if it ever does."""
    restaurant_admin.approve_takeaways(
        admin_request, Restaurant.objects.filter(id=pending_restaurant.id)
    )
    assert len(mail.outbox) == 0


def test_reapproving_an_already_approved_restaurant_does_nothing(
    restaurant_admin, admin_request, pending_restaurant, super_admin
):
    """Re-running the bulk action over a mixed selection must not clobber who
    really approved an already-approved restaurant, or re-notify its admin."""
    original_time = pending_restaurant.approved_at
    pending_restaurant.is_approved = True
    pending_restaurant.approved_by = super_admin
    pending_restaurant.save()

    restaurant_admin.approve_takeaways(
        admin_request, Restaurant.objects.filter(id=pending_restaurant.id)
    )

    pending_restaurant.refresh_from_db()
    assert pending_restaurant.approved_at == original_time
    assert len(mail.outbox) == 0


def test_approving_via_the_change_form_also_notifies(
    restaurant_admin, admin_request, pending_restaurant
):
    """The other path to approval: ticking the box on the restaurant's own
    edit page rather than the bulk list action - same notification either way."""
    User.objects.create_user(
        email="manager2@example.com",
        password="x",
        role=Role.ADMIN,
        restaurant=pending_restaurant,
    )

    pending_restaurant.is_approved = True

    class FakeForm:
        changed_data = ["is_approved"]

    restaurant_admin.save_model(admin_request, pending_restaurant, FakeForm(), change=True)

    pending_restaurant.refresh_from_db()
    assert pending_restaurant.approved_by_id == admin_request.user.id
    assert len(mail.outbox) == 1


def test_saving_unrelated_changes_does_not_send_an_approval_email(
    restaurant_admin, admin_request, pending_restaurant
):
    pending_restaurant.phone = "0123456789"

    class FakeForm:
        changed_data = ["phone"]

    restaurant_admin.save_model(admin_request, pending_restaurant, FakeForm(), change=True)

    assert len(mail.outbox) == 0
    assert pending_restaurant.is_approved is False
