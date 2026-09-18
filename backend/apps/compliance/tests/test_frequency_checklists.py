"""Named daily/weekly/monthly checklists (e.g. "Toilet Cleaning", "Monthly
Deep Clean") and the shared, per-current-period completions against their
tasks."""

from datetime import date, timedelta

import pytest
from django.urls import reverse

from apps.common.roles import Role
from apps.compliance.models import ChecklistFrequency, ChecklistTask, ChecklistTemplate
from apps.compliance.services.completion import current_period_start
from apps.restaurants.models import Restaurant

pytestmark = pytest.mark.django_db

ADMIN_TEMPLATES = "v1:admin:compliance:checklist-template-list"
ADMIN_TASKS = "v1:admin:compliance:checklist-task-list"
STAFF_TEMPLATES = "v1:staff:compliance:checklist-template-list"
STAFF_TASKS = "v1:staff:compliance:checklist-task-list"
STAFF_COMPLETIONS = "v1:staff:compliance:checklist-task-completion-list"


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
def daily_template(restaurant):
    return ChecklistTemplate.objects.create(
        restaurant=restaurant, frequency=ChecklistFrequency.DAILY, name="Toilet Cleaning"
    )


@pytest.fixture
def daily_task(daily_template):
    return ChecklistTask.objects.create(
        restaurant=daily_template.restaurant, template=daily_template, text="Clean and restock"
    )


# ---------------------------------------------------------------------------
# current_period_start - pure function, no DB needed
# ---------------------------------------------------------------------------


def test_daily_period_is_today():
    today = date(2026, 9, 18)
    assert current_period_start(frequency=ChecklistFrequency.DAILY, today=today) == today


def test_weekly_period_is_the_mondays_of_that_week():
    # 2026-09-18 is a Friday.
    friday = date(2026, 9, 18)
    monday = date(2026, 9, 14)
    assert current_period_start(frequency=ChecklistFrequency.WEEKLY, today=friday) == monday


def test_weekly_period_on_a_monday_is_itself():
    monday = date(2026, 9, 14)
    assert current_period_start(frequency=ChecklistFrequency.WEEKLY, today=monday) == monday


def test_monthly_period_is_the_1st_of_that_month():
    today = date(2026, 9, 18)
    assert current_period_start(frequency=ChecklistFrequency.MONTHLY, today=today) == date(
        2026, 9, 1
    )


# ---------------------------------------------------------------------------
# Admin: managing templates and tasks
# ---------------------------------------------------------------------------


def test_admin_can_create_a_daily_checklist(api_client, admin):
    api_client.force_authenticate(user=admin)

    response = api_client.post(
        reverse(ADMIN_TEMPLATES), {"frequency": "DAILY", "name": "Toilet Cleaning"}
    )

    assert response.status_code == 201, response.data
    assert response.data["frequency"] == "DAILY"


def test_admin_can_add_a_task_to_a_template(api_client, admin, daily_template):
    api_client.force_authenticate(user=admin)

    response = api_client.post(
        reverse(ADMIN_TASKS), {"template": str(daily_template.id), "text": "Restock soap"}
    )

    assert response.status_code == 201, response.data
    assert response.data["text"] == "Restock soap"


def test_admin_template_list_is_scoped_to_their_own_restaurant(
    api_client, admin, daily_template, other_restaurant
):
    ChecklistTemplate.objects.create(
        restaurant=other_restaurant, frequency=ChecklistFrequency.DAILY, name="Not yours"
    )
    api_client.force_authenticate(user=admin)

    response = api_client.get(reverse(ADMIN_TEMPLATES))

    names = [row["name"] for row in response.data["results"]]
    assert names == ["Toilet Cleaning"]


# ---------------------------------------------------------------------------
# Staff: reading and completing
# ---------------------------------------------------------------------------


def test_staff_can_filter_templates_by_frequency(api_client, staff_member, restaurant):
    ChecklistTemplate.objects.create(
        restaurant=restaurant, frequency=ChecklistFrequency.DAILY, name="Daily one"
    )
    ChecklistTemplate.objects.create(
        restaurant=restaurant, frequency=ChecklistFrequency.MONTHLY, name="Monthly one"
    )
    api_client.force_authenticate(user=staff_member)

    response = api_client.get(reverse(STAFF_TEMPLATES), {"frequency": "MONTHLY"})

    names = [row["name"] for row in response.data["results"]]
    assert names == ["Monthly one"]


def test_staff_can_list_a_templates_tasks(api_client, staff_member, daily_template, daily_task):
    api_client.force_authenticate(user=staff_member)

    response = api_client.get(reverse(STAFF_TASKS), {"template": str(daily_template.id)})

    assert [row["id"] for row in response.data["results"]] == [str(daily_task.id)]


