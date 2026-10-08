"""How uploads are addressed in S3, which is not something a request will tell you.

The bug this guards against produced a 403 SignatureDoesNotMatch on every
signed URL the API handed out - avatars, fridge photos, invoice images - while
uploads kept succeeding and the objects sat in the bucket perfectly intact. It
reads like a credentials problem and is not one: boto3 signed for the
configured region but addressed the bucket at S3's global endpoint, S3
redirected to the regional host, and the Host header SigV4 had signed changed
underneath the request.

Nothing in the test suite would have caught it - tests force local storage so
they never touch the bucket - so this checks the settings themselves, by
running the module the way a deploy would.
"""

import os
import runpy
from pathlib import Path
from unittest import mock

import pytest
from django.core.exceptions import ImproperlyConfigured

SETTINGS = Path(__file__).resolve().parents[3] / "config" / "settings" / "base.py"

BUCKET = {
    "AWS_STORAGE_BUCKET_NAME": "test-bucket",
    "AWS_S3_REGION_NAME": "us-west-2",
    "AWS_S3_ACCESS_KEY_ID": "AKIATESTTESTTEST",
    "AWS_S3_SECRET_ACCESS_KEY": "secret",
}


def build(**overrides):
    """Execute the settings module in a fresh namespace, as a boot would.

    `clear=False` keeps DJANGO_SECRET_KEY and the rest of the environment
    intact; read_env does not overwrite variables that are already set, so
    these overrides win over whatever is in a local .env.
    """
    with mock.patch.dict(os.environ, overrides, clear=False):
        return runpy.run_path(str(SETTINGS))


def test_the_region_is_in_the_endpoint_not_only_the_signature():
    options = build(**BUCKET)["STORAGES"]["default"]["OPTIONS"]

    # Both halves matter. The endpoint alone still addresses the bucket by
    # path at the regional host; virtual addressing alone leaves boto3 free to
    # fall back to the global one.
    assert options["endpoint_url"] == "https://s3.us-west-2.amazonaws.com"
    assert options["addressing_style"] == "virtual"
    assert options["region_name"] == "us-west-2"


def test_a_bucket_without_a_region_is_refused_rather_than_half_configured():
    # Left to itself this builds https://s3..amazonaws.com and fails on every
    # request with an error that never mentions the missing setting.
    with pytest.raises(ImproperlyConfigured, match="AWS_S3_REGION_NAME"):
        build(**{**BUCKET, "AWS_S3_REGION_NAME": ""})


def test_no_bucket_means_local_disk():
    storages = build(AWS_STORAGE_BUCKET_NAME="")["STORAGES"]

    assert storages["default"]["BACKEND"] == "django.core.files.storage.FileSystemStorage"
