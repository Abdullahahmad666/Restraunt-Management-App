"""Drain the job queue. This is the worker process.

    python manage.py run_jobs              # loop forever (the Render worker)
    python manage.py run_jobs --once       # drain what is due, then exit

Runs as its own Render service so a slow job never occupies a web worker.
Several copies can run at once: SELECT FOR UPDATE SKIP LOCKED means two
workers never take the same row.
"""

import signal
import time

from django.core.management.base import BaseCommand

from apps.jobs.registry import registered_kinds
from apps.jobs.services import queue

#: How often to look for jobs abandoned by a worker that died.
REAP_EVERY_SECONDS = 60

#: Idle sleep is spent in slices this long so a SIGTERM is acted on promptly
#: rather than after a full poll interval.
SLEEP_SLICE_SECONDS = 0.5


class Command(BaseCommand):
    help = "Run queued background jobs."

    def add_arguments(self, parser):
        parser.add_argument(
            "--once",
            action="store_true",
            help="Run every job that is due, then exit instead of looping.",
        )
        parser.add_argument(
            "--interval",
            type=float,
            default=5.0,
            help="Seconds to wait before polling again when the queue is empty.",
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._stopping = False

    def _request_stop(self, signum, frame):
        # Render sends SIGTERM and then waits before killing the container.
        # Setting a flag rather than exiting here lets the job in flight finish
        # - a job interrupted mid-write is the one case retries handle badly.
        self._stopping = True
        self.stdout.write(self.style.WARNING("\nStop requested - finishing current job."))

    def _sleep(self, seconds: float) -> None:
        deadline = time.monotonic() + seconds
        while not self._stopping and time.monotonic() < deadline:
            time.sleep(min(SLEEP_SLICE_SECONDS, deadline - time.monotonic()))

    def handle(self, *args, **options):
        once = options["once"]
        interval = options["interval"]

        signal.signal(signal.SIGTERM, self._request_stop)
        signal.signal(signal.SIGINT, self._request_stop)

        kinds = registered_kinds()
        self.stdout.write(f"Handlers registered: {', '.join(kinds) if kinds else 'none'}")

        processed = 0
        last_reap = 0.0

        while not self._stopping:
            if time.monotonic() - last_reap > REAP_EVERY_SECONDS:
                queue.requeue_stale()
                last_reap = time.monotonic()

            if queue.run_next():
                processed += 1
                continue

            if once:
                break
            self._sleep(interval)

        self.stdout.write(self.style.SUCCESS(f"Ran {processed} job(s)."))
