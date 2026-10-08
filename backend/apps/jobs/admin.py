"""Django-admin registration for the jobs app."""

from django.contrib import admin

from . import models


@admin.register(models.Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ("kind", "status", "attempts", "max_attempts", "run_after", "created_at")
    list_filter = ("status", "kind")
    # Everything here is written by the worker. Editing a row by hand races
    # whatever is draining the queue, so this is a window, not a control panel.
    readonly_fields = (
        "kind",
        "payload",
        "status",
        "attempts",
        "max_attempts",
        "run_after",
        "started_at",
        "finished_at",
        "error",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request):
        return False
