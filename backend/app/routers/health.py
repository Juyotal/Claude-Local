from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_session
from ..schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health(session: AsyncSession = Depends(get_session)):
    try:
        await session.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "error"

    return HealthResponse(
        status="ok",
        db=db_status,
        anthropic_key_present=bool(settings.ANTHROPIC_API_KEY),
    )
