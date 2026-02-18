from fastapi import APIRouter

from app.schemas import ModelInfo
from app.services.anthropic_client import SUPPORTED_MODELS

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("", response_model=list[ModelInfo])
async def list_models() -> list[dict]:
    return SUPPORTED_MODELS
