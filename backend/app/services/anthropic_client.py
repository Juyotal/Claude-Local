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
) -> AsyncGenerator[dict, None]:
    """Stream a chat completion.

    Each message's ``content`` may be a plain string (text-only turn) or a
    list of Anthropic content blocks (image / document / text). The Anthropic
    SDK accepts both shapes, so we pass them through untouched.
    """
    client = get_client()
    kwargs: dict = {"model": model, "max_tokens": max_tokens, "messages": messages}
    if system:
        kwargs["system"] = system

    async with client.messages.stream(**kwargs) as stream:
        async for text in stream.text_stream:
            yield {"type": "delta", "text": text}
        message = await stream.get_final_message()
        yield {
            "type": "usage",
            "input_tokens": message.usage.input_tokens,
            "output_tokens": message.usage.output_tokens,
        }
