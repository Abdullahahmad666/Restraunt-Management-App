"""Deleting your own account.

Apple's guideline 5.1.1(v): an app that lets you create an account must let
you delete it from inside the app. Not deactivate - delete.

The complication is that four tables are PROTECT'd against the user, and on
purpose. Attendance, shifts, pay rates and payroll entries are the
*restaurant's* employment records; HMRC wants payroll kept three years and the
Working Time Regulations want hours kept two, counted from after the person
has left. A staff member cannot be allowed to erase their employer's statutory
records by tapping a button in a phone app, and `user.delete()` on anybody who
has ever been rota'd raises ProtectedError naming all four.

Apple accommodates exactly this: data you are legally required to keep may be
kept, provided the user is told. So there are two paths here, and which one
runs is decided by the data rather than by a setting:

    nothing retained  ->  the row is deleted. A genuine delete, no tombstone.
    records retained  ->  the account is destroyed and the records are
                          de-identified. Name, email, phone, photo, password
                          and every session are gone; what is left is a row
                          that says "Former team member" and holds hours.

Either way the outcome from the person's side is identical: they cannot sign
in, and nothing on any screen names them.

An admin is a special case, because an admin *is* the restaurant - see
`plan_for` and `delete_restaurant`.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from apps.common.roles import Role

logger = logging.getLogger(__name__)

User = get_user_model()

#: RFC 2606 reserves .invalid precisely so that it can never be registered, so
#: a scrubbed address can never route anywhere and can never collide with a
#: real one. The local part carries a fresh uuid rather than the user's id -
#: the id is what the retained attendance rows are keyed on, and putting it in
#: an email address would hand it back to anyone reading a staff list.
SCRUBBED_EMAIL_DOMAIN = "invisiko.invalid"

#: The relations that keep a row alive. Each is PROTECT'd against the user, so
#: each is also a reason `user.delete()` would raise. Kept as names rather than
#: as a hand-written query so that adding a fifth PROTECT'd relation and
#: forgetting this list shows up as a failing test rather than as a 500 in
#: production.
RETAINED_RELATIONS = (
    "attendance_logs",
    "shifts",
    "payroll_entries",
    "rate_changes",
)


@dataclass(frozen=True)
class DeletionPlan:
    """What deleting this account would actually do, worked out before asking.

    The confirmation screen has to be specific - "this also deletes 4 staff
    accounts" is a different decision from "this deletes your account" - so
    the counts are computed up front and shown to the person, rather than
    discovered afterwards.
    """

    #: True when the account row itself goes. False when employment records
    #: force it to survive in de-identified form.
    hard_delete: bool
    #: True when this is the last admin and the restaurant goes with them.
    deletes_restaurant: bool
    #: The restaurant's name, which the caller must type back to confirm a
    #: teardown. None when nothing is being torn down.
    restaurant_name: str | None
    #: Other accounts that a teardown would take with it.
    staff_accounts: int
    #: Rough size of what a teardown destroys, for the confirmation copy.
    attendance_records: int
    compliance_records: int

    @property
    def requires_name_confirmation(self) -> bool:
        return self.deletes_restaurant


def has_retained_records(user) -> bool:
    """Would anything stop this row being deleted outright?"""
    if hasattr(user, "pay_rate"):
        return True
    return any(getattr(user, relation).exists() for relation in RETAINED_RELATIONS)


def _is_last_admin(user) -> bool:
    """Is this the only admin its restaurant has left?

    Deactivated admins do not count: an account switched off cannot sign in to
    run payroll, so leaving a restaurant with nothing but those is the same as
    leaving it with none.
    """
    if not user.is_admin or user.restaurant_id is None:
        return False
    return (
        not User.objects.filter(
            restaurant_id=user.restaurant_id,
            role=Role.ADMIN,
            is_active=True,
            deleted_at__isnull=True,
        )
        .exclude(pk=user.pk)
        .exists()
    )


def plan_for(user) -> DeletionPlan:
    """Work out what deleting this account would do, without doing it.

    The last admin of a restaurant is the one case where deleting an account
    reaches past the account. There is no in-app way to appoint a second
    manager - the invite screen only ever issues STAFF codes - so "hand over
    first" is not a route anybody could actually take, and leaving the
    restaurant behind would leave staff able to sign in to a place where
    nobody can build a rota, run a pay period or approve a swap. So the
    restaurant goes too, and the confirmation says so in as many words.
    """
    restaurant = user.restaurant
    tears_down = _is_last_admin(user)

    if not tears_down:
        return DeletionPlan(
            hard_delete=not has_retained_records(user),
            deletes_restaurant=False,
            restaurant_name=None,
            staff_accounts=0,
            attendance_records=0,
            compliance_records=0,
        )

    others = User.objects.filter(restaurant_id=restaurant.pk).exclude(pk=user.pk)
    return DeletionPlan(
        hard_delete=True,
        deletes_restaurant=True,
        restaurant_name=restaurant.name,
        staff_accounts=others.count(),
        attendance_records=restaurant.attendance_logs.count(),
        compliance_records=(restaurant.temperature_readings.count() + restaurant.documents.count()),
    )


def _scrub_identity(user) -> None:
    """Destroy the account, keeping only the name the records need.

    This path runs when employment records survive, and those records have to
    stay attributable to somebody: a manager reconciling a closed pay period
    needs to know whose eight hours those were, and HMRC requires the employee
    on a retained payroll record to be identifiable. Three leavers who all
    read "Former team member" are three rows nobody can tell apart, which
    satisfies neither.

    So the name moves to `retained_name` - an attribute of the record rather
    than of an account - and everything else that identifies the person is
    destroyed outright. Read before the fields are cleared, obviously.
    """
    user.retained_name = f"{user.first_name} {user.last_name}".strip()
    user.email = f"deleted-{uuid.uuid4().hex}@{SCRUBBED_EMAIL_DOMAIN}"
    user.first_name = ""
    user.last_name = ""
    user.phone = ""
    user.email_otp = ""
    user.email_otp_created_at = None
    user.is_email_verified = False
    user.is_active = False
    user.deleted_at = timezone.now()
    # Not a password nobody knows - no password at all. set_unusable_password
    # writes a hash no input can ever match, so "forgot password" cannot be
    # used to bring the account back either.
    user.set_unusable_password()
    user.save(
        update_fields=[
            "retained_name",
            "email",
            "first_name",
            "last_name",
            "phone",
            "email_otp",
            "email_otp_created_at",
            "is_email_verified",
            "is_active",
            "deleted_at",
            "password",
            "updated_at",
        ]
    )


def _revoke_sessions(user) -> None:
    """End every signed-in session, now rather than at token expiry.

    The access token the caller is holding stays valid until it expires - it
    is self-contained and nothing checks a list - but without the refresh
    tokens it cannot be renewed, so the session dies within
    ACCESS_TOKEN_MINUTES. The app signs itself out immediately anyway; this is
    for the other devices the person is signed in on.
    """
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


def _drop_live_state(user) -> None:
    """Remove the things that would otherwise outlive the account.

    Deliberately not "everything that mentions them": temperature readings and
    checklist completions keep their SET_NULL link and read as "Former team
    member", because a food-safety record of a check that was done is not the
    account holder's to erase either.
    """
    # Push would otherwise keep arriving on a phone whose owner just deleted
    # their account.
    user.device_tokens.all().delete()
    # Notifications are addressed to them and quote colleagues by name.
    user.notifications.all().delete()
    # A swap nobody can now accept or be covered by.
    user.shift_swaps_requested.all().delete()
    user.shift_swaps_offered.all().delete()
    # Shifts that have not happened yet are a rota entry, not a record of work
    # - and leaving them puts a deleted person on next week's rota. Past
    # shifts stay: they are what the hours were calculated from.
    user.shifts.filter(starts_at__gte=timezone.now()).delete()


def _delete_avatar_after_commit(user) -> None:
    """Delete the S3 object, once the transaction that decided to is safe.

    ATOMIC_REQUESTS means this runs inside a transaction, and a rollback
    cannot un-delete a file from a bucket. So the storage call waits for the
    commit; if the request fails, the object stays, which is the error worth
    having. A failure to delete is logged rather than raised - the account is
    already gone by then, and failing the request would tell the person their
    deletion did not work when it did.
    """
    picture = user.profile_picture
    if not picture:
        return
    name = picture.name

    def remove():
        try:
            picture.storage.delete(name)
        except Exception:  # pragma: no cover - storage failures are logged, not raised
            logger.exception("Could not delete avatar %s for a deleted account", name)

    transaction.on_commit(remove)


def delete_restaurant(restaurant) -> None:
    """Tear a whole restaurant down, in the order the constraints demand.

    `restaurant.delete()` on anything with real history raises ProtectedError:
    its staff are PROTECT'd by their own attendance and payroll, and its
    document categories are PROTECT'd by the documents filed under them. Both
    protections are right in every other circumstance - they stop a careless
    delete taking employment records or certificates with it - so this clears
    the protected rows explicitly, deepest first, rather than weakening them.

    The order is load-bearing. Documents before categories, payroll entries
    and rates before staff, and the restaurant last.
    """
    staff_ids = list(restaurant.staff.values_list("pk", flat=True))

    # Documents hold the PROTECT on their category; categories cascade from
    # the restaurant, so they only need the documents out of the way first.
    restaurant.documents.all().delete()

    # Payroll: entries cascade from their period, but the rate and its history
    # hang off the staff member alone and would block the user row.
    from apps.payroll.models import PayrollEntry, RateChange, StaffPayRate

    PayrollEntry.objects.filter(staff_id__in=staff_ids).delete()
    RateChange.objects.filter(staff_id__in=staff_ids).delete()
    StaffPayRate.objects.filter(staff_id__in=staff_ids).delete()

    # Attendance and the rota are PROTECT'd against the staff member even
    # though they also cascade from the restaurant - PROTECT raises whether or
    # not the protected row is in the same deletion, so they go by hand.
    restaurant.attendance_logs.all().delete()
    restaurant.shifts.all().delete()

    # Now the staff rows will go, and the restaurant takes everything that
    # cascades: invite codes, fridges, checklists, readings, completions,
    # categories, suppliers, items, invoices, pay periods, tables.
    restaurant.delete()


@transaction.atomic
def delete_account(user) -> DeletionPlan:
    """Delete this account, by whichever of the two routes applies.

    Returns the plan that was carried out, so a caller can log or report what
    happened. Atomic: a half-deleted account - signed out but still named on a
    rota - is worse than either outcome.
    """
    plan = plan_for(user)

    _revoke_sessions(user)
    _delete_avatar_after_commit(user)

    if plan.deletes_restaurant:
        delete_restaurant(user.restaurant)
        return plan

    _drop_live_state(user)

    if plan.hard_delete:
        user.delete()
        return plan

    _scrub_identity(user)
    return plan
