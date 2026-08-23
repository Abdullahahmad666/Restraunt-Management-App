from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    """Alerting managers about missed and failed checks."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.notifications"
