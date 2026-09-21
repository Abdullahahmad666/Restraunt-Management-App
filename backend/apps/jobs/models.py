"""Work that runs outside the request/response cycle.

One table, claimed by a worker process with SELECT FOR UPDATE SKIP LOCKED.
Postgres is already here and already durable, so a queue built on it needs no
broker, no Redis and no second thing to keep running - which at this size is
worth more than the throughput a dedicated broker would buy.

See apps.jobs.services.queue for how rows are claimed and retried, and
apps.jobs.registry for how a `kind` maps to the function that runs it.
"""

from django.db import models
from django.utils import timezone

from apps.common.models import BaseModel


class Job(BaseModel):
    class Status(models.TextChoices):
        QUEUED = "QUEUED", "Queued"
        RUNNING = "RUNNING", "Running"
        SUCCEEDED = "SUCCEEDED", "Succeeded"
        FAILED = "FAILED", "Failed"

    #: Registry key naming the handler, e.g. "inventory.scan_invoice".
    kind = models.CharField(max_length=100)
    #: Arguments for the handler. Keep it to ids and scalars - a payload that
    #: embeds a copy of a row is a payload that acts on stale data by the time
    #: a retry runs.
    payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.QUEUED)
    attempts = models.PositiveIntegerField(default=0)
    max_attempts = models.PositiveIntegerField(default=3)
    #: Not before this moment. Drives both scheduling and retry backoff.
    run_after = models.DateTimeField(default=timezone.now)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    #: Last failure, kept even after a later attempt succeeds - "it worked on
    #: the third try" is worth knowing.
    error = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            # The claim query filters on exactly this pair and orders by
            # run_after; without it every poll is a sequential scan of a table
            # that only grows.
            models.Index(fields=("status", "run_after"), name="job_claim_idx"),
            models.Index(fields=("kind", "status"), name="job_kind_status_idx"),
        ]

    def __str__(self):
        return f"{self.kind} ({self.status})"

    @property
    def attempts_remaining(self) -> int:
        return max(self.max_attempts - self.attempts, 0)
