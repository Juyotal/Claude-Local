import json
from unittest.mock import patch

import pytest
from httpx import AsyncClient


async def fake_stream(messages, model, system=None, max_tokens=4096):
    yield {"type": "delta", "text": "Hello"}
    yield {"type": "delta", "text": " world!"}
    yield {"type": "usage", "input_tokens": 5, "output_tokens": 3}


def parse_sse(text: str) -> list[dict]:
    events = []
    current: dict = {}
    for line in text.splitlines():
        if line.startswith("event:"):
            current["event"] = line[6:].strip()
        elif line.startswith("data:"):
            current["data"] = json.loads(line[5:].strip())
        elif line == "" and current:
            events.append(current)
            current = {}
    if current:
        events.append(current)
    return events


async def _create_conv(client: AsyncClient, **kwargs) -> str:
    resp = await client.post("/api/conversations", json=kwargs)
    return resp.json()["id"]


async def test_send_message_streams_sse_event_sequence(client: AsyncClient):
    conv_id = await _create_conv(client)

    with patch("app.routers.conversations.stream_chat", fake_stream):
        async with client.stream(
            "POST",
            f"/api/conversations/{conv_id}/messages",
            json={"content": "Say hi"},
        ) as resp:
            assert resp.status_code == 200
            body = await resp.aread()

    events = parse_sse(body.decode())
    types = [e["event"] for e in events]
    assert types[0] == "message_start"
    assert "delta" in types
    assert types[-1] == "message_stop"


async def test_send_message_delta_text_content(client: AsyncClient):
    conv_id = await _create_conv(client)

    with patch("app.routers.conversations.stream_chat", fake_stream):
        async with client.stream(
            "POST",
            f"/api/conversations/{conv_id}/messages",
            json={"content": "Hi"},
        ) as resp:
            body = await resp.aread()

    events = parse_sse(body.decode())
    deltas = [e["data"]["text"] for e in events if e["event"] == "delta"]
    assert "".join(deltas) == "Hello world!"


async def test_send_message_stop_carries_usage(client: AsyncClient):
    conv_id = await _create_conv(client)

    with patch("app.routers.conversations.stream_chat", fake_stream):
        async with client.stream(
            "POST",
            f"/api/conversations/{conv_id}/messages",
            json={"content": "Hi"},
        ) as resp:
            body = await resp.aread()

    events = parse_sse(body.decode())
    stop = next(e for e in events if e["event"] == "message_stop")
    assert stop["data"]["usage"]["input_tokens"] == 5
    assert stop["data"]["usage"]["output_tokens"] == 3


async def test_send_message_persists_both_messages(client: AsyncClient):
    conv_id = await _create_conv(client)

    with patch("app.routers.conversations.stream_chat", fake_stream):
        async with client.stream(
            "POST",
            f"/api/conversations/{conv_id}/messages",
            json={"content": "Hello assistant"},
        ) as resp:
            await resp.aread()

    detail = (await client.get(f"/api/conversations/{conv_id}")).json()
    msgs = detail["messages"]
    assert len(msgs) == 2
    assert msgs[0]["role"] == "user"
    assert msgs[0]["content"] == "Hello assistant"
    assert msgs[1]["role"] == "assistant"
    assert msgs[1]["content"] == "Hello world!"


async def test_send_message_auto_title_on_first_message(client: AsyncClient):
    conv_id = await _create_conv(client)

    with patch("app.routers.conversations.stream_chat", fake_stream):
        async with client.stream(
            "POST",
            f"/api/conversations/{conv_id}/messages",
            json={"content": "Tell me about Python"},
        ) as resp:
            await resp.aread()

    detail = (await client.get(f"/api/conversations/{conv_id}")).json()
    assert detail["title"] == "Tell me about Python"


async def test_send_message_auto_title_truncates_at_40_chars(client: AsyncClient):
    conv_id = await _create_conv(client)
    long_msg = "A" * 60

    with patch("app.routers.conversations.stream_chat", fake_stream):
        async with client.stream(
            "POST",
            f"/api/conversations/{conv_id}/messages",
            json={"content": long_msg},
        ) as resp:
            await resp.aread()

    detail = (await client.get(f"/api/conversations/{conv_id}")).json()
    assert len(detail["title"]) <= 40


async def test_send_message_no_auto_title_on_second_message(client: AsyncClient):
    conv_id = await _create_conv(client, title="My custom title")

    with patch("app.routers.conversations.stream_chat", fake_stream):
        for content in ("First message", "Second message"):
            async with client.stream(
                "POST",
                f"/api/conversations/{conv_id}/messages",
                json={"content": content},
            ) as resp:
                await resp.aread()

    detail = (await client.get(f"/api/conversations/{conv_id}")).json()
    assert detail["title"] == "My custom title"


async def test_send_message_404_unknown_conversation(client: AsyncClient):
    resp = await client.post(
        "/api/conversations/nonexistent/messages",
        json={"content": "Hello"},
    )
    assert resp.status_code == 404


async def test_send_message_422_empty_content(client: AsyncClient):
    conv_id = await _create_conv(client)
    resp = await client.post(
        f"/api/conversations/{conv_id}/messages",
        json={"content": ""},
    )
    assert resp.status_code == 422


async def test_send_message_422_whitespace_content(client: AsyncClient):
    conv_id = await _create_conv(client)
    resp = await client.post(
        f"/api/conversations/{conv_id}/messages",
        json={"content": "   "},
    )
    assert resp.status_code == 422


async def test_send_message_503_missing_api_key(client: AsyncClient):
    conv_id = await _create_conv(client)

    with patch(
        "app.routers.conversations.get_client",
        side_effect=ValueError("ANTHROPIC_API_KEY is not configured"),
    ):
        resp = await client.post(
            f"/api/conversations/{conv_id}/messages",
            json={"content": "Hello"},
        )
    assert resp.status_code == 503


async def test_model_switch_affects_subsequent_calls(client: AsyncClient):
    conv_id = await _create_conv(client)
    await client.patch(f"/api/conversations/{conv_id}", json={"model": "claude-opus-4-7"})

    captured: list[str] = []

    async def capturing_stream(messages, model, system=None, max_tokens=4096):
        captured.append(model)
        yield {"type": "delta", "text": "ok"}
        yield {"type": "usage", "input_tokens": 1, "output_tokens": 1}

    with patch("app.routers.conversations.stream_chat", capturing_stream):
        async with client.stream(
            "POST",
            f"/api/conversations/{conv_id}/messages",
            json={"content": "Hello"},
        ) as resp:
            await resp.aread()

    assert captured == ["claude-opus-4-7"]


async def test_send_message_start_carries_message_id(client: AsyncClient):
    conv_id = await _create_conv(client)

    with patch("app.routers.conversations.stream_chat", fake_stream):
        async with client.stream(
            "POST",
            f"/api/conversations/{conv_id}/messages",
            json={"content": "Hi"},
        ) as resp:
            body = await resp.aread()

    events = parse_sse(body.decode())
    start = next(e for e in events if e["event"] == "message_start")
    assert "message_id" in start["data"]
    assert isinstance(start["data"]["message_id"], str)
