import os

# Set before any app module is imported so pydantic-settings picks them up.
os.environ["ANTHROPIC_API_KEY"] = os.environ.get("ANTHROPIC_API_KEY", "test-key")
os.environ["DB_PATH"] = ":memory:"

# Direct patch in case settings was already instantiated by pytest collection.
from app.config import settings  # noqa: E402
settings.ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]  # type: ignore[misc]

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.db import dispose_engine, init_db, init_engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
async def client():
    init_engine("sqlite+aiosqlite:///:memory:")
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    await dispose_engine()
