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
    """A code that lets someone self-register into a restaurant.

    This exists because signup is public. Without it, a role field on the
    register endpoint would let anyone create an admin account - and an admin
    here can edit attendance records, which decide what people are paid. The
    code moves that decision back to someone who already has the authority.

    A STAFF code is a standing invite, not a single-use ticket: the whole
    team shares the one code a manager hands out, and it keeps working for
    every new joiner until the manager issues a replacement (see
    AdminInviteCodeViewSet.perform_create, which deactivates the old one at
    that point) or explicitly revokes it. An ADMIN code stays single-use -
    handing someone the keys to edit attendance and payroll is deliberately
    a one-shot action, not something meant to be reused or shared further.
    `is_active` is the switch a manager's "regenerate" flips; `is_usable`
    is what actually gates registration, and reads that switch differently
    per role.
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
    is_active = models.BooleanField(default=True)
    # "Most recently used" for a reusable STAFF code, or "the one and only
    # use" for a single-use ADMIN code - either way, the last successful
    # registration this code produced.
    used_at = models.DateTimeField(null=True, blank=True)
    used_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
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
        """Has this code ever produced a successful registration - not
        "is it still usable" (see is_usable), since a STAFF code is meant
        to go on being used after its first one."""
        return self.used_at is not None

    @property
    def is_usable(self) -> bool:
        if self.is_expired or not self.is_active:
            return False
        if self.role == Role.STAFF:
            return True
        return not self.is_used

    def consume(self, user) -> None:
        """Record a successful registration. Caller is responsible for the
        surrounding atomic block. Does not deactivate the code - for a
        reusable STAFF code that would defeat the point; an ADMIN code is
        already blocked from a second use by is_usable's own is_used check
        above, so there is nothing else to enforce here."""
        self.used_at = timezone.now()
        self.used_by = user
        self.save(update_fields=("used_at", "used_by", "updated_at"))
