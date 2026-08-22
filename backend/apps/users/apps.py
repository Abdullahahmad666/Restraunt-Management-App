from django.apps import AppConfig


class UsersConfig(AppConfig):
    """Accounts, roles and authentication."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.users"
