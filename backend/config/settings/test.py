"""Settings used by pytest locally and in CI.

Note there is no DATABASES override here. Tests deliberately run against the
same Postgres as development, inherited from base.py via DATABASE_URL.

We used in-memory sqlite for this once because it made `pytest` zero-setup.
That was the wrong trade for this app: sqlite does not enforce the same
constraints, handles timezone-aware timestamps differently, and has no JSONB.
Attendance and compliance are built almost entirely out of those - shift
boundaries, one-check-per-day uniqueness, temperature readings - so testing on
an engine we do not deploy on would hide exactly the bugs that matter.

pytest-django creates and drops a separate test_<name> database, so running the
suite never touches your development data. It does mean the database has to be
up: `docker compose up -d db` from the repo root.
"""

from .base import *  # noqa: F403

DEBUG = False

# Hashing is deliberately weak here - it is the single biggest cost in a test
# suite that creates users, and nothing in a test database is real.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

MAILERS = {"default": {"BACKEND": "django.core.mail.backends.locmem.EmailBackend"}}
