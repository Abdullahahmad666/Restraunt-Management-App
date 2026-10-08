"""Turning a PDF into the cheapest thing that still answers the question.

A PDF arrives as one of two very different documents wearing the same
extension.

A *digital* PDF - the kind a supplier's accounting software emails out - has a
text layer: the characters, already correct, free to read here. Rendering it to
pictures throws that away and pays a vision model around a thousand tokens per
page to read back what we were handed for nothing.

A *scanned* PDF is a photograph of paper in a PDF wrapper. There is no text to
lose, so a picture is the only thing to send.

So each page is judged on its own: text where there is text, a picture where
there is not, and nothing at all for a page that cannot be carrying line items.
A four page delivery note with a text layer used to cost about 4,400 input
tokens and now costs a few hundred.

pypdfium2 rather than pdf2image: it ships as a self-contained wheel, where
pdf2image shells out to poppler, and a system binary is one more thing that has
to be installed into the Docker image and can be missing at runtime.
"""

import io
import logging
from dataclasses import dataclass

import pypdfium2
from PIL import Image

logger = logging.getLogger(__name__)

#: Rendering scale, for the pages that do have to be pictures. 2.0 puts a UK A4
#: page at about 1700x2400, which lands near the 1568px that vision models
#: downsample to - enough to read dot-matrix print and faint carbon copies.
RENDER_SCALE = 2.0

#: A supplier statement can run to dozens of pages, and every one costs money
#: whether it holds line items or terms and conditions. Delivery notes are one
#: or two pages; this is generous and still bounded.
MAX_PAGES = 10

#: Rendered pages are re-encoded as JPEG. Text on white survives it well and it
#: is a third the size of PNG.
JPEG_QUALITY = 85

#: How much text a page needs before its text layer is trusted as the whole
#: page. Below this it is more likely a watermark, a header stamped on a scan,
#: or a few words some OCR pass left behind - in which case the characters are
#: there but most of the page is not in them, and a picture is the honest
#: answer. A real invoice page runs to several hundred characters.
MIN_TEXT_CHARS = 200


class TooManyPages(Exception):
    """More pages than we will pay to read."""


@dataclass(frozen=True)
class PdfPage:
    """One page, as whichever of the two things it should be sent as."""

    number: int
    text: str | None = None
    jpeg: bytes | None = None

    @property
    def is_text(self) -> bool:
        return self.text is not None


def _text_layer(page) -> str:
    """Whatever characters the page already carries, or nothing."""
    try:
        text = page.get_textpage().get_text_range()
    except Exception:  # noqa: BLE001 - a page with no text layer raises its own kinds
        return ""
    return (text or "").strip()


def _render(page) -> bytes:
    bitmap = page.render(scale=RENDER_SCALE)
    image: Image.Image = bitmap.to_pil().convert("RGB")
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return buffer.getvalue()


def page_payload(page, number: int, *, allow_text: bool) -> PdfPage | None:
    """What to send for one page, or None to send nothing at all.

    Three outcomes, in the order they are decided:

    No text layer, or barely any, means a scan: render it. An empty read is not
    evidence of an empty page, and the expensive answer is the safe one where
    we cannot tell.

    A text layer with no digit anywhere on it cannot be carrying a quantity,
    price, date, invoice number or total. That is terms and conditions, or
    delivery instructions, or a blank back page - skipped, because it costs the
    same as a page of line items and holds none.

    Otherwise the characters are right there and already correct.
    """
    text = _text_layer(page)

    if len(text) < MIN_TEXT_CHARS:
        return PdfPage(number=number, jpeg=_render(page))

    if not any(character.isdigit() for character in text):
        return None

    if not allow_text:
        return PdfPage(number=number, jpeg=_render(page))

    return PdfPage(number=number, text=text)


def pdf_pages(
    pdf_bytes: bytes, *, max_pages: int = MAX_PAGES, allow_text: bool = True
) -> list[PdfPage]:
    """Read a PDF into the parts worth sending.

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

        pages = [
            payload
            for index in range(page_count)
            if (payload := page_payload(document[index], index + 1, allow_text=allow_text))
        ]

        logger.info(
            "PDF of %s page(s): %s sent as text, %s rendered, %s skipped",
            page_count,
            sum(1 for page in pages if page.is_text),
            sum(1 for page in pages if not page.is_text),
            page_count - len(pages),
        )
        return pages
    finally:
        document.close()
