"""Letting the phone put an invoice into S3 without it passing through here.

A 15MB PDF uploaded the ordinary way is read into a gunicorn worker, buffered,
and written out again - one request holding a worker for the length of a
mobile upload. Handing the phone a pre-signed URL means the bytes go straight
to S3 and this service only ever sees the key.

The exchange is three calls, and the middle one does not touch us:

    POST invoice-scans/upload-url/    -> a row, plus where to put the file
    POST <the returned url>           -> phone to S3, directly
    POST invoice-scans/{id}/uploaded/ -> we check it landed, then queue the read

The third call is not optional bookkeeping. S3 does not tell us when an upload
finishes, so without it an invoice would sit forever holding a file nobody
ever reads.
"""

import contextlib
import uuid
from pathlib import PurePosixPath

import boto3
from botocore.exceptions import ClientError
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from .scanning import MAX_FILE_BYTES, SUPPORTED_TYPES

#: Long enough for a slow phone on mobile data, short enough that a leaked URL
#: is worth little. The client asks for a fresh one rather than keeping this.
UPLOAD_URL_EXPIRY_SECONDS = 15 * 60

UPLOAD_PREFIX = "invoice_scans"

_EXTENSION_BY_TYPE = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def direct_upload_available() -> bool:
    """False in development, where uploads go to local disk and there is no
    bucket to sign against. The ordinary multipart endpoint still works."""
    return bool(settings.AWS_STORAGE_BUCKET_NAME)


def _client():
    if not direct_upload_available():
        raise ImproperlyConfigured("Direct upload needs AWS_STORAGE_BUCKET_NAME.")
    return boto3.client(
        "s3",
        region_name=settings.AWS_S3_REGION_NAME or None,
        aws_access_key_id=settings.AWS_S3_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.AWS_S3_SECRET_ACCESS_KEY or None,
    )


def build_key(content_type: str) -> str:
    """A key nobody can guess and nobody can collide with.

    Deliberately not derived from the uploaded filename: two phones both
    sending "invoice.jpg" must not land on the same object, and a filename
    from a client is not something to build a path out of.
    """
    extension = _EXTENSION_BY_TYPE.get(content_type, "")
    return f"{UPLOAD_PREFIX}/{uuid.uuid4()}{extension}"


def presign_upload(*, key: str, content_type: str) -> dict:
    """Where to send the file, and what to send with it.

    A POST policy rather than a signed PUT, because the policy carries
    conditions S3 enforces itself: a PUT URL would let anyone holding it store
    a file of any size, and we would only find out afterwards.
    """
    client = _client()
    return client.generate_presigned_post(
        Bucket=settings.AWS_STORAGE_BUCKET_NAME,
        Key=key,
        Fields={"Content-Type": content_type},
        Conditions=[
            {"Content-Type": content_type},
            ["content-length-range", 1, MAX_FILE_BYTES],
        ],
        ExpiresIn=UPLOAD_URL_EXPIRY_SECONDS,
    )


class UploadNotFound(Exception):
    """Nothing is at that key - the upload never happened, or it failed."""


class UploadRejected(Exception):
    """Something is there, but not something we will read. The message is safe
    to show a user."""


def verify_upload(*, key: str) -> tuple[int, str]:
    """Confirm the object exists and is worth spending a scan on.

    Returns its size and content type. The client tells us it finished; this
    is what makes that claim checkable, so a caller cannot queue an expensive
    read of a file that was never uploaded.
    """
    client = _client()
    try:
        head = client.head_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=key)
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") in {"404", "NoSuchKey", "NotFound"}:
            raise UploadNotFound(key) from exc
        raise

    size = head.get("ContentLength", 0)
    content_type = head.get("ContentType", "")

    if size <= 0:
        raise UploadRejected("That upload is empty - please try again.")
    if size > MAX_FILE_BYTES:
        raise UploadRejected(
            f"That file is too large - upload one under {MAX_FILE_BYTES // (1024 * 1024)}MB."
        )
    if content_type not in SUPPORTED_TYPES:
        raise UploadRejected(
            "That file cannot be read - upload a photo (JPEG, PNG or WebP) or a PDF."
        )

    return size, content_type


def delete_object(*, key: str) -> None:
    """Drop an object we have decided not to keep.

    Best effort on purpose - the caller is already returning an error to the
    user, and failing to tidy up should not replace that with a worse one. A
    bucket lifecycle rule is what actually guarantees abandoned uploads go
    away; this just saves waiting for it.
    """
    with contextlib.suppress(ClientError, ImproperlyConfigured):
        _client().delete_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=key)


def key_for(name: str) -> str:
    """The stored FileField name as an S3 key. They are the same string today;
    this is the one place to change if a MEDIA prefix is ever introduced."""
    return str(PurePosixPath(name))
