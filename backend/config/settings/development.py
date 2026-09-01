"""Local development settings. Never used in a deployed environment."""

from .base import *  # noqa: F403
from .base import REST_FRAMEWORK  # noqa: F401

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

# Django 6.1+ configures mail through MAILERS, not EMAIL_BACKEND.

# Metro and the RN dev client use ephemeral ports, so pinning origins locally
# is more trouble than it is worth.
CORS_ALLOW_ALL_ORIGINS = True
