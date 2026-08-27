"""Send a notification via its channel.

Push delivery is a placeholder until the mobile app registers Expo push
tokens through DeviceToken - until then this records the attempt and marks
it failed so nothing is silently dropped, and the same call site starts
working for real the moment tokens exist and _send_expo_push is filled in.
"""

import logging

from .. import models

logger = logging.getLogger(__name__)


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
    """Not wired up yet - swap this for a real call to Expo's push API once
    the mobile app starts registering tokens.
    """
    logger.info("Would send push to %d token(s): %s", len(tokens), notification.title)
    return False
