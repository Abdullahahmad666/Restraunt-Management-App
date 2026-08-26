"""Populate a development database with data you can click around in.

Deliberately NOT a migration. Migrations run in production; this must not.
Reference data that the application genuinely depends on - the standard set of
food-safety check types, for instance - belongs in a data migration instead.

    python manage.py seed_demo
    python manage.py seed_demo --reset    # delete what a previous run created

Nothing is seeded yet: the attendance and compliance models do not exist. The
command is here so there is one obvious place for it, and so the production
guard below is in place before anyone is tempted to write seeding logic
somewhere less safe.
"""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction


class Command(BaseCommand):
    help = "Seed the local database with demo data. Development only."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Remove previously seeded demo data before seeding.",
        )

    def handle(self, *args, **options):
        # Checked before anything opens a database connection, so the refusal is
        # what you see even when the database is unreachable. Fake staff and fake
        # temperature readings in a real compliance database would be a serious
        # problem, not an inconvenience.
        if not settings.DEBUG:
            raise CommandError(
                "seed_demo refuses to run with DEBUG=False. This command is for "
                "local development only."
            )

        self._seed(reset=options["reset"])

    @transaction.atomic
    def _seed(self, *, reset: bool) -> None:
        """All or nothing: a half-seeded database is worse than an empty one."""
        if reset:
            self.stdout.write("Nothing to reset yet.")

        self.stdout.write(
            self.style.WARNING(
                "seed_demo is a placeholder - no models to seed yet.\n"
                "Add seeding here as the attendance and compliance models land."
            )
        )
