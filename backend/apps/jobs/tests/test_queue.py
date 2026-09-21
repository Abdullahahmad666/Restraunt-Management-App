"""The queue's job is to run each piece of work exactly once, and to survive a
worker dying mid-flight. These cover both."""

import threading
from datetime import timedelta

import pytest
from django.db import connection, connections
from django.utils import timezone

from apps.jobs import registry
from apps.jobs.models import Job
from apps.jobs.services import queue


@pytest.fixture
def handler():
    """Register a handler that records its calls, and unregister it after.

    The registry is module-level state, so a test that leaves an entry behind
    changes what a later test sees.
    """
    calls = []

    @registry.job("tests.record")
    def _record(**kwargs):
        calls.append(kwargs)

    yield calls
    registry._HANDLERS.pop("tests.record", None)


@pytest.fixture
def failing_handler():
    attempts = []

    @registry.job("tests.explode")
    def _explode(**kwargs):
        attempts.append(kwargs)
        raise RuntimeError("nope")

    yield attempts
    registry._HANDLERS.pop("tests.explode", None)


@pytest.mark.django_db
def test_enqueue_rejects_a_kind_nothing_handles():
    """A typo should fail where it is written, not queue work nobody runs."""
    with pytest.raises(LookupError):
        queue.enqueue(kind="tests.does-not-exist")

    assert not Job.objects.exists()


@pytest.mark.django_db
def test_run_next_passes_the_payload_as_kwargs(handler):
    queue.enqueue(kind="tests.record", payload={"invoice_id": "abc", "count": 2})

    assert queue.run_next() is True

    assert handler == [{"invoice_id": "abc", "count": 2}]
    job = Job.objects.get()
    assert job.status == Job.Status.SUCCEEDED
    assert job.attempts == 1
    assert job.finished_at is not None


@pytest.mark.django_db
def test_run_next_reports_an_empty_queue(handler):
    assert queue.run_next() is False


@pytest.mark.django_db
def test_a_job_scheduled_for_later_is_not_claimed_yet(handler):
    queue.enqueue(kind="tests.record", run_after=timezone.now() + timedelta(minutes=5))

    assert queue.run_next() is False
    assert Job.objects.get().status == Job.Status.QUEUED


@pytest.mark.django_db
def test_failure_retries_with_backoff_then_gives_up(failing_handler):
    queue.enqueue(kind="tests.explode", max_attempts=2)

    # A failed job still counts as work processed - the worker should move on
    # rather than sleep - so run_next reports True either way. The outcome is
    # on the row.
    assert queue.run_next() is True
    job = Job.objects.get()
    assert job.status == Job.Status.QUEUED
    assert job.attempts == 1
    assert job.run_after > timezone.now()
    assert "RuntimeError" in job.error

    # Claim it anyway by making it due, and let the last attempt run out.
    Job.objects.update(run_after=timezone.now())
    assert queue.run_next() is True

    job.refresh_from_db()
    assert job.status == Job.Status.FAILED
    assert job.attempts == 2
    assert len(failing_handler) == 2


@pytest.mark.django_db
def test_backoff_grows_and_is_capped():
    assert queue._backoff_for(1) == timedelta(minutes=1)
    assert queue._backoff_for(2) == timedelta(minutes=2)
    assert queue._backoff_for(3) == timedelta(minutes=4)
    assert queue._backoff_for(99) == queue.BACKOFF_CEILING


@pytest.mark.django_db
def test_requeue_stale_recovers_a_job_whose_worker_died(handler):
    queue.enqueue(kind="tests.record")
    job = queue.claim_next()
    assert job.status == Job.Status.RUNNING

    # The worker never came back - a deploy restarted it mid-job.
    Job.objects.update(started_at=timezone.now() - timedelta(hours=1))

    assert queue.requeue_stale() == 1
    job.refresh_from_db()
    assert job.status == Job.Status.QUEUED
    assert job.started_at is None
    # The consumed attempt still counts, so a job that reliably kills its
    # worker stops rather than cycling forever.
    assert job.attempts == 1


@pytest.mark.django_db
def test_requeue_stale_fails_a_job_with_no_attempts_left(handler):
    queue.enqueue(kind="tests.record", max_attempts=1)
    queue.claim_next()
    Job.objects.update(started_at=timezone.now() - timedelta(hours=1))

    assert queue.requeue_stale() == 0
    assert Job.objects.get().status == Job.Status.FAILED


@pytest.mark.django_db
def test_a_running_job_is_not_claimed_twice(handler):
    queue.enqueue(kind="tests.record")

    first = queue.claim_next()
    second = queue.claim_next()

    assert first is not None
    assert second is None


@pytest.mark.django_db(transaction=True)
def test_concurrent_workers_never_claim_the_same_job(handler):
    """The reason for SELECT FOR UPDATE SKIP LOCKED.

    Runs real threads on real connections - the in-transaction test database
    the other cases use cannot show two workers competing.
    """
    job_count = 8
    for index in range(job_count):
        queue.enqueue(kind="tests.record", payload={"index": index})

    claimed: list[Job] = []
    lock = threading.Lock()

    def worker():
        try:
            while True:
                job = queue.claim_next()
                if job is None:
                    return
                with lock:
                    claimed.append(job)
        finally:
            # Each thread opens its own connection; leaving them open keeps the
            # test database from being torn down.
            connections.close_all()

    threads = [threading.Thread(target=worker) for _ in range(4)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)

    assert all(not thread.is_alive() for thread in threads), "a worker thread hung"

    claimed_ids = [job.id for job in claimed]
    assert len(claimed_ids) == job_count, "some jobs were never claimed"
    assert len(set(claimed_ids)) == job_count, "the same job was claimed twice"
    assert Job.objects.filter(status=Job.Status.RUNNING).count() == job_count

    Job.objects.all().delete()
    connection.close()
