from django.apps import AppConfig


class AuditConfig(AppConfig):
    """Append-only record of everything, for inspection."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.audit"
