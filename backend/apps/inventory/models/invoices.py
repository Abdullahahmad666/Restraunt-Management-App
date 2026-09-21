"""A staff-uploaded invoice photo, and the line items a vision model read
off it - reviewed and matched by a human before any of it touches stock.
See apps.inventory.services.scanning for how the line items get here, and
apps.inventory.services.stock.confirm_invoice for how they're applied.
"""

from django.conf import settings
from django.db import models

from apps.common.models import BaseModel

from .items import InventoryItem


class InvoiceScan(BaseModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending review"
        CONFIRMED = "CONFIRMED", "Confirmed"
        DISCARDED = "DISCARDED", "Discarded"
        #: The identical file has been uploaded before. Set automatically and
        #: terminal, because identical bytes are not evidence of a second
        #: delivery - they are evidence of the same photo sent twice.
        DUPLICATE = "DUPLICATE", "Duplicate upload"

    class ScanState(models.TextChoices):
        """How far the AI read has got.

        Deliberately separate from `status`, which is the human review
        lifecycle. An invoice can be waiting to be read and waiting to be
        reviewed at the same time, and folding the two into one field makes
        "scanned but not yet reviewed" impossible to express.
        """

        #: A row exists and a key is reserved, but the phone is still sending
        #: the file straight to S3. Only the direct-upload path uses this.
        AWAITING_UPLOAD = "AWAITING_UPLOAD", "Waiting for the file"
        QUEUED = "QUEUED", "Waiting to be read"
        SCANNING = "SCANNING", "Being read"
        DONE = "DONE", "Read"
        FAILED = "FAILED", "Could not be read"

    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="invoice_scans"
    )
    # FileField, not ImageField: suppliers email PDF invoices as often as
    # staff photograph paper ones, and ImageField runs everything through
    # Pillow and rejects anything that is not an image.
    photo = models.FileField(upload_to="invoice_scans/")
    # Recorded at upload because it cannot be recovered afterwards. A file
    # read back out of storage on the worker has no content_type attribute,
    # so deriving it there silently produced "image/jpeg" for everything -
    # survivable while only photos were allowed, wrong for every PDF.
    content_type = models.CharField(max_length=100, blank=True, default="")
    # Who supplied it and where it went. Both nullable and both set by a
    # person: a scan only ever matches a supplier that already exists, because
    # one invented from a misread line is permanent rubbish in every later
    # filter. supplier_name below keeps whatever the scan actually read, which
    # is what the reviewer is shown while picking.
    supplier = models.ForeignKey(
        "inventory.Supplier",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invoices",
    )
    warehouse = models.ForeignKey(
        "inventory.Warehouse",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invoices",
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    scan_state = models.CharField(
        max_length=16, choices=ScanState.choices, default=ScanState.QUEUED
    )
    supplier_name = models.CharField(max_length=200, blank=True, default="")
    invoice_date = models.DateField(null=True, blank=True)
    #: The supplier's own reference. Kept as read, not cleaned up - it is
    #: half of how a re-uploaded invoice is recognised as one we already have.
    invoice_number = models.CharField(max_length=100, blank=True, default="")
    #: SHA-256 of the uploaded file, computed on the worker where both upload
    #: paths converge and the bytes are already in hand. Indexed because every
    #: scan looks the previous ones up by it.
    file_hash = models.CharField(max_length=64, blank=True, default="", db_index=True)
    #: The invoice this one appears to repeat. Set on two different strengths
    #: of evidence - see services.duplicates - and what the reviewer is shown
    #: so they can judge rather than being told.
    duplicate_of = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="duplicates"
    )
    #: Where the invoice says the goods went, as printed. The Warehouse this
    #: resolves to is the FK above; this is the text it was resolved from.
    delivery_location = models.CharField(max_length=200, blank=True, default="")
    #: The invoice's own figures, copied rather than computed. Holding them is
    #: the only way to check the lines against something independent - a total
    #: derived from the same lines it is meant to verify checks nothing.
    stated_subtotal = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    stated_tax = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    stated_total = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    # Set when the scan itself failed (bad photo, the AI service errored) -
    # the scan still exists with zero line items so staff can retry or add
    # lines by hand rather than losing the upload.
    scan_error = models.CharField(max_length=500, blank=True, default="")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"Invoice scan {self.id} ({self.status})"


class InvoiceLineItem(BaseModel):
    """One row the AI read off the invoice - a name, a quantity, and
    whatever price info was legible. `matched_item` starts unset; staff
    pick an existing InventoryItem or create a new one before the invoice
    can be confirmed (see confirm_invoice's all-lines-matched check)."""

    invoice = models.ForeignKey(InvoiceScan, on_delete=models.CASCADE, related_name="line_items")
    raw_name = models.CharField(max_length=255)
    matched_item = models.ForeignKey(
        InventoryItem, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.CharField(max_length=32, blank=True, default="")
    unit_price = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    line_total = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("sort_order",)

    def __str__(self):
        return f"{self.raw_name} x{self.quantity}"


# Flat, top-level name for config.settings.base's ENUM_NAME_OVERRIDES - see
# the matching comment in apps.attendance.models.
INVOICE_SCAN_STATUS_CHOICES = InvoiceScan.Status.choices
INVOICE_SCAN_STATE_CHOICES = InvoiceScan.ScanState.choices
