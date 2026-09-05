"""Pay period and rate-history models."""

from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.common.models import BaseModel


class StaffPayRate(BaseModel):
    """The two rates currently in effect for one staff member.

    Kept as its own live row rather than always reading "the latest
    RateChange" so a payroll run's queries do not need a subquery per staff
    member to find the current rate. RateChange below is the append-only
    history that keeps a pay period calculated under an old rate correct
    after the rate later changes.
    """

    staff = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="pay_rate"
    )
    rate_1 = models.DecimalField(
        "Pay rate 1 (NI)", max_digits=8, decimal_places=2, default=Decimal("0")
    )
    rate_2 = models.DecimalField(
        "Pay rate 2 (cash)", max_digits=8, decimal_places=2, default=Decimal("0")
    )

    def __str__(self):
        return f"{self.staff} rates"


class RateChange(BaseModel):
    """One historical snapshot, written whenever an admin edits a staff member's rates."""

    staff = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="rate_changes"
    )
    rate_1 = models.DecimalField(max_digits=8, decimal_places=2)
    rate_2 = models.DecimalField(max_digits=8, decimal_places=2)
    effective_from = models.DateField()
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="+",
    )

    class Meta:
        ordering = ("-effective_from",)

    def __str__(self):
        return f"{self.staff} rates from {self.effective_from}"


class PayPeriod(BaseModel):
    """A span of dates a payroll run is calculated over, e.g. one calendar week."""

    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        LOCKED = "LOCKED", "Locked"
        PAID = "PAID", "Paid"

    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="pay_periods"
    )
    starts_on = models.DateField()
    ends_on = models.DateField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)

    class Meta:
        ordering = ("-starts_on",)
        constraints = [
            models.UniqueConstraint(
                fields=("restaurant", "starts_on", "ends_on"),
                name="unique_pay_period_span",
            )
        ]

    def __str__(self):
        return f"{self.restaurant} {self.starts_on} - {self.ends_on}"


class PayrollEntry(BaseModel):
    """One staff member's calculated pay for one pay period.

    hours_at_rate_1 + hours_at_rate_2 should equal hours_worked, which the
    attendance app calculates independently. The split between the two rates
    is an admin decision made when the period is reviewed - see
    apps.payroll.services.calculation - not something attendance data
    determines on its own.
    """

    pay_period = models.ForeignKey(PayPeriod, on_delete=models.CASCADE, related_name="entries")
    staff = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="payroll_entries",
    )

    hours_worked = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0"))
    hours_at_rate_1 = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0"))
    hours_at_rate_2 = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0"))

    # Copied from StaffPayRate at calculation time so a later rate change
    # never rewrites the pay of a period that has already been reviewed.
    rate_1_snapshot = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0"))
    rate_2_snapshot = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0"))

    total_pay = models.DecimalField(max_digits=9, decimal_places=2, default=Decimal("0"))

    class Meta:
        ordering = ("-pay_period__starts_on",)
        constraints = [
            models.UniqueConstraint(
                fields=("pay_period", "staff"), name="one_entry_per_staff_per_period"
            )
        ]

    def __str__(self):
        return f"{self.staff} - {self.pay_period}"


# Flat, top-level name for config.settings.base's ENUM_NAME_OVERRIDES - see
# the matching comment in apps.attendance.models.
PAY_PERIOD_STATUS_CHOICES = PayPeriod.Status.choices
