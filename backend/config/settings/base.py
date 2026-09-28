"""
Settings shared by every environment.

Environment-specific modules (development / production / test) do `from .base
import *` and override what they need. Never hardcode a secret here - read it
from the environment via django-environ.
"""

from datetime import timedelta
from pathlib import Path

import environ

# backend/config/settings/base.py -> backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, []),
    CORS_ALLOWED_ORIGINS=(list, []),
)
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env("ALLOWED_HOSTS")

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "corsheaders",
    "drf_spectacular",
]

LOCAL_APPS = [
    "apps.common",
    "apps.users",
    "apps.restaurants",
    "apps.equipment",
    # Task 1 - staff time tracking
    "apps.attendance",
    "apps.payroll",
    # Task 2 - food safety compliance
    "apps.compliance",
    # Task 3 - stock items and scanned-invoice deliveries
    "apps.inventory",
    # Cross-cutting
    "apps.notifications",
    "apps.audit",
    # Background work. Listed last so every app's jobs.py is importable by the
    # time JobsConfig.ready() autodiscovers handlers.
    "apps.jobs",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    # WhiteNoise is inserted here by production.py - in development the
    # staticfiles app serves assets and collectstatic has not been run.
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
DATABASES = {"default": env.db("DATABASE_URL")}
# Wrap every request in a transaction. Cheap insurance for an ordering system.
DATABASES["default"]["ATOMIC_REQUESTS"] = True
DATABASES["default"]["CONN_MAX_AGE"] = env.int("CONN_MAX_AGE", default=60)

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "users.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------------------
# I18N / timezone
# ---------------------------------------------------------------------------
# The restaurant is UK-only (see TIME_ZONE default's counterpart in
# render.yaml) - en-gb rather than en-us mainly matters for how Django
# admin renders/parses dates (31/12/2026, not 12/31/2026).
LANGUAGE_CODE = "en-gb"
TIME_ZONE = env("TIME_ZONE", default="UTC")
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static / media
# ---------------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

# Uploaded files - invoice photos, fridge photos, profile pictures - go to S3
# whenever a bucket is configured, and to local disk when one is not.
#
# Local disk is fine for development and wrong everywhere else: MEDIA_ROOT
# lives inside the container, so a deploy rebuilds it empty and every upload
# is gone. The database keeps a perfectly healthy row - ImageField stores a
# path, never the bytes - pointing at a file that no longer exists. Production
# refuses to boot without a bucket for exactly that reason; see
# config/settings/production.py.
AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME", default="")
AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default="")
AWS_S3_ACCESS_KEY_ID = env("AWS_S3_ACCESS_KEY_ID", default="")
AWS_S3_SECRET_ACCESS_KEY = env("AWS_S3_SECRET_ACCESS_KEY", default="")

if AWS_STORAGE_BUCKET_NAME:
    STORAGES["default"] = {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "bucket_name": AWS_STORAGE_BUCKET_NAME,
            "region_name": AWS_S3_REGION_NAME,
            "access_key": AWS_S3_ACCESS_KEY_ID,
            "secret_key": AWS_S3_SECRET_ACCESS_KEY,
            "signature_version": "s3v4",
            # Signed, expiring URLs rather than public objects. An invoice
            # photo shows a supplier's pricing and a profile picture is
            # personal - neither should be readable by anyone who guesses a
            # key. The app must therefore use URLs fresh from the API rather
            # than caching them past the expiry below.
            "querystring_auth": True,
            "querystring_expire": 3600,
            # Two uploads that happen to share a filename are two files, not
            # one silently overwriting the other - Django suffixes instead.
            "file_overwrite": False,
            # Modern buckets have ACLs disabled (Object Ownership: bucket
            # owner enforced); sending one is rejected outright.
            "default_acl": None,
        },
    }

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    # Deny by default. Public endpoints opt out explicitly with AllowAny.
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
        "rest_framework.filters.SearchFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "apps.common.pagination.DefaultPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": ("rest_framework.throttling.ScopedRateThrottle",),
    "DEFAULT_THROTTLE_RATES": {
        "login": "10/min",
        "register": "5/hour",
        # Deliberately tight: this endpoint sends mail to an address the
        # caller supplies, so a loose limit makes it a spam relay.
        "password_reset": "5/hour",
        # Invoice scanning is the only endpoint here that costs money per
        # call, and every staff account can reach it.
        "invoice_scan": "40/hour",
        # Looser than the others: the join screen calls this on every load,
        # including re-opens, so it needs headroom register/login don't.
        "invite_lookup": "30/min",
    },
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env.int("ACCESS_TOKEN_MINUTES", default=30)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env.int("REFRESH_TOKEN_DAYS", default=7)),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Restaurant Management API",
    "DESCRIPTION": "Backend API for the restaurant management mobile app.",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    # Several models each have their own "status" choices field. Without this,
    # drf-spectacular can't tell them apart and auto-suffixes the schema
    # component names (e.g. "StatusE7bEnum") - give each a stable, readable
    # name instead.
    "ENUM_NAME_OVERRIDES": {
        "AttendanceLogStatusEnum": "apps.attendance.models.ATTENDANCE_LOG_STATUS_CHOICES",
        "ShiftJobTitleEnum": "apps.attendance.models.SHIFT_JOB_TITLE_CHOICES",
        "ShiftSwapStatusEnum": "apps.attendance.models.SHIFT_SWAP_STATUS_CHOICES",
        "PayPeriodStatusEnum": "apps.payroll.models.PAY_PERIOD_STATUS_CHOICES",
        "NotificationStatusEnum": "apps.notifications.models.NOTIFICATION_STATUS_CHOICES",
        "ComplianceRoutineEnum": "apps.compliance.models.COMPLIANCE_ROUTINE_CHOICES",
        "FridgeUnitKindEnum": "apps.compliance.models.FRIDGE_UNIT_KIND_CHOICES",
        "ChecklistFrequencyEnum": "apps.compliance.models.CHECKLIST_FREQUENCY_CHOICES",
        "StockMovementReasonEnum": "apps.inventory.models.STOCK_MOVEMENT_REASON_CHOICES",
        "InvoiceScanStatusEnum": "apps.inventory.models.INVOICE_SCAN_STATUS_CHOICES",
        "InvoiceScanStateEnum": "apps.inventory.models.INVOICE_SCAN_STATE_CHOICES",
        "InvoiceDocumentTypeEnum": "apps.inventory.models.INVOICE_DOCUMENT_TYPE_CHOICES",
    },
}

# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------
#: The address outgoing mail is sent FROM - one account belonging to the app,
#: not anything a user supplies. Gmail's SMTP will only accept a From that
#: matches the authenticated EMAIL_HOST_USER (or one of its verified aliases);
#: anything else is rewritten or rejected, so keep the two in step.
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="Invisiko <no-reply@invisiko.app>")

#: Where a password-reset email points. The mobile app registers the `invisiko`
#: scheme, so this opens the reset screen directly rather than a web page.
PASSWORD_RESET_URL = env("PASSWORD_RESET_URL", default="invisiko://reset-password")

#: Where a staff invite link points. An admin shares this (via WhatsApp, SMS,
#: whatever) rather than reading a code aloud - see InviteCodeSerializer.
INVITE_URL = env("INVITE_URL", default="invisiko://join")

CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {"format": "%(levelname)s %(asctime)s %(name)s %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "verbose"},
    },
    "root": {"handlers": ["console"], "level": env("LOG_LEVEL", default="INFO")},
    "loggers": {
        # These three are extraordinarily chatty at DEBUG - a single S3 upload
        # writes a hundred lines about event hooks and signature calculation,
        # which buries the traceback you turned DEBUG on to read. Pinned at
        # INFO so LOG_LEVEL=DEBUG stays usable for our own code.
        "botocore": {"level": "INFO"},
        "boto3": {"level": "INFO"},
        "s3transfer": {"level": "INFO"},
        "urllib3": {"level": "INFO"},
        # Same story: it logs every locale lookup for every provider on import.
        "faker": {"level": "INFO"},
    },
}

# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------
MAILERS = {
    "default": {
        "BACKEND": "django.core.mail.backends.smtp.EmailBackend",
        # Django 6.1's MAILERS reads backend kwargs from OPTIONS (lowercase
        # keys matching EmailBackend.__init__), not top-level uppercase ones -
        # those are silently dropped, leaving host=None and an InvalidMailer
        # the moment anything actually tries to send.
        "OPTIONS": {
            "host": env("EMAIL_HOST", default=""),
            "port": env.int("EMAIL_PORT", default=587),
            "use_tls": env.bool("EMAIL_USE_TLS", default=True),
            "username": env("EMAIL_HOST_USER", default=""),
            "password": env("EMAIL_HOST_PASSWORD", default=""),
            # Without this, a host that silently drops outbound SMTP (Render's
            # free tier, notably - see render.yaml) hangs the connection
            # attempt until gunicorn's own worker timeout kills the whole
            # request at 30s. A short, explicit timeout turns that into a
            # fast, specific failure instead.
            "timeout": env.int("EMAIL_TIMEOUT", default=10),
        },
    }
}
GOOGLE_CLIENT_ID = env("GOOGLE_CLIENT_ID", default="")

# Invoice extraction. Blank in an environment that has not set one up -
# uploads still save and scanning fails with a friendly error rather than a
# raw auth failure.
OPENAI_API_KEY = env("OPENAI_API_KEY", default="")
# Configurable so a model can be changed, or rolled back, without a deploy of
# new code - the one setting here most likely to need moving in a hurry.
OPENAI_MODEL = env("OPENAI_MODEL", default="gpt-6-luna")

# Invoices one restaurant may have read per calendar month. 0 means no
# ceiling, which is the default: a limit nobody chose would refuse real work
# on the day it was hit. Set one and a bad afternoon costs a known amount.
INVOICE_SCAN_MONTHLY_CAP = env.int("INVOICE_SCAN_MONTHLY_CAP", default=0)