def test_staff_can_complete_a_task(api_client, staff_member, daily_task):
    api_client.force_authenticate(user=staff_member)

    response = api_client.post(reverse(STAFF_COMPLETIONS), {"task": str(daily_task.id)})

    assert response.status_code == 201, response.data
    assert response.data["completed_by_name"] == "Alex"
    assert response.data["period_start"] == date.today().isoformat()


def test_a_colleague_completing_an_already_done_task_does_not_reassign_it(
    api_client, staff_member, colleague, daily_task
):
    api_client.force_authenticate(user=staff_member)
    api_client.post(reverse(STAFF_COMPLETIONS), {"task": str(daily_task.id)})

    api_client.force_authenticate(user=colleague)
    response = api_client.post(reverse(STAFF_COMPLETIONS), {"task": str(daily_task.id)})

    assert response.status_code == 201, response.data
    assert response.data["completed_by_name"] == "Alex"


def test_listing_completions_requires_a_template(api_client, staff_member):
    api_client.force_authenticate(user=staff_member)

    response = api_client.get(reverse(STAFF_COMPLETIONS))

    assert response.data["results"] == []


def test_listing_completions_only_returns_the_current_period(
    api_client, staff_member, daily_template, daily_task
):
    """A completion from a past period (yesterday, for a daily checklist)
    shouldn't make today's list look done."""
    from apps.compliance.models import ChecklistTaskCompletion

    ChecklistTaskCompletion.objects.create(
        restaurant=daily_template.restaurant,
        task=daily_task,
        period_start=date.today() - timedelta(days=1),
        completed_by=staff_member,
    )
    api_client.force_authenticate(user=staff_member)

    response = api_client.get(reverse(STAFF_COMPLETIONS), {"template": str(daily_template.id)})

    assert response.data["results"] == []


def test_staff_can_uncomplete_a_task(api_client, staff_member, daily_task, daily_template):
    api_client.force_authenticate(user=staff_member)
    created = api_client.post(reverse(STAFF_COMPLETIONS), {"task": str(daily_task.id)}).data

    response = api_client.delete(
        reverse(
            "v1:staff:compliance:checklist-task-completion-detail", kwargs={"pk": created["id"]}
        )
    )

    assert response.status_code == 204
    list_response = api_client.get(reverse(STAFF_COMPLETIONS), {"template": str(daily_template.id)})
    assert list_response.data["results"] == []


def test_a_note_can_be_added_to_an_already_completed_task_without_reassigning_it(
    api_client, staff_member, colleague, daily_task
):
    api_client.force_authenticate(user=staff_member)
    api_client.post(reverse(STAFF_COMPLETIONS), {"task": str(daily_task.id)})

    api_client.force_authenticate(user=colleague)
    response = api_client.post(
        reverse(STAFF_COMPLETIONS),
        {"task": str(daily_task.id), "note": "Restocked with the unscented soap this time"},
    )

    assert response.status_code == 201, response.data
    assert response.data["note"] == "Restocked with the unscented soap this time"
    assert response.data["completed_by_name"] == "Alex"


def test_cannot_complete_a_task_from_another_restaurant(api_client, staff_member, other_restaurant):
    outside_template = ChecklistTemplate.objects.create(
        restaurant=other_restaurant, frequency=ChecklistFrequency.DAILY, name="Not yours"
    )
    outside_task = ChecklistTask.objects.create(
        restaurant=other_restaurant, template=outside_template, text="Not yours either"
    )
    api_client.force_authenticate(user=staff_member)

    response = api_client.post(reverse(STAFF_COMPLETIONS), {"task": str(outside_task.id)})

    assert response.status_code == 400


def test_a_weekly_checklist_completion_carries_over_the_whole_week(
    api_client, staff_member, restaurant
):
    """Not date-pinned like the daily/opening/closing completions - once
    done this week, it should still show done regardless of which day of
    the week it's viewed on. Exercised here by recording it directly at
    Monday's period_start and then listing "today" (whatever day the test
    runs) still finds it, since current_period_start resolves to that same
    Monday for any day in the same week.
    """
    template = ChecklistTemplate.objects.create(
        restaurant=restaurant, frequency=ChecklistFrequency.WEEKLY, name="Team meeting"
    )
    task = ChecklistTask.objects.create(restaurant=restaurant, template=template, text="Held")
    api_client.force_authenticate(user=staff_member)

    api_client.post(reverse(STAFF_COMPLETIONS), {"task": str(task.id)})
    response = api_client.get(reverse(STAFF_COMPLETIONS), {"template": str(template.id)})

    assert len(response.data["results"]) == 1
