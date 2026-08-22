"""Settings used by pytest locally and in CI."""

from .base import *  # noqa: F403

DEBUG = False

# In-memory sqlite keeps `pytest` zero-setup. CI also runs the suite against
# Postgres via DATABASE_URL - see .github/workflows/backend-ci.yml.
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
MAILERS = {"default": {"BACKEND": "django.core.mail.backends.locmem.EmailBackend"}}
