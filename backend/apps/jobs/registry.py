"""Maps a Job.kind string to the function that runs it.

A handler is registered by decorating it:

    from apps.jobs.registry import job

    @job("inventory.scan_invoice")
    def scan_invoice(*, invoice_id: str) -> None:
        ...

The decorated function is called with the job's payload as keyword arguments.
It signals failure by raising; returning is success. Handlers must be
idempotent - a job that times out mid-flight is retried, and "already done" has
to be a no-op rather than a double-count.

Handlers live in `<app>/jobs.py` and are imported automatically at startup by
JobsConfig.ready(), the same way Django finds admin modules. A `kind` whose
module is never imported is a job that queues forever and never runs, so the
autodiscovery is the point rather than a convenience.
"""

from collections.abc import Callable

from django.core.exceptions import ImproperlyConfigured

_HANDLERS: dict[str, Callable] = {}
_FAILURE_HANDLERS: dict[str, Callable] = {}


def job(kind: str, *, on_permanent_failure: Callable | None = None) -> Callable:
    """Register the decorated function as the handler for `kind`.

    `on_permanent_failure` is called with the same payload once the queue has
    given up - the last attempt has been used, or a worker died with none
    left. Without it, whatever the job was meant to update keeps whatever
    in-progress state it was put into, and anything watching that state waits
    forever for an answer that is never coming.
    """

    def decorator(func: Callable) -> Callable:
        if on_permanent_failure is not None:
            _FAILURE_HANDLERS[kind] = on_permanent_failure
        existing = _HANDLERS.get(kind)
        # Django imports a module once, but a stale .pyc or a module reachable
        # by two import paths has bitten people here. Registering the same
        # function twice is harmless; two different functions under one kind
        # means one of them silently never runs.
        if existing is not None and existing is not func:
            raise ImproperlyConfigured(
                f"Two handlers are registered for job kind {kind!r}: "
                f"{existing.__module__}.{existing.__qualname__} and "
                f"{func.__module__}.{func.__qualname__}."
            )
        _HANDLERS[kind] = func
        return func

    return decorator


def handler_for(kind: str) -> Callable:
    """Return the handler for `kind`, or raise if nothing claims it."""
    try:
        return _HANDLERS[kind]
    except KeyError:
        raise LookupError(
            f"No handler registered for job kind {kind!r}. "
            f"Registered kinds: {sorted(_HANDLERS) or 'none'}."
        ) from None


def failure_handler_for(kind: str) -> Callable | None:
    """What to run when the queue gives up on `kind`, if anything does."""
    return _FAILURE_HANDLERS.get(kind)


def registered_kinds() -> list[str]:
    return sorted(_HANDLERS)
