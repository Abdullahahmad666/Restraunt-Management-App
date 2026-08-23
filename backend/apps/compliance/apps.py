from django.apps import AppConfig


class ComplianceConfig(AppConfig):
    """Daily food-safety checklists, check results and corrective actions."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.compliance"
