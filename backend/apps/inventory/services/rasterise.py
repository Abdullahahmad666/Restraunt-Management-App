"""Turning a PDF into page images.

Why this exists is worth being honest about. For a *scanned* PDF - a photo of
paper wrapped in a PDF container - there is no text to lose and rendering it
costs nothing in quality. For a *digital* PDF there is a text layer, and
rendering it to pictures throws that away and replaces a few hundred tokens of
crisp text with a couple of thousand tokens of image. This is the more
expensive path for those, not the cheaper one.

What it does buy is one code path instead of two, and control over the
resolution we send rather than whatever the provider picks.

pypdfium2 rather than pdf2image: it ships as a self-contained wheel, where
pdf2image shells out to poppler, and a system binary is one more thing that
has to be installed into the Docker image and can be missing at runtime.
"""

import io
import logging

import pypdfium2
from PIL import Image

logger = logging.getLogger(__name__)

#: Rendering scale. 2.0 puts a UK A4 page at about 1700x2400, which lands near
#: the 1568px that vision models downsample to - enough to read dot-matrix
#: print and faint carbon copies without paying for detail that is discarded.
RENDER_SCALE = 2.0

#: A supplier statement can run to dozens of pages, and every one costs money
#: whether it holds line items or terms and conditions. Delivery notes are one
#: or two pages; this is generous and still bounded.
MAX_PAGES = 10

#: Rendered pages are re-encoded as JPEG. Text on white survives it well and
#: it is a third the size of PNG.
JPEG_QUALITY = 85


class TooManyPages(Exception):
    """More pages than we will pay to read."""


def pdf_to_images(pdf_bytes: bytes, *, max_pages: int = MAX_PAGES) -> list[bytes]:
    """Render each page of a PDF to a JPEG.

    Raises TooManyPages rather than silently reading the first few: a caller
    that gets back three pages of a thirty page statement has no way to know
    the rest was dropped, and the invoice it builds would be missing most of
    its lines.
    """
    document = pypdfium2.PdfDocument(pdf_bytes)
    try:
        page_count = len(document)
        if page_count > max_pages:
            raise TooManyPages(page_count)

        pages: list[bytes] = []
        for index in range(page_count):
            page = document[index]
            bitmap = page.render(scale=RENDER_SCALE)
            image: Image.Image = bitmap.to_pil().convert("RGB")

            buffer = io.BytesIO()
            image.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True)
            pages.append(buffer.getvalue())

        logger.info("Rendered %s page(s) from a PDF", len(pages))
        return pages
    finally:
        document.close()
