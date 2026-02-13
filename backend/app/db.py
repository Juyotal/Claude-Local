from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


engine: AsyncEngine | None = None
SessionLocal: async_sessionmaker[AsyncSession] | None = None


def init_engine(db_url: str) -> None:
    global engine, SessionLocal
    engine = create_async_engine(db_url, echo=False)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def init_db() -> None:
    from . import models  # noqa: F401 — registers ORM models with Base.metadata
    assert engine is not None, "Call init_engine() before init_db()"
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def dispose_engine() -> None:
    global engine, SessionLocal
    if engine is not None:
        await engine.dispose()
        engine = None
        SessionLocal = None


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    if SessionLocal is None:
        raise RuntimeError("Database not initialized. Call init_engine() first.")
    async with SessionLocal() as session:
        yield session
