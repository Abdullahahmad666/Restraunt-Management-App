"""Deployed settings. Everything sensitive comes from the environment."""

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403
from .base import AWS_STORAGE_BUCKET_NAME, MIDDLEWARE, REST_FRAMEWORK, STORAGES, env

DEBUG = False

# Refuse to boot without object storage rather than accept uploads onto a
# filesystem the next deploy throws away. Failing here is loud and immediate;
# the alternative fails weeks later as a gallery of broken images nobody can
# get back. The Dockerfile passes a placeholder on its collectstatic line so
# the image still builds - collectstatic only writes the staticfiles backend,
# never this one.
if not AWS_STORAGE_BUCKET_NAME:
    raise ImproperlyConfigured(
        "AWS_STORAGE_BUCKET_NAME is required in production - uploads would "
        "otherwise be written to the container filesystem and lost on the "
        "next deploy."
    )

# Serve collected static files straight from gunicorn. Good enough until there
# is a CDN in front; swap the staticfiles STORAGES entry when there is.
#
# WhiteNoise must sit immediately after SecurityMiddleware, so insert by name
# rather than by index - a future middleware addition would silently shift it.
_security = MIDDLEWARE.index("django.middleware.security.SecurityMiddleware")
MIDDLEWARE = [
    *MIDDLEWARE[: _security + 1],
    "whitenoise.middleware.WhiteNoiseMiddleware",
    *MIDDLEWARE[_security + 1 :],
]

STORAGES = {
    **STORAGES,
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = ("rest_framework.renderers.JSONRenderer",)

SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 365
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
X_FRAME_OPTIONS = "DENY"

CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])
