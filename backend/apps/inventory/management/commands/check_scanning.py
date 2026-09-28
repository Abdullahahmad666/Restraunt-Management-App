"""Find out whether invoice scanning actually works, without scanning one.

    python manage.py check_scanning

Uploading a real invoice to find out is a slow way to ask, and a bad one: the
answer arrives on a worker, in a log, several seconds later, and a missing
key, a model name that does not exist and a call that simply never returns all
look identical from the app - the invoice just sits there.

This makes one small real call and says which of those it was.
"""

import io
import time

from django.conf import settings
from django.core.management.base import BaseCommand
from PIL import Image, ImageDraw

from apps.inventory.services import extraction


def _tiny_invoice() -> bytes:
    """A picture with something invoice-shaped written on it.

    A blank square would work for checking connectivity, but a model handed
    one has nothing to extract, and "it returned nothing" is exactly the
    outcome this command exists to tell apart from a failure.
    """
    image = Image.new("RGB", (640, 320), "white")
    draw = ImageDraw.Draw(image)
    draw.text((20, 20), "ACME SUPPLIES LTD", fill="black")
    draw.text((20, 60), "Invoice No: TEST-001", fill="black")
    draw.text((20, 90), "Date: 22/09/2026", fill="black")
    draw.text((20, 140), "Tomatoes 5kg    2    10.00    20.00", fill="black")
    draw.text((20, 200), "Total: 20.00", fill="black")

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=90)
    return buffer.getvalue()


class Command(BaseCommand):
    help = "Make one test call to the invoice scanning API and report what happened."

    def handle(self, *args, **options):
        key = settings.OPENAI_API_KEY
        self.stdout.write(f"model   : {settings.OPENAI_MODEL}")
        self.stdout.write(f"timeout : {settings.OPENAI_TIMEOUT_SECONDS}s")
        if not key:
            self.stdout.write(
                self.style.ERROR(
                    "key     : not set - uploads will save but nothing will be read.\n"
                    "Set OPENAI_API_KEY in backend/.env."
                )
            )
            return
        # Enough to tell two keys apart in a screenshot, not enough to use.
        self.stdout.write(f"key     : set ({key[:7]}...{key[-4:]})")
        self.stdout.write("\nSending one test invoice...")

        started = time.monotonic()
        try:
            data = extraction.extract_invoice_data(
                image_bytes=_tiny_invoice(), content_type="image/jpeg"
            )
        except extraction.PermanentScanError as exc:
            self.stdout.write(
                self.style.ERROR(f"\nFailed after {time.monotonic() - started:.1f}s: {exc}")
            )
            self.stdout.write(
                "\nThis one will not fix itself by retrying. The usual causes are a model "
                "name that does not exist (a 404), a key without access to it (401/403), "
                "or no credit on the account (402)."
            )
            return
        except extraction.TransientScanError as exc:  # noqa: F841 - reported below
            self.stdout.write(
                self.style.WARNING(
                    f"\nDid not complete in {time.monotonic() - started:.1f}s: {exc}"
                )
            )
            self.stdout.write(
                "\nA real scan would be retried automatically. If this keeps happening, the "
                "model is slower than OPENAI_TIMEOUT_SECONDS allows - raise it, or use a "
                "faster model."
            )
            return

        elapsed = time.monotonic() - started
        self.stdout.write(self.style.SUCCESS(f"\nRead it in {elapsed:.1f}s."))
        self.stdout.write(f"  supplier : {(data.get('supplier') or {}).get('name')!r}")
        self.stdout.write(f"  number   : {data.get('invoice_number')!r}")
        self.stdout.write(f"  date     : {data.get('invoice_date')!r}  (expected 2026-09-22)")
        self.stdout.write(f"  total    : {data.get('total')!r}")
        self.stdout.write(f"  lines    : {len(data.get('items') or [])}")

        # The date is the one field a UK invoice gets silently wrong, and a
        # test invoice is the cheapest place to catch it.
        if data.get("invoice_date") != "2026-09-22":
            self.stdout.write(
                self.style.WARNING(
                    "\nThe date came back as something other than 2026-09-22, so 22/09/2026 "
                    "was read as month-first. Real invoices will be filed in the wrong month."
                )
            )
