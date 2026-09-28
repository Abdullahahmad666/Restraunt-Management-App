"""runserver should restart when .env changes, not only when code does.

Worth a test because the failure is silent in both directions. If the hook
stops working, a running server quietly keeps stale settings and the only
symptom is a default value turning up where a configured one belongs. If it is
wired to a method the reloader does not have, runserver dies on startup - which
is how this was first written, against an API that no longer exists.
"""

from django.conf import settings
from django.utils.autoreload import StatReloader, autoreload_started


def test_the_env_file_is_watched():
    """Sends the real signal to Django's real reloader.

    Deliberately not a stub with a watch_file() method on it: a fake that
    provides the very call being tested passes whether or not the reloader
    actually offers it, which is exactly how the broken version got committed.
    """
    reloader = StatReloader()

    autoreload_started.send(sender=reloader)

    watched = {str(path) for path in reloader.watched_files()}
    assert str(settings.BASE_DIR / ".env") in watched
