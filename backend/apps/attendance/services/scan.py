"""Turn one barcode scan into a check-in or a check-out."""

from dataclasses import dataclass
from math import atan2, cos, radians, sin, sqrt

from django.core.exceptions import PermissionDenied, ValidationError
from django.utils import timezone

from .. import models

EARTH_RADIUS_METERS = 6_371_000


@dataclass(frozen=True)
class ScanResult:
    log: models.AttendanceLog
    action: str  # "check_in" or "check_out"


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


def scan(*, staff, token, latitude, longitude) -> ScanResult:
    """One button on the staff side: scan the venue QR to clock in, scan again to clock out.

    Which one happens is decided here, not by the caller - a staff member
    with no open log is checking in, one with an open log is checking out.
    """
    qr_code = _verify_qr_and_location(staff=staff, token=token, latitude=latitude, longitude=longitude)
    now = timezone.now()

    open_log = models.AttendanceLog.objects.filter(
        staff=staff, status=models.AttendanceLog.Status.OPEN
    ).first()

    if open_log is not None:
        open_log.clock_out_at = now
        open_log.clock_out_latitude = latitude
        open_log.clock_out_longitude = longitude
        open_log.status = models.AttendanceLog.Status.CLOSED
        open_log.save()
        return ScanResult(log=open_log, action="check_out")

    shift = (
        models.Shift.objects.filter(staff=staff, starts_at__date=now.date())
        .order_by("starts_at")
        .first()
    )

    log = models.AttendanceLog.objects.create(
        restaurant=qr_code.restaurant,
        staff=staff,
        shift=shift,
        clock_in_at=now,
        clock_in_latitude=latitude,
        clock_in_longitude=longitude,
    )
    return ScanResult(log=log, action="check_in")
