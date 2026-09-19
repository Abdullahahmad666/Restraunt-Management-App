from django.apps import AppConfig


class InventoryConfig(AppConfig):
    """Stock items, what moved them, and the invoices staff scan to record deliveries."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.inventory"
