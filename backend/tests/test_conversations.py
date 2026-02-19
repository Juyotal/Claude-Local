import pytest
from httpx import AsyncClient


async def test_list_conversations_empty(client: AsyncClient):
    resp = await client.get("/api/conversations")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_create_conversation_defaults(client: AsyncClient):
    resp = await client.post("/api/conversations", json={})
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "New conversation"
    assert data["model"] == "claude-sonnet-4-6"
    assert data["message_count"] == 0
    assert data["web_search_enabled"] is False


async def test_create_conversation_custom_fields(client: AsyncClient):
    resp = await client.post(
        "/api/conversations",
        json={"title": "My Chat", "model": "claude-opus-4-7", "system_prompt": "Be brief."},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "My Chat"
    assert data["model"] == "claude-opus-4-7"
    assert data["system_prompt"] == "Be brief."


async def test_get_conversation_detail(client: AsyncClient):
    create_resp = await client.post("/api/conversations", json={"title": "Test"})
    conv_id = create_resp.json()["id"]

    resp = await client.get(f"/api/conversations/{conv_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == conv_id
    assert data["title"] == "Test"
    assert data["messages"] == []


async def test_get_conversation_404(client: AsyncClient):
    resp = await client.get("/api/conversations/nonexistent-id")
    assert resp.status_code == 404


async def test_list_conversations_newest_first(client: AsyncClient):
    await client.post("/api/conversations", json={"title": "First"})
    await client.post("/api/conversations", json={"title": "Second"})
    resp = await client.get("/api/conversations")
    data = resp.json()
    assert len(data) == 2
    titles = [c["title"] for c in data]
    assert titles.index("Second") < titles.index("First")


async def test_list_conversations_includes_message_count(client: AsyncClient):
    resp = await client.post("/api/conversations", json={})
    data = resp.json()
    assert "message_count" in data
    assert isinstance(data["message_count"], int)


async def test_patch_conversation_title(client: AsyncClient):
    create_resp = await client.post("/api/conversations", json={})
    conv_id = create_resp.json()["id"]

    patch_resp = await client.patch(f"/api/conversations/{conv_id}", json={"title": "Renamed"})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["title"] == "Renamed"


async def test_patch_conversation_model(client: AsyncClient):
    create_resp = await client.post("/api/conversations", json={})
    conv_id = create_resp.json()["id"]

    patch_resp = await client.patch(
        f"/api/conversations/{conv_id}", json={"model": "claude-opus-4-7"}
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["model"] == "claude-opus-4-7"


async def test_patch_conversation_web_search(client: AsyncClient):
    create_resp = await client.post("/api/conversations", json={})
    conv_id = create_resp.json()["id"]

    patch_resp = await client.patch(
        f"/api/conversations/{conv_id}", json={"web_search_enabled": True}
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["web_search_enabled"] is True


async def test_patch_conversation_404(client: AsyncClient):
    resp = await client.patch("/api/conversations/bad-id", json={"title": "X"})
    assert resp.status_code == 404


async def test_delete_conversation(client: AsyncClient):
    create_resp = await client.post("/api/conversations", json={})
    conv_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/conversations/{conv_id}")
    assert del_resp.status_code == 204

    get_resp = await client.get(f"/api/conversations/{conv_id}")
    assert get_resp.status_code == 404


async def test_delete_conversation_404(client: AsyncClient):
    resp = await client.delete("/api/conversations/bad-id")
    assert resp.status_code == 404


async def test_delete_removes_from_list(client: AsyncClient):
    create_resp = await client.post("/api/conversations", json={})
    conv_id = create_resp.json()["id"]
    await client.delete(f"/api/conversations/{conv_id}")

    list_resp = await client.get("/api/conversations")
    ids = [c["id"] for c in list_resp.json()]
    assert conv_id not in ids


async def test_list_models(client: AsyncClient):
    resp = await client.get("/api/models")
    assert resp.status_code == 200
    models = resp.json()
    assert isinstance(models, list)
    assert len(models) >= 4
    ids = [m["id"] for m in models]
    assert "claude-sonnet-4-6" in ids
    assert "claude-opus-4-7" in ids
    assert all("id" in m and "label" in m for m in models)
