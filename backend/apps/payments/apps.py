from django.apps import AppConfig


class PaymentsConfig(AppConfig):
    """Bills, payments and refunds."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.payments"
