from django.apps import AppConfig


class InventoryConfig(AppConfig):
    """Stock items, suppliers and stock movements."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.inventory"
