import json
from unittest.mock import patch

import pytest
from httpx import AsyncClient


async def fake_stream(messages, model, system=None, max_tokens=4096, tools=None):
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

    async def capturing_stream(messages, model, system=None, max_tokens=4096, tools=None):
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


# ---------------------------------------------------------------------------
# Web search tool tests
# ---------------------------------------------------------------------------

async def fake_search_stream(messages, model, system=None, max_tokens=4096, tools=None):
    yield {"type": "delta", "text": "Searching..."}
    yield {"type": "tool_use", "tool": "web_search", "query": "latest news about X"}
    yield {"type": "tool_result", "tool": "web_search", "result_count": 3}
    yield {"type": "delta", "text": "Found: "}
    yield {
        "type": "citation",
        "url": "https://example.com/article",
        "title": "Example Article",
        "cited_text": "some cited snippet",
        "start_index": None,
        "end_index": None,
    }
    yield {"type": "delta", "text": "some info."}
    yield {"type": "usage", "input_tokens": 50, "output_tokens": 30}


async def test_web_search_enabled_passes_tools_to_stream_chat(client: AsyncClient):
    conv_id = await _create_conv(client)
    await client.patch(f"/api/conversations/{conv_id}", json={"web_search_enabled": True})

    captured_tools: list = []

    async def capturing_stream(messages, model, system=None, max_tokens=4096, tools=None):
        if tools:
            captured_tools.extend(tools)
        yield {"type": "delta", "text": "ok"}
        yield {"type": "usage", "input_tokens": 1, "output_tokens": 1}

    with patch("app.routers.conversations.stream_chat", capturing_stream):
        async with client.stream(
            "POST",
            f"/api/conversations/{conv_id}/messages",
            json={"content": "What's the latest news?"},
        ) as resp:
            await resp.aread()

    assert len(captured_tools) == 1
    assert captured_tools[0]["type"] == "web_search_20250305"
    assert captured_tools[0]["name"] == "web_search"
    assert "max_uses" in captured_tools[0]


async def test_web_search_disabled_passes_no_tools(client: AsyncClient):
    conv_id = await _create_conv(client)
    # web_search_enabled defaults to False

    captured_tools: list = []

    async def capturing_stream(messages, model, system=None, max_tokens=4096, tools=None):
        captured_tools.append(tools)
        yield {"type": "delta", "text": "ok"}
        yield {"type": "usage", "input_tokens": 1, "output_tokens": 1}

    with patch("app.routers.conversations.stream_chat", capturing_stream):
        async with client.stream(
            "POST",
            f"/api/conversations/{conv_id}/messages",
            json={"content": "Hello"},
        ) as resp:
            await resp.aread()

    assert captured_tools == [None]


async def test_web_search_emits_tool_use_sse_event(client: AsyncClient):
    conv_id = await _create_conv(client)
    await client.patch(f"/api/conversations/{conv_id}", json={"web_search_enabled": True})

    with patch("app.routers.conversations.stream_chat", fake_search_stream):
        async with client.stream(
            "POST",
            f"/api/conversations/{conv_id}/messages",
            json={"content": "Search for me"},
        ) as resp:
            body = await resp.aread()

    events = parse_sse(body.decode())
    tool_use = next(e for e in events if e["event"] == "tool_use")
    assert tool_use["data"]["tool"] == "web_search"
    assert tool_use["data"]["query"] == "latest news about X"


async def test_web_search_emits_tool_result_sse_event(client: AsyncClient):
    conv_id = await _create_conv(client)
    await client.patch(f"/api/conversations/{conv_id}", json={"web_search_enabled": True})

    with patch("app.routers.conversations.stream_chat", fake_search_stream):
        async with client.stream(
            "POST",
            f"/api/conversations/{conv_id}/messages",
            json={"content": "Search for me"},
        ) as resp:
            body = await resp.aread()

    events = parse_sse(body.decode())
    tool_result = next(e for e in events if e["event"] == "tool_result")
    assert tool_result["data"]["tool"] == "web_search"
    assert tool_result["data"]["result_count"] == 3


