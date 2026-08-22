from django.apps import AppConfig


class OrdersConfig(AppConfig):
    """Order capture, line items and status transitions."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.orders"
