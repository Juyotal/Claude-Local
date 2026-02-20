from __future__ import annotations

from typing import Literal

AttachmentKind = Literal["image", "document", "text"]

IMAGE_MEDIA_TYPES: frozenset[str] = frozenset(
    {
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
    }
)

PDF_MEDIA_TYPE: str = "application/pdf"

TEXT_MEDIA_TYPES: frozenset[str] = frozenset(
    {
        "text/plain",
        "text/markdown",
        "text/csv",
        "text/html",
        "text/css",
        "text/xml",
        "text/yaml",
        "text/javascript",
        "text/typescript",
        "text/x-python",
        "text/x-c",
        "text/x-c++",
        "text/x-java",
        "text/x-rust",
        "text/x-go",
        "text/x-ruby",
        "text/x-php",
        "text/x-swift",
        "text/x-kotlin",
        "text/x-scala",
        "text/x-shellscript",
        "text/x-sh",
        "text/x-sql",
        "application/json",
        "application/xml",
        "application/javascript",
        "application/typescript",
        "application/x-yaml",
        "application/x-sh",
        "application/toml",
    }
)


def classify(media_type: str | None, data: bytes) -> AttachmentKind | None:
    """Classify a file into an Anthropic content kind, or None if unsupported.

    Images and PDFs are matched strictly by media type. Text/code is matched
    against a known-safe set; when the media type is missing or generic, we
    fall back to a UTF-8 decode probe.
    """
    if media_type in IMAGE_MEDIA_TYPES:
        return "image"
    if media_type == PDF_MEDIA_TYPE:
        return "document"
    if media_type in TEXT_MEDIA_TYPES:
        return "text"

    generic = not media_type or media_type == "application/octet-stream"
    if generic or (media_type and media_type.startswith("text/")):
        try:
            data.decode("utf-8")
        except UnicodeDecodeError:
            return None
        return "text"
    return None
