"""Local development settings. Never used in a deployed environment."""

from .base import *  # noqa: F403
from .base import REST_FRAMEWORK  # noqa: F401

DEBUG = True

# 10.0.2.2 is how the Android emulator reaches the host machine.
ALLOWED_HOSTS = ["*"]  # local: see fix/abdullah-dev-allowed-hosts

# The browsable API is useful while wiring up the mobile client.
REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = (
    "rest_framework.renderers.JSONRenderer",
    "rest_framework.renderers.BrowsableAPIRenderer",
)

# Django 6.1+ configures mail through MAILERS, not EMAIL_BACKEND.
MAILERS = {"default": {"BACKEND": "django.core.mail.backends.console.EmailBackend"}}

# Metro and the RN dev client use ephemeral ports, so pinning origins locally
# is more trouble than it is worth.
CORS_ALLOW_ALL_ORIGINS = True
