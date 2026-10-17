"""What counts as an uploadable file, and how to tell what one is.

Two features now take photographs and PDFs from a phone - an invoice to be
read, and a licence to be shown to an inspector - and they have to agree about
what a JPEG is. One definition, because two would drift and the symptom would
be a file one half of the app accepts and the other half refuses.

Lives in common rather than in whichever app needed it first: a compliance
document importing from the inventory app would tie licences to invoice
scanning for no reason anybody could name later.
"""

from pathlib import PurePosixPath

PDF_TYPE = "application/pdf"
SUPPORTED_IMAGE_TYPES = frozenset({"image/jpeg", "image/png", "image/webp", "image/gif"})
SUPPORTED_TYPES = SUPPORTED_IMAGE_TYPES | {PDF_TYPE}

#: Generous for a phone photograph, and a bound on what one upload can cost in
#: transfer and storage.
MAX_FILE_BYTES = 20 * 1024 * 1024

#: Leading bytes that identify a file regardless of what the client called it.
#: Phones routinely upload a perfectly good PDF as application/octet-stream,
#: and a whitelist of declared types alone would turn those away.
_MAGIC = (
    (b"%PDF", PDF_TYPE),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
)

#: Fallback for rows stored before a content type was recorded. An extension is
#: weaker evidence than the type the client sent, which is why it is only the
#: fallback, but it is enough to tell a PDF from a photo.
_TYPE_BY_EXTENSION = {
    ".pdf": PDF_TYPE,
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


def sniff_content_type(head: bytes, declared: str = "") -> str:
    """Identify a file from its first bytes, falling back to what the client
    declared. Returns "" when neither is a type we can read."""
    for prefix, content_type in _MAGIC:
        if head.startswith(prefix):
            return content_type
    # WebP is a RIFF container - the marker sits after a 4-byte length.
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    return declared if declared in SUPPORTED_TYPES else ""


def type_from_name(name: str) -> str:
    """The type a stored file's name implies. Only ever a fallback."""
    return _TYPE_BY_EXTENSION.get(PurePosixPath(name or "").suffix.lower(), "image/jpeg")
