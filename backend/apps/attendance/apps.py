from django.apps import AppConfig


class AttendanceConfig(AppConfig):
    """Barcode check-in/check-out and the attendance log."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.attendance"
