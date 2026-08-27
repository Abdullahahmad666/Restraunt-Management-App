"""Auto-close attendance logs left open long past a plausible shift length.

Run periodically (e.g. hourly) via cron / Windows Task Scheduler:

    python manage.py close_stale_attendance
"""

from django.core.management.base import BaseCommand

from apps.attendance.services import reconciliation


class Command(BaseCommand):
    help = "Auto-close stale open attendance logs."

    def handle(self, *args, **options):
        closed = reconciliation.auto_close_stale_logs()
        self.stdout.write(self.style.SUCCESS(f"Auto-closed {closed} stale attendance log(s)."))
