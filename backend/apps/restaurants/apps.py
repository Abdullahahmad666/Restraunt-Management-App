from django.apps import AppConfig


class RestaurantsConfig(AppConfig):
    """Restaurants, branches, tables and menus."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.restaurants"
