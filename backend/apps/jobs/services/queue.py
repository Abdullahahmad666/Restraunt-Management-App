"""Putting work on the queue, and taking it off again.

The claim is the only interesting part. A worker takes a row with

    SELECT ... FOR UPDATE SKIP LOCKED

inside a short transaction: FOR UPDATE stops two workers taking the same job,
and SKIP LOCKED means the second worker steps over a locked row instead of
blocking behind it. Without SKIP LOCKED a pool of workers serialises into one.

The handler runs *outside* that transaction, deliberately. Invoice scanning
waits on a network call for seconds at a time, and holding a row lock - and a
pooled connection - for its duration would make the queue slower than the
synchronous code it replaces.

The cost of running outside the transaction is that a worker killed mid-job
leaves the row RUNNING forever. `requeue_stale` is what pays it back.
"""

import logging
import traceback
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from ..models import Job
from ..registry import failure_handler_for, handler_for

logger = logging.getLogger(__name__)

#: A job retried immediately would usually just fail again - a rate limit or a
#: provider outage needs time, not another attempt. Doubling per attempt, so
#: 1, 2, 4... minutes.
BACKOFF_BASE = timedelta(minutes=1)
BACKOFF_CEILING = timedelta(minutes=30)

#: A RUNNING row older than this is assumed to belong to a worker that died -
#: Render restarts a service on every deploy, so this is routine, not
#: exceptional. Comfortably longer than the slowest handler.
STALE_AFTER = timedelta(minutes=15)


def enqueue(
    *, kind: str, payload: dict | None = None, max_attempts: int = 3, run_after=None
) -> Job:
    """Queue a job. Raises LookupError if nothing handles `kind`, so a typo
    fails at the call site rather than silently queueing work nobody runs."""
    handler_for(kind)
    return Job.objects.create(
        kind=kind,
        payload=payload or {},
        max_attempts=max_attempts,
        run_after=run_after or timezone.now(),
    )


def _backoff_for(attempts: int) -> timedelta:
    # Clamp the exponent before the shift, not after. max_attempts is a
    # PositiveIntegerField, so a row edited by hand can carry an attempt count
    # that overflows a C int on the way to a value the ceiling would have
    # discarded anyway.
    exponent = min(max(attempts - 1, 0), 16)
    return min(BACKOFF_BASE * (2**exponent), BACKOFF_CEILING)


def claim_next() -> Job | None:
    """Take the next due job and mark it RUNNING, or return None if there is
    nothing to do. The transaction covers only the claim."""
    with transaction.atomic():
        job = (
            Job.objects.select_for_update(skip_locked=True)
            .filter(status=Job.Status.QUEUED, run_after__lte=timezone.now())
            .order_by("run_after", "created_at")
            .first()
        )
        if job is None:
            return None

        job.status = Job.Status.RUNNING
        job.attempts += 1
        job.started_at = timezone.now()
        job.save(update_fields=["status", "attempts", "started_at", "updated_at"])
        return job


def _succeed(job: Job) -> None:
    job.status = Job.Status.SUCCEEDED
    job.finished_at = timezone.now()
    job.save(update_fields=["status", "finished_at", "updated_at"])


def _give_up(job: Job) -> None:
    """Mark the job failed for good, and tell whatever was waiting on it.

    The notification matters more than it looks: a job that gives up silently
    leaves its subject in whatever in-progress state the handler set, and
    anything polling that state waits forever for an answer nobody will send.
    """
    job.status = Job.Status.FAILED
    job.finished_at = timezone.now()
    job.save(update_fields=["status", "error", "finished_at", "updated_at"])
    logger.error("Job %s (%s) failed permanently after %s attempts", job.id, job.kind, job.attempts)

    notify = failure_handler_for(job.kind)
    if notify is None:
        return
    try:
        notify(**job.payload)
    except Exception:  # noqa: BLE001 - a broken notifier must not break the queue
        logger.exception("Failure handler for job %s (%s) raised", job.id, job.kind)


def _fail(job: Job, exc: BaseException) -> None:
    """Back to the queue with a delay while attempts remain, FAILED once they
    run out."""
    job.error = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))[-4000:]

    if job.attempts >= job.max_attempts:
        _give_up(job)
        return

    job.status = Job.Status.QUEUED
    job.run_after = timezone.now() + _backoff_for(job.attempts)
    job.started_at = None
    job.save(update_fields=["status", "error", "run_after", "started_at", "updated_at"])
    logger.warning(
        "Job %s (%s) failed on attempt %s, retrying after %s",
        job.id,
        job.kind,
        job.attempts,
        job.run_after,
    )


def run_job(job: Job) -> bool:
    """Run one already-claimed job. Returns whether it succeeded."""
    try:
        handler = handler_for(job.kind)
        handler(**job.payload)
    except Exception as exc:  # noqa: BLE001 - a handler may raise anything
        _fail(job, exc)
        return False
    _succeed(job)
    return True


def run_next() -> bool:
    """Claim and run one job.

    Returns whether a job was *processed*, not whether it succeeded - a failed
    job is still work done, and the worker should move straight to the next one
    rather than sleep. False means the queue is empty, which is the loop's
    signal to wait.
    """
    job = claim_next()
    if job is None:
        return False
    run_job(job)
    return True


def requeue_stale(*, older_than: timedelta = STALE_AFTER) -> int:
    """Return jobs abandoned by a dead worker to the queue.

    A worker killed mid-job - a deploy, an OOM - leaves its row RUNNING with
    nobody watching it. The attempt it consumed still counts, so a job that
    reliably kills its worker exhausts max_attempts and stops rather than
    cycling forever.
    """
    cutoff = timezone.now() - older_than
    stale = Job.objects.filter(status=Job.Status.RUNNING, started_at__lt=cutoff)

    requeued = 0
    for job in stale:
        if job.attempts >= job.max_attempts:
            job.error = "Worker stopped before this job finished, and no attempts remained."
            _give_up(job)
        else:
            job.status = Job.Status.QUEUED
            job.started_at = None
            job.run_after = timezone.now()
            job.error = "Worker stopped before this job finished; requeued."
            job.save(update_fields=["status", "started_at", "run_after", "error", "updated_at"])
            requeued += 1

    if requeued:
        logger.warning("Requeued %s job(s) abandoned by a stopped worker", requeued)
    return requeued
