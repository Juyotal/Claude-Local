import pytest
from httpx import ASGITransport, AsyncClient

from app.db import dispose_engine, init_db, init_engine
from app.main import app


@pytest.fixture
async def client():
    # ASGITransport does not trigger FastAPI's lifespan, so bootstrap the DB manually.
    init_engine("sqlite+aiosqlite:///:memory:")
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    await dispose_engine()


async def test_health_status_200(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200


async def test_health_response_shape(client: AsyncClient):
    data = (await client.get("/health")).json()
    assert data["status"] == "ok"
    assert data["db"] == "ok"
    assert isinstance(data["anthropic_key_present"], bool)


async def test_health_key_present_reflects_env(client: AsyncClient):
    from app.config import settings
    data = (await client.get("/health")).json()
    assert data["anthropic_key_present"] == bool(settings.ANTHROPIC_API_KEY)
