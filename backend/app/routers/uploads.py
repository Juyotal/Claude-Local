from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.models import Attachment
from app.schemas import AttachmentOut
from app.services.file_types import classify

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


@router.post("", response_model=AttachmentOut, status_code=201)
async def upload_file(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    data = await file.read()
    size = len(data)
    if size == 0:
        raise HTTPException(status_code=422, detail="Empty file")
    if size > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum size of {settings.MAX_UPLOAD_BYTES} bytes",
        )

    media_type = (file.content_type or "application/octet-stream").lower()
    kind = classify(media_type, data)
    if kind is None:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported media type: {media_type}",
        )

    # Normalize unknown-but-decodable payloads to text/plain so downstream
    # consumers (and the UI preview endpoint) have a concrete content type.
    if kind == "text" and media_type in ("", "application/octet-stream"):
        media_type = "text/plain"

    att = Attachment(
        filename=file.filename or "untitled",
        media_type=media_type,
        size_bytes=size,
        data=data,
    )
    session.add(att)
    await session.commit()

    return AttachmentOut(
        id=att.id,
        filename=att.filename,
        media_type=att.media_type,
        size_bytes=att.size_bytes,
    )


@router.delete("/{attachment_id}", status_code=204)
async def delete_upload(
    attachment_id: str,
    session: AsyncSession = Depends(get_session),
):
    att = await session.get(Attachment, attachment_id)
    if att is None:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if att.message_id is not None:
        raise HTTPException(
            status_code=409,
            detail="Attachment is already associated with a message",
        )
    await session.delete(att)
    await session.commit()
