"""Opening, closing and locking a pay period - and the Friday-to-Thursday
biweekly calendar Phillys runs pay periods on.

Every pay period is a fixed 14-day span, Friday through the second Thursday
after it (payday). They chain with no gaps or overlaps - the day after one
ends is always the first day of the next - so the whole schedule, forever in
both directions, is fixed once you know that ONE of them runs a given span.

PERIOD_ANCHOR is one such known-good span: 2026-08-21 (a Friday) to
2026-09-03 (the Thursday two weeks later, and also the first Thursday of
September 2026). That second fact is what makes it a useful anchor rather
than an arbitrary one: it is the period that hands off into "Pay period 1 of
September" starting the very next day, which is where this whole scheme was
worked out from in the first place - see period_label below for what that
naming means.

A period is named for the calendar month its END date (the Thursday, payday)
falls in - not its start - and numbered by chronological order among every
period ending in that month. Worked example, using the anchor above:

    Fri 2026-08-21 - Thu 2026-09-03  ->  Pay period 1 of September 2026
    Fri 2026-09-04 - Thu 2026-09-17  ->  Pay period 2 of September 2026
    Fri 2026-09-18 - Thu 2026-10-01  ->  Pay period 1 of October 2026
    Fri 2026-10-02 - Thu 2026-10-15  ->  Pay period 2 of October 2026
    Fri 2026-10-16 - Thu 2026-10-29  ->  Pay period 3 of October 2026
    Fri 2026-10-30 - Thu 2026-11-12  ->  Pay period 1 of November 2026

Note the third one: a period is named for October even though it starts in
September, because its payday (Oct 1) is in October - "if some days left
[September] and join with next month, we call it pay period [of the next
month]." September ends up with two periods and October gets three purely
because of how the 14-day cadence happens to land that particular month -
nothing is hardcoded to "2 per month."
"""

from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import transaction

from apps.common.roles import Role

from .. import models
from . import calculation

User = get_user_model()

PERIOD_LENGTH_DAYS = 14
PERIOD_ANCHOR_FRIDAY = date(2026, 8, 21)


def period_bounds_for(target: date) -> tuple[date, date]:
    """The Friday-to-Thursday pay period that contains `target`."""
    days_since_anchor = (target - PERIOD_ANCHOR_FRIDAY).days
    periods_elapsed = days_since_anchor // PERIOD_LENGTH_DAYS
    starts_on = PERIOD_ANCHOR_FRIDAY + timedelta(days=periods_elapsed * PERIOD_LENGTH_DAYS)
    ends_on = starts_on + timedelta(days=PERIOD_LENGTH_DAYS - 1)
    return starts_on, ends_on


def next_period_bounds(*, after: date) -> tuple[date, date]:
    """The period immediately following the one containing `after`."""
    _, current_end = period_bounds_for(after)
    return period_bounds_for(current_end + timedelta(days=1))


def period_label(*, ends_on: date) -> str:
    """ "Pay period N of Month Year" for a period ending on `ends_on` - see
    the module docstring for the naming rule this implements."""
    target_year, target_month = ends_on.year, ends_on.month

    number = 0
    cursor = date(target_year, target_month, 1)
    while True:
        _, cursor_end = period_bounds_for(cursor)
        if cursor_end.year == target_year and cursor_end.month == target_month:
            number += 1
            if cursor_end == ends_on:
                return f"Pay period {number} of {ends_on.strftime('%B %Y')}"
        elif number > 0:
            # Walked past the last period ending in this month without
            # matching - ends_on was never a real period end.
            raise ValueError(f"{ends_on} is not the end date of a pay period.")
        cursor = cursor_end + timedelta(days=1)


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
