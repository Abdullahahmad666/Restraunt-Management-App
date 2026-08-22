"""Abstract base models every app builds on."""

import uuid

from django.db import models


class TimeStampedModel(models.Model):
    """Adds self-maintaining created_at / updated_at columns."""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UUIDModel(models.Model):
    """Public-facing primary key.

    Sequential integer ids leak business volume (order #1041 tells a competitor
    how many orders you took). Anything the mobile client references by id
    should inherit from this.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class BaseModel(UUIDModel, TimeStampedModel):
    class Meta:
        abstract = True
