from django.apps import AppConfig


class PayrollConfig(AppConfig):
    """Pay periods, rates and hours-to-pay calculation."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.payroll"
