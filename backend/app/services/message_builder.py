from __future__ import annotations

import base64
from typing import Any, Iterable

from app.models import Attachment
from app.services.file_types import classify

ContentBlock = dict[str, Any]


def _image_block(att: Attachment) -> ContentBlock:
    return {
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": att.media_type,
            "data": base64.b64encode(att.data).decode("ascii"),
        },
    }


def _document_block(att: Attachment) -> ContentBlock:
    return {
        "type": "document",
        "source": {
            "type": "base64",
            "media_type": att.media_type,
            "data": base64.b64encode(att.data).decode("ascii"),
        },
    }


def _text_block(att: Attachment) -> ContentBlock:
    contents = att.data.decode("utf-8", errors="replace")
    return {
        "type": "text",
        "text": f'<attachment filename="{att.filename}">\n{contents}\n</attachment>',
    }


def build_anthropic_content(
    user_text: str,
    attachments: Iterable[Attachment],
) -> list[ContentBlock]:
    """Build Anthropic content blocks from a user message and its attachments.

    Attachments are emitted first (image/document blocks, plus a text block per
    text/code file wrapped with a filename marker). The user's text, if any,
    is appended as the final text block. Attachments whose media type is not
    recognized are skipped silently — validation happens at the upload
    boundary, not here.
    """
    blocks: list[ContentBlock] = []
    for att in attachments:
        kind = classify(att.media_type, att.data)
        if kind == "image":
            blocks.append(_image_block(att))
        elif kind == "document":
            blocks.append(_document_block(att))
        elif kind == "text":
            blocks.append(_text_block(att))
    if user_text:
        blocks.append({"type": "text", "text": user_text})
    return blocks
