from fastapi import APIRouter
from pydantic import BaseModel

from app.config import settings
from app.services.file_types import IMAGE_MEDIA_TYPES, PDF_MEDIA_TYPE, TEXT_MEDIA_TYPES

router = APIRouter()


class ConfigResponse(BaseModel):
    max_upload_bytes: int
    supported_media_types: list[str]


@router.get("/api/config", response_model=ConfigResponse)
async def get_config():
    return ConfigResponse(
        max_upload_bytes=settings.MAX_UPLOAD_BYTES,
        supported_media_types=sorted(
            list(IMAGE_MEDIA_TYPES) + [PDF_MEDIA_TYPE] + list(TEXT_MEDIA_TYPES)
        ),
    )
