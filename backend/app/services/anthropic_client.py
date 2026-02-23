import json as _json
from typing import Any, AsyncGenerator, Union

from anthropic import AsyncAnthropic

from app.config import settings

MessageContent = Union[str, list[dict[str, Any]]]
ChatMessage = dict[str, Any]  # {"role": "user" | "assistant", "content": MessageContent}

SUPPORTED_MODELS: list[dict] = [
    {"id": "claude-opus-4-7", "label": "Claude Opus 4.7"},
    {"id": "claude-sonnet-4-6", "label": "Claude Sonnet 4.6"},
    {"id": "claude-haiku-4-5-20251001", "label": "Claude Haiku 4.5"},
    {"id": "claude-opus-4-6", "label": "Claude Opus 4.6"},
]

_client: AsyncAnthropic | None = None


def get_client() -> AsyncAnthropic:
    global _client
    if not settings.ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY is not configured")
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


async def stream_chat(
    messages: list[ChatMessage],
    model: str,
    system: str | None = None,
    max_tokens: int = 4096,
    tools: list[dict[str, Any]] | None = None,
) -> AsyncGenerator[dict, None]:
    """Stream a chat completion, optionally with server-side tools (e.g. web search).

    Yields event dicts with ``type`` in: delta, tool_use, tool_result, citation, usage.
    """
    client = get_client()
    kwargs: dict = {"model": model, "max_tokens": max_tokens, "messages": messages}
    if system:
        kwargs["system"] = system
    if tools:
        kwargs["tools"] = tools

    async with client.messages.stream(**kwargs) as stream:
        current_type: str | None = None
        accumulated_input: str = ""

        async for event in stream:
            etype = event.type

            if etype == "content_block_start":
                block = event.content_block
                current_type = block.type
                accumulated_input = ""

                if block.type == "web_search_tool_result":
                    content = getattr(block, "content", None) or []
                    result_count = len(content) if isinstance(content, list) else 0
                    yield {"type": "tool_result", "tool": "web_search", "result_count": result_count}

            elif etype == "content_block_delta":
                delta = event.delta
                if delta.type == "text_delta":
                    yield {"type": "delta", "text": delta.text}
                elif delta.type == "input_json_delta":
                    accumulated_input += delta.partial_json

            elif etype == "content_block_stop":
                if current_type == "server_tool_use":
                    try:
                        input_data = _json.loads(accumulated_input) if accumulated_input else {}
                        query = input_data.get("query", "")
                    except (ValueError, KeyError):
                        query = ""
                    yield {"type": "tool_use", "tool": "web_search", "query": query}
                current_type = None
                accumulated_input = ""

        message = await stream.get_final_message()

        for block in message.content:
            if block.type == "text":
                for citation in getattr(block, "citations", None) or []:
                    if getattr(citation, "type", None) == "web_search_result_location":
                        yield {
                            "type": "citation",
                            "url": getattr(citation, "url", None),
                            "title": getattr(citation, "title", None),
                            "cited_text": getattr(citation, "cited_text", None),
                            "start_index": None,
                            "end_index": None,
                        }

        yield {
            "type": "usage",
            "input_tokens": message.usage.input_tokens,
            "output_tokens": message.usage.output_tokens,
        }
