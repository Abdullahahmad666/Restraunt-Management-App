"""Notify staff whose shift starts, or ends, in about 15 minutes.

Run once a minute via cron / Windows Task Scheduler:

    python manage.py send_shift_reminders
"""

from django.core.management.base import BaseCommand

from apps.notifications.services import rules


class Command(BaseCommand):
    help = "Send shift-starting-soon and shift-ending-soon reminders."

    def handle(self, *args, **options):
        starting = rules.send_upcoming_shift_reminders()
        ending = rules.send_ending_shift_reminders()
        self.stdout.write(
            self.style.SUCCESS(
                f"Sent {starting} shift-starting reminder(s), {ending} shift-ending reminder(s)."
            )
        )
