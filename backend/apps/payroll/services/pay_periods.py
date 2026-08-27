"""Opening, closing and locking a pay period."""

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import transaction

from apps.common.roles import Role

from . import calculation
from .. import models

User = get_user_model()


@transaction.atomic
def close_pay_period(*, pay_period: models.PayPeriod) -> models.PayPeriod:
    """Calculate every staff member's entry and lock the period against further edits."""
    if pay_period.status != models.PayPeriod.Status.OPEN:
        raise ValidationError("Only an open pay period can be closed.")

    staff = User.objects.filter(restaurant=pay_period.restaurant, role=Role.STAFF)
    for member in staff:
        calculation.calculate_entry(pay_period=pay_period, staff=member)

    pay_period.status = models.PayPeriod.Status.LOCKED
    pay_period.save(update_fields=["status", "updated_at"])
    return pay_period


def mark_paid(*, pay_period: models.PayPeriod) -> models.PayPeriod:
    if pay_period.status != models.PayPeriod.Status.LOCKED:
        raise ValidationError("Only a locked pay period can be marked paid.")

    pay_period.status = models.PayPeriod.Status.PAID
    pay_period.save(update_fields=["status", "updated_at"])
    return pay_period
