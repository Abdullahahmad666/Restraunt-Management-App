"""Send a notification via its channel.

Push delivery goes straight to Expo's push HTTP API - no SDK needed, just a
JSON POST of one message per device token. See
https://docs.expo.dev/push-notifications/sending-notifications/.
"""

import logging

import requests

from .. import models

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def send_notification(notification: models.Notification) -> bool:
    tokens = list(models.DeviceToken.objects.filter(user_id=notification.user_id, is_active=True))

    if not tokens:
        models.DeliveryAttempt.objects.create(
            notification=notification,
            channel=models.DeliveryAttempt.Channel.PUSH,
            succeeded=False,
            error_message="No active device token for this user.",
        )
        notification.status = models.Notification.Status.FAILED
        notification.save(update_fields=["status"])
        logger.info(
            "No device token for user %s; notification %s queued undelivered.",
            notification.user_id,
            notification.id,
        )
        return False

    succeeded = _send_expo_push(tokens, notification)

    models.DeliveryAttempt.objects.bulk_create(
        models.DeliveryAttempt(
            notification=notification,
            channel=models.DeliveryAttempt.Channel.PUSH,
            succeeded=succeeded,
        )
        for _token in tokens
    )

    notification.status = (
        models.Notification.Status.SENT if succeeded else models.Notification.Status.FAILED
    )
    notification.save(update_fields=["status"])
    return succeeded


def _send_expo_push(tokens: list[models.DeviceToken], notification: models.Notification) -> bool:
    """POST one push message per token to Expo, and deactivate any token
    Expo reports as dead so later notifications stop retrying it.

    Returns True only if every token was accepted - a partial failure (one
    of several devices) still leaves the notification's own status/delivery
    trail reflecting that not everything went out clean.
    """
    messages = [
        {
            "to": token.token,
            "title": notification.title,
            "body": notification.body,
            "sound": "default",
            "data": {"kind": notification.kind, "notification_id": str(notification.id)},
        }
        for token in tokens
    ]

    try:
        response = requests.post(
            EXPO_PUSH_URL,
            json=messages,
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            timeout=10,
        )
        response.raise_for_status()
        receipts = response.json().get("data", [])
    except (requests.RequestException, ValueError):
        logger.exception("Expo push request failed for notification %s", notification.id)
        return False

    all_ok = True
    for token, receipt in zip(tokens, receipts, strict=False):
        if receipt.get("status") == "ok":
            continue
        all_ok = False
        logger.warning("Expo push to token %s failed: %s", token.id, receipt.get("message"))
        if receipt.get("details", {}).get("error") == "DeviceNotRegistered":
            token.is_active = False
            token.save(update_fields=["is_active", "updated_at"])

    return all_ok
