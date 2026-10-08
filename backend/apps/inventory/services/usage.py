"""Keeping a restaurant's reading of invoices inside a monthly ceiling.

Invoice scanning is the only thing in this codebase that costs money per call,
and the endpoint that triggers it is reachable by every staff account. A
runaway loop, or a phone retrying an upload in the background, would spend
real money with nothing to stop it.

The ceiling is not a billing mechanism and does not try to be exact. It exists
so that a bad afternoon costs a known amount rather than an unknown one.
"""

import logging

from django.conf import settings
from django.db.models import F
from django.utils import timezone

from ..models import ScanUsage

logger = logging.getLogger(__name__)


def _current_month():
    return timezone.localdate().replace(day=1)


def monthly_cap() -> int:
    """0 means no ceiling - the default for a deployment that has not thought
    about it, because a cap nobody chose would refuse real work."""
    return max(int(getattr(settings, "INVOICE_SCAN_MONTHLY_CAP", 0) or 0), 0)


def scans_this_month(*, restaurant_id) -> int:
    row = ScanUsage.objects.filter(restaurant_id=restaurant_id, month=_current_month()).first()
    return row.scans if row else 0


def cap_reached(*, restaurant_id) -> bool:
    cap = monthly_cap()
    if cap == 0:
        return False
    return scans_this_month(restaurant_id=restaurant_id) >= cap


def record_scan(*, restaurant_id) -> int:
    """Count one reading of one invoice.

    Incremented with an F() expression rather than read-then-write, so two
    workers finishing at the same moment cannot both write the same number and
    lose one of the two.
    """
    month = _current_month()
    usage, created = ScanUsage.objects.get_or_create(
        restaurant_id=restaurant_id, month=month, defaults={"scans": 1}
    )
    if not created:
        ScanUsage.objects.filter(pk=usage.pk).update(scans=F("scans") + 1)
        usage.refresh_from_db(fields=["scans"])

    cap = monthly_cap()
    if cap and usage.scans >= cap:
        logger.warning(
            "Restaurant %s has reached its monthly invoice scan cap (%s)", restaurant_id, cap
        )
    return usage.scans
