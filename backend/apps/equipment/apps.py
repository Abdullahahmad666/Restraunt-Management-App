from django.apps import AppConfig


class EquipmentConfig(AppConfig):
    """Fridges, freezers and probes - what a temperature check is taken of."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.equipment"
