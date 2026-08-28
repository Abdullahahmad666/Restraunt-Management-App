"""Turn one barcode scan into a check-in or a check-out."""

from dataclasses import dataclass
from datetime import timedelta
from math import atan2, cos, radians, sin, sqrt

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from .. import models

EARTH_RADIUS_METERS = 6_371_000

# A scan within this long of clocking in never checks someone back out - it's
# an accidental double-scan (a phone double-tap, a flaky connection retried),
# not a five-minute shift. See scan() below for what happens instead.
MIN_TIME_BEFORE_CHECKOUT = timedelta(minutes=30)

# How far from "now" to look for a matching rota shift, in either direction.
# Wide enough to span a shift that starts right after midnight (matched from
# a check-in still on the previous calendar day) and a second shift later the
# same day, without pulling in tomorrow's or last week's shifts.
SHIFT_MATCH_WINDOW = timedelta(hours=12)


@dataclass(frozen=True)
class ScanResult:
    log: models.AttendanceLog
    action: str  # "check_in", "check_out" or "already_checked_in"


def _distance_meters(lat1, lon1, lat2, lon2) -> float:
    lat1, lon1, lat2, lon2 = (radians(float(value)) for value in (lat1, lon1, lat2, lon2))
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_METERS * atan2(sqrt(a), sqrt(1 - a))


def _verify_qr_and_location(*, staff, token, latitude, longitude) -> models.VenueQRCode:
    try:
        qr_code = models.VenueQRCode.objects.select_related("restaurant").get(
            token=token, is_active=True
        )
    except models.VenueQRCode.DoesNotExist as exc:
        raise ValidationError("This QR code is not recognised or is no longer active.") from exc

    if qr_code.restaurant_id != staff.restaurant_id:
        raise PermissionDenied("This QR code belongs to a different restaurant.")

    distance = _distance_meters(qr_code.latitude, qr_code.longitude, latitude, longitude)
    if distance > qr_code.radius_meters:
        raise ValidationError(
            f"You are {distance:.0f}m from {qr_code.restaurant.name}, outside the "
            f"{qr_code.radius_meters}m check-in radius."
        )

    return qr_code


def _find_shift_for_checkin(*, staff, now):
    """The shift this check-in is most likely for, out of any not already worked today.

    Picking "today's earliest shift" broke as soon as someone worked a
    second shift the same day - the later check-in kept re-matching the
    first (already-finished) shift instead of the second one. Instead: look
    at shifts starting within SHIFT_MATCH_WINDOW of right now, drop any that
    already have a finished log against them, and take whichever start time
    is closest to now. The wide window (rather than "today") is also what
    lets a shift that started shortly before midnight still match a
    check-in a few minutes after it.
    """
    candidates = models.Shift.objects.filter(
        staff=staff,
        starts_at__gte=now - SHIFT_MATCH_WINDOW,
        starts_at__lte=now + SHIFT_MATCH_WINDOW,
    ).exclude(
        attendance_logs__status__in=(
            models.AttendanceLog.Status.CLOSED,
            models.AttendanceLog.Status.AUTO_CLOSED,
        )
    )
    return min(
        candidates,
        key=lambda shift: abs((shift.starts_at - now).total_seconds()),
        default=None,
    )


def scan(*, staff, token, latitude, longitude) -> ScanResult:
    """One button on the staff side: scan the venue QR to clock in, scan again to clock out.

    Which one happens is decided here, not by the caller - a staff member
    with no open log is checking in, one with an open log old enough is
    checking out, and one with a very recently opened log is neither (see
    MIN_TIME_BEFORE_CHECKOUT).
    """
    qr_code = _verify_qr_and_location(
        staff=staff, token=token, latitude=latitude, longitude=longitude
    )
    now = timezone.now()

    with transaction.atomic():
        open_log = (
            models.AttendanceLog.objects.select_for_update()
            .filter(staff=staff, status=models.AttendanceLog.Status.OPEN)
            .first()
        )

        if open_log is not None:
            if now - open_log.clock_in_at < MIN_TIME_BEFORE_CHECKOUT:
                return ScanResult(log=open_log, action="already_checked_in")

            open_log.clock_out_at = now
            open_log.clock_out_latitude = latitude
            open_log.clock_out_longitude = longitude
            open_log.status = models.AttendanceLog.Status.CLOSED
            open_log.save()
            return ScanResult(log=open_log, action="check_out")

        shift = _find_shift_for_checkin(staff=staff, now=now)

        try:
            with transaction.atomic():
                log = models.AttendanceLog.objects.create(
                    restaurant=qr_code.restaurant,
                    staff=staff,
                    shift=shift,
                    clock_in_at=now,
                    clock_in_latitude=latitude,
                    clock_in_longitude=longitude,
                )
        except IntegrityError:
            # Lost a race with another request for this same staff member
            # between the select_for_update() above finding nothing and this
            # insert landing - two near-simultaneous scans, not a bad shift.
            # The database's one-open-log-per-staff constraint is what
            # actually caught it; this just turns that into a normal result.
            existing = models.AttendanceLog.objects.get(
                staff=staff, status=models.AttendanceLog.Status.OPEN
            )
            return ScanResult(log=existing, action="already_checked_in")

        return ScanResult(log=log, action="check_in")
