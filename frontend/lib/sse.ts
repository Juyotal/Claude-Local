// SSE parser for POST-based Server-Sent Events.
// Uses fetch + ReadableStream instead of EventSource (POST bodies need this).

export type SSEEventType =
  | "message_start"
  | "delta"
  | "tool_use"
  | "tool_result"
  | "citation"
  | "message_stop"
  | "error";

export type SSEEvent =
  | { type: "message_start"; data: { message_id: string } }
  | { type: "delta"; data: { text: string } }
  | {
      type: "message_stop";
      data: {
        message_id: string;
        usage: { input_tokens: number; output_tokens: number };
      };
    }
  | { type: "error"; data: { message: string } }
  | { type: "tool_use"; data: Record<string, unknown> }
  | { type: "tool_result"; data: Record<string, unknown> }
  | { type: "citation"; data: Record<string, unknown> };

export interface RawSSEBlock {
  event: string;
  data: string;
}

/**
 * Parse a raw SSE text buffer into completed event blocks.
 * Returns the parsed blocks and any remaining incomplete text.
 */
export function parseSSEBuffer(buffer: string): {
  blocks: RawSSEBlock[];
  remaining: string;
} {
  const blocks: RawSSEBlock[] = [];
  const parts = buffer.split("\n\n");
  // Last part is incomplete unless buffer ends with \n\n
  const remaining = parts.pop() ?? "";

  for (const part of parts) {
    const lines = part.split("\n").filter((l) => l.length > 0);
    let event = "";
    let data = "";
    for (const line of lines) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        data = line.slice(5).trim();
      }
    }
    if (event && data) {
      blocks.push({ event, data });
    }
  }

  return { blocks, remaining };
}

/** Convert a raw SSE block into a typed SSEEvent, or null if unrecognised. */
export function parseSSEBlock(block: RawSSEBlock): SSEEvent | null {
  if (block.data === "[DONE]") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(block.data);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  switch (block.event) {
    case "message_start":
      return {
        type: "message_start",
        data: { message_id: String(obj.message_id ?? "") },
      };
    case "delta":
      return { type: "delta", data: { text: String(obj.text ?? "") } };
    case "message_stop":
      return {
        type: "message_stop",
        data: {
          message_id: String(obj.message_id ?? ""),
          usage: (obj.usage as {
            input_tokens: number;
            output_tokens: number;
          }) ?? { input_tokens: 0, output_tokens: 0 },
        },
      };
    case "error":
      return {
        type: "error",
        data: { message: String(obj.message ?? "Unknown error") },
      };
    case "tool_use":
      return { type: "tool_use", data: obj };
    case "tool_result":
      return { type: "tool_result", data: obj };
    case "citation":
      return { type: "citation", data: obj };
    default:
      return null;
  }
}

/** POST to url and yield typed SSE events as they arrive. Respects AbortSignal. */
export async function* streamSSE(
  url: string,
  body: unknown,
  signal?: AbortSignal
): AsyncGenerator<SSEEvent> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`SSE ${res.status}: ${text}`);
  }

  if (!res.body) throw new Error("SSE response has no body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { blocks, remaining } = parseSSEBuffer(buffer);
      buffer = remaining;
      for (const block of blocks) {
        const event = parseSSEBlock(block);
        if (event !== null) yield event;
      }
    }
    // Flush any final decoder bytes
    buffer += decoder.decode();
    if (buffer.trim()) {
      const { blocks } = parseSSEBuffer(buffer + "\n\n");
      for (const block of blocks) {
        const event = parseSSEBlock(block);
        if (event !== null) yield event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