async def test_web_search_emits_citation_sse_event(client: AsyncClient):
    conv_id = await _create_conv(client)
    await client.patch(f"/api/conversations/{conv_id}", json={"web_search_enabled": True})

    with patch("app.routers.conversations.stream_chat", fake_search_stream):
        async with client.stream(
            "POST",
            f"/api/conversations/{conv_id}/messages",
            json={"content": "Search for me"},
        ) as resp:
            body = await resp.aread()

    events = parse_sse(body.decode())
    citation = next(e for e in events if e["event"] == "citation")
    assert citation["data"]["url"] == "https://example.com/article"
    assert citation["data"]["title"] == "Example Article"
    assert citation["data"]["cited_text"] == "some cited snippet"


async def test_web_search_sse_event_order(client: AsyncClient):
    conv_id = await _create_conv(client)
    await client.patch(f"/api/conversations/{conv_id}", json={"web_search_enabled": True})

    with patch("app.routers.conversations.stream_chat", fake_search_stream):
        async with client.stream(
            "POST",
            f"/api/conversations/{conv_id}/messages",
            json={"content": "Search for me"},
        ) as resp:
            body = await resp.aread()

    event_types = [e["event"] for e in parse_sse(body.decode())]
    assert event_types[0] == "message_start"
    assert "tool_use" in event_types
    assert "tool_result" in event_types
    assert "citation" in event_types
    assert event_types[-1] == "message_stop"
    # tool_use comes before tool_result
    assert event_types.index("tool_use") < event_types.index("tool_result")
    # citation comes after tool_result
    assert event_types.index("citation") > event_types.index("tool_result")


async def test_web_search_persists_citations_to_db(client: AsyncClient):
    conv_id = await _create_conv(client)
    await client.patch(f"/api/conversations/{conv_id}", json={"web_search_enabled": True})

    with patch("app.routers.conversations.stream_chat", fake_search_stream):
        async with client.stream(
            "POST",
            f"/api/conversations/{conv_id}/messages",
            json={"content": "Search for me"},
        ) as resp:
            await resp.aread()

    detail = (await client.get(f"/api/conversations/{conv_id}")).json()
    assistant_msg = next(m for m in detail["messages"] if m["role"] == "assistant")
    assert len(assistant_msg["citations"]) == 1
    cit = assistant_msg["citations"][0]
    assert cit["url"] == "https://example.com/article"
    assert cit["title"] == "Example Article"
    assert cit["cited_text"] == "some cited snippet"


async def test_web_search_no_citations_on_disabled_search(client: AsyncClient):
    conv_id = await _create_conv(client)
    # web_search_enabled defaults to False — regular stream, no citations

    with patch("app.routers.conversations.stream_chat", fake_stream):
        async with client.stream(
            "POST",
            f"/api/conversations/{conv_id}/messages",
            json={"content": "Hello"},
        ) as resp:
            await resp.aread()

    detail = (await client.get(f"/api/conversations/{conv_id}")).json()
    assistant_msg = next(m for m in detail["messages"] if m["role"] == "assistant")
    assert assistant_msg["citations"] == []


async def test_web_search_history_replay_works_after_search(client: AsyncClient):
    """Message 4 in a conversation where message 3 had citations must stream correctly."""
    conv_id = await _create_conv(client)
    await client.patch(f"/api/conversations/{conv_id}", json={"web_search_enabled": True})

    # First exchange: triggers web search and creates a citation
    with patch("app.routers.conversations.stream_chat", fake_search_stream):
        async with client.stream(
            "POST",
            f"/api/conversations/{conv_id}/messages",
            json={"content": "Search for me"},
        ) as resp:
            await resp.aread()

    # Second exchange: history is replayed as plain text, no tool blocks
    captured_history: list = []

    async def history_capture(messages, model, system=None, max_tokens=4096, tools=None):
        captured_history.extend(messages)
        yield {"type": "delta", "text": "follow-up answer"}
        yield {"type": "usage", "input_tokens": 10, "output_tokens": 5}

    with patch("app.routers.conversations.stream_chat", history_capture):
        async with client.stream(
            "POST",
            f"/api/conversations/{conv_id}/messages",
            json={"content": "Follow-up question"},
        ) as resp:
            body = await resp.aread()

    events = parse_sse(body.decode())
    assert any(e["event"] == "message_stop" for e in events)

    # History passed to API should only contain plain string content for assistant messages
    assistant_turns = [m for m in captured_history if m["role"] == "assistant"]
    assert len(assistant_turns) >= 1
    # Assistant content is plain text (not tool blocks)
    for turn in assistant_turns:
        assert isinstance(turn["content"], str)
