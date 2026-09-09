"""Requesting, deciding and cancelling a shift hand-off between staff.

A swap request is a one-way hand-off, not a trade: the requester's own
`shift` moves to `target_staff` if a manager approves it, and nothing moves
back the other way. See models.ShiftSwapRequest for the full shape.
"""

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from apps.common.roles import Role

from .. import models


def _raise_if_double_booked(*, staff, shift) -> None:
    """Would `staff` already be on the rota somewhere else during `shift`'s span."""
    overlaps = models.Shift.objects.filter(
        staff=staff, starts_at__lt=shift.ends_at, ends_at__gt=shift.starts_at
    ).exclude(pk=shift.pk)
    if overlaps.exists():
        raise ValidationError("That colleague already has a shift at that time.")


def request_swap(*, requester, shift, target_staff, note="") -> models.ShiftSwapRequest:
    """A staff member asks a colleague to take over one of their own shifts."""
    if shift.staff_id != requester.id:
        raise PermissionDenied("You can only request a swap for your own shift.")
    if target_staff.id == requester.id:
        raise ValidationError("Pick a colleague to take the shift, not yourself.")
    if target_staff.restaurant_id != requester.restaurant_id:
        raise ValidationError("That colleague is not on your team.")
    if target_staff.role != Role.STAFF or not target_staff.is_active:
        raise ValidationError("You can only offer a shift to another active staff member.")
    if shift.starts_at <= timezone.now():
        raise ValidationError("You can only request a swap for a shift that hasn't started yet.")
    if models.ShiftSwapRequest.objects.filter(
        shift=shift, status=models.ShiftSwapRequest.Status.PENDING
    ).exists():
        raise ValidationError("This shift already has a swap request pending.")
    _raise_if_double_booked(staff=target_staff, shift=shift)

    return models.ShiftSwapRequest.objects.create(
        restaurant=shift.restaurant,
        shift=shift,
        requested_by=requester,
        target_staff=target_staff,
        note=note,
    )


def cancel_swap(*, swap_request, cancelled_by) -> models.ShiftSwapRequest:
    """The requester takes back their own still-pending request."""
    if swap_request.requested_by_id != cancelled_by.id:
        raise PermissionDenied("You can only cancel your own swap request.")
    if swap_request.status != models.ShiftSwapRequest.Status.PENDING:
        raise ValidationError("Only a pending swap request can be cancelled.")

    swap_request.status = models.ShiftSwapRequest.Status.CANCELLED
    swap_request.save(update_fields=["status", "updated_at"])
    return swap_request


@transaction.atomic
def decide_swap(
    *, swap_request, approve: bool, decided_by, decision_note: str = ""
) -> models.ShiftSwapRequest:
    """A manager approves or declines a pending swap request.

    Approving reassigns the shift there and then - the shift's `staff` field
    is the single source of truth for who is actually on the rota, so there
    is no separate "accepted, but not yet applied" state to fall out of sync
    with it.
    """
    if swap_request.status != models.ShiftSwapRequest.Status.PENDING:
        raise ValidationError("This swap request has already been decided.")

    if approve:
        # Re-checked here, not just at request time: the target's rota may
        # have changed in the time the request sat pending.
        _raise_if_double_booked(staff=swap_request.target_staff, shift=swap_request.shift)
        swap_request.status = models.ShiftSwapRequest.Status.APPROVED
        swap_request.shift.staff = swap_request.target_staff
        swap_request.shift.save(update_fields=["staff", "updated_at"])
    else:
        swap_request.status = models.ShiftSwapRequest.Status.DECLINED

    swap_request.decided_by = decided_by
    swap_request.decided_at = timezone.now()
    swap_request.decision_note = decision_note
    swap_request.save(
        update_fields=["status", "decided_by", "decided_at", "decision_note", "updated_at"]
    )
    return swap_request
