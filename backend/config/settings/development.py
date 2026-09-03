"""Local development settings. Never used in a deployed environment."""

from .base import *  # noqa: F403
from .base import REST_FRAMEWORK, env  # noqa: F401

DEBUG = True

# Any host. Every developer's machine has a different LAN address, and a phone
# running the app has to reach the API by that address - so a hardcoded list
# means each person edits this file, and the ALLOWED_HOSTS they set in .env was
# being silently ignored.
#
# Safe only because this module is never used in a deployed environment:
# production.py reads ALLOWED_HOSTS from the environment and never widens it.
ALLOWED_HOSTS = ["*"]

# The browsable API is useful while wiring up the mobile client.
REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = (
    "rest_framework.renderers.JSONRenderer",
    "rest_framework.renderers.BrowsableAPIRenderer",
)

# Django 6.1+ configures mail through MAILERS, not EMAIL_BACKEND. base.py
# already points this at real SMTP driven by EMAIL_HOST/etc in .env, which is
# fine here too - only fall back to the console backend (prints instead of
# sending) when a developer hasn't put SMTP credentials in their own .env, so
# nobody without Gmail credentials gets InvalidMailer the moment anything
# tries to send an email (registration, password reset).
if not env("EMAIL_HOST", default=""):
    MAILERS = {"default": {"BACKEND": "django.core.mail.backends.console.EmailBackend"}}

# Metro and the RN dev client use ephemeral ports, so pinning origins locally
# is more trouble than it is worth.
CORS_ALLOW_ALL_ORIGINS = True
