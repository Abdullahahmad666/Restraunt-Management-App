"""Accounts and roles.

Swapping AUTH_USER_MODEL after the first migration is painful, so the custom
user model is defined up front even though it is currently thin.
"""

import secrets
import uuid
from datetime import timedelta

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.common.models import BaseModel, TimeStampedModel
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
    is_email_verified = models.BooleanField(default=False)
    email_otp = models.CharField(max_length=6, blank=True)
    email_otp_created_at = models.DateTimeField(null=True, blank=True)
    profile_picture = models.ImageField(upload_to="profile_pictures/", null=True, blank=True)

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


def _generate_code() -> str:
    """A short code someone can read down the phone without confusion.

    Deliberately excludes 0/O and 1/I/L, which get misheard and mistyped, and
    uses secrets rather than random - this grants an admin account, so a
    guessable sequence would be a way in.
    """
    alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(8))


class InviteCode(BaseModel):
    """A single-use code that lets someone self-register into a restaurant.

    This exists because signup is public. Without it, a role field on the
    register endpoint would let anyone create an admin account - and an admin
    here can edit attendance records, which decide what people are paid. The
    code moves that decision back to someone who already has the authority.

    Staff codes are a convenience: they attach the new account to a restaurant.
    A user with no restaurant sees nothing at all (the querysets fail closed),
    so without a code an account is inert until an admin assigns it.
    """

    code = models.CharField(max_length=16, unique=True, db_index=True, editable=False)
    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="invite_codes",
    )
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.STAFF)
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invites_created",
    )
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    used_by = models.OneToOneField(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invite_used",
    )

    #: How long a freshly issued code stays valid.
    DEFAULT_TTL = timedelta(days=14)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("restaurant", "role"))]

    def __str__(self):
        return f"{self.code} ({self.role})"

    def save(self, *args, **kwargs):
        if not self.code:
            # Retry rather than trust one draw - unique=True is the real
            # guarantee, this just avoids surfacing a collision to the caller.
            for _ in range(10):
                candidate = _generate_code()
                if not InviteCode.objects.filter(code=candidate).exists():
                    self.code = candidate
                    break
            else:  # pragma: no cover - astronomically unlikely
                raise RuntimeError("Could not generate a unique invite code.")
        if not self.expires_at:
            self.expires_at = timezone.now() + self.DEFAULT_TTL
        super().save(*args, **kwargs)

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    @property
    def is_used(self) -> bool:
        return self.used_at is not None

    @property
    def is_usable(self) -> bool:
        return not self.is_used and not self.is_expired

    def consume(self, user) -> None:
        """Mark the code spent. Caller is responsible for the surrounding atomic block."""
        self.used_at = timezone.now()
        self.used_by = user
        self.save(update_fields=("used_at", "used_by", "updated_at"))
