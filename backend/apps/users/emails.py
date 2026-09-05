"""Account emails that carry a password link.

Both the "I forgot my password" and "an admin just created your account" cases
need the same thing: a one-time link that lets someone set a password without
anyone else ever knowing it. Only the wording differs, so the token and link
building live here once rather than being duplicated at each call site.

The token is Django's default_token_generator, which hashes the user's current
password. That gives single use for free - the moment a password is set the
token stops working - and it holds for a brand new account too, because
set_unusable_password() still writes a value for the hash to cover.
"""

import logging

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

logger = logging.getLogger(__name__)


def build_password_link(user) -> str:
    """The deep link that opens the app's set-a-password screen."""
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f"{settings.PASSWORD_RESET_URL}?uid={uid}&token={token}"


def _send(subject: str, body: str, recipient: str) -> None:
    """Send, and never let a mail failure reach the caller.

    Both callers have a reason. The reset view answers identically whether or
    not an address is registered, and an exception here would break that.
    Staff creation must not roll back an account that was created correctly
    just because the notification did not go out - the admin can resend.
    """
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            fail_silently=False,
        )
    except Exception:
        logger.exception("Failed to send %r to %s", subject, recipient)


def send_password_reset_email(user) -> None:
    """Someone asked to reset a password they already had."""
    _send(
        subject="Reset your Invisiko password",
        body="\n\n".join(
            [
                f"Hello {user.first_name or user.email},",
                (
                    "Use the link below to choose a new password. It expires in "
                    "a few hours and can only be used once."
                ),
                build_password_link(user),
                (
                    "If you did not ask for this, you can ignore this email - "
                    "your password has not changed."
                ),
            ]
        ),
        recipient=user.email,
    )


def send_account_setup_email(user, restaurant_name: str | None = None) -> None:
    """An admin created this account; the new person sets their own password.

    Sending a link rather than a generated password matters: a password the
    admin can read is a shared secret two people know, and in this app an
    account is tied to attendance records that decide someone's pay.
    """
    where = f" at {restaurant_name}" if restaurant_name else ""
    _send(
        subject="Your Invisiko account is ready",
        body="\n\n".join(
            [
                f"Hello {user.first_name or user.email},",
                (
                    f"An account has been created for you{where}. "
                    "Use the link below to choose your password, then sign in."
                ),
                build_password_link(user),
                (
                    "The link expires in a few hours and can only be used once. "
                    "If it has expired, use 'Forgot password?' on the sign-in "
                    "screen to get a new one."
                ),
            ]
        ),
        recipient=user.email,
    )
