from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Attachment

router = APIRouter(prefix="/api/attachments", tags=["attachments"])


def _safe_disposition_filename(name: str) -> str:
    # Strip anything that would break the quoted-string filename parameter.
    return name.replace("\\", "_").replace('"', "").replace("\r", "").replace("\n", "")


@router.get("/{attachment_id}")
async def get_attachment(
    attachment_id: str,
    session: AsyncSession = Depends(get_session),
):
    att = await session.get(Attachment, attachment_id)
    if att is None:
        raise HTTPException(status_code=404, detail="Attachment not found")

    filename = _safe_disposition_filename(att.filename) or "attachment"
    return Response(
        content=att.data,
        media_type=att.media_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
