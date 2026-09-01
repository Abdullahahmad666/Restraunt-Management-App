"""Fixtures shared by the whole backend test suite."""

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient


@pytest.fixture(autouse=True)
def _reset_throttles():
    """Clear DRF's throttle history between tests.

    Throttle counters live in the default cache, which is process-wide and
    survives the per-test database rollback. Without this, the sixth test to
    touch /auth/register/ gets a 429 instead of exercising the endpoint - the
    failure looks like a bug in whatever test happens to run sixth, which is a
    genuinely confusing hour to lose.
    """
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db, django_user_model):
    return django_user_model.objects.create_user(
        email="staff@example.com", password="test-password-123"
    )


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client
