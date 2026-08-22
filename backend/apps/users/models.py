"""Accounts and roles.

Swapping AUTH_USER_MODEL after the first migration is painful, so the custom
user model is defined up front even though it is currently thin.
"""

import uuid

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.common.models import TimeStampedModel
from apps.common.roles import Role


class UserManager(BaseUserManager):
    """Manager for a user model that authenticates by email, not username."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", Role.ADMIN)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser, TimeStampedModel):
    # Re-exported so callers can write `User.Role.ADMIN` without a second import.
    Role = Role

    # UUID rather than a sequential integer: user ids travel to the mobile
    # client and end up in logs, so they should not leak headcount.
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    username = None
    email = models.EmailField(_("email address"), unique=True)
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.STAFF)
    phone = models.CharField(max_length=32, blank=True)

    # Set once the restaurants app defines Restaurant. Kept as a string
    # reference so the two apps do not import each other.
    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="staff",
        null=True,
        blank=True,
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        ordering = ("email",)

    def __str__(self):
        return self.email

    @property
    def is_admin(self) -> bool:
        return self.role == Role.ADMIN

    @property
    def is_staff_member(self) -> bool:
        """Distinct from Django's `is_staff`, which controls admin-site access."""
        return self.role in {Role.STAFF, Role.ADMIN}
