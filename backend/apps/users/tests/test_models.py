import pytest
from django.contrib.auth import get_user_model

pytestmark = pytest.mark.django_db

User = get_user_model()


def test_create_user_normalises_email_domain():
    # Django lowercases the domain but preserves the local part.
    user = User.objects.create_user(email="Chef@Example.COM", password="s3cret-pass")
    assert user.email == "Chef@example.com"
    assert user.check_password("s3cret-pass")
    assert user.role == User.Role.WAITER


def test_create_user_requires_email():
    with pytest.raises(ValueError):
        User.objects.create_user(email="", password="s3cret-pass")


def test_create_superuser_is_owner():
    admin = User.objects.create_superuser(email="owner@example.com", password="s3cret-pass")
    assert admin.is_staff and admin.is_superuser
    assert admin.role == User.Role.OWNER
