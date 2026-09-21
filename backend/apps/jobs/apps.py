from django.apps import AppConfig
from django.utils.module_loading import autodiscover_modules


class JobsConfig(AppConfig):
    """Background work: a Postgres-backed queue and the worker that drains it."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.jobs"

    def ready(self):
        # Import every app's jobs.py so its handlers register themselves, the
        # same way Django finds admin modules. A handler whose module is never
        # imported is a job kind that queues forever and never runs.
        autodiscover_modules("jobs")
