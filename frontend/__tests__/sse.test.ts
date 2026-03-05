import { describe, it, expect } from "vitest";
import { parseSSEBuffer, parseSSEBlock } from "@/lib/sse";

describe("parseSSEBuffer", () => {
  it("parses a single complete event block", () => {
    const { blocks, remaining } = parseSSEBuffer(
      'event: delta\ndata: {"text":"hello"}\n\n'
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ event: "delta", data: '{"text":"hello"}' });
    expect(remaining).toBe("");
  });

  it("returns incomplete chunk as remaining when no trailing double-newline", () => {
    const partial = 'event: delta\ndata: {"tex';
    const { blocks, remaining } = parseSSEBuffer(partial);
    expect(blocks).toHaveLength(0);
    expect(remaining).toBe(partial);
  });

  it("handles merged chunks with multiple events", () => {
    const merged =
      'event: delta\ndata: {"text":"a"}\n\nevent: delta\ndata: {"text":"b"}\n\n';
    const { blocks } = parseSSEBuffer(merged);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].data).toBe('{"text":"a"}');
    expect(blocks[1].data).toBe('{"text":"b"}');
  });

  it("ignores comment lines that start with colon", () => {
    const { blocks } = parseSSEBuffer(
      ': keep-alive\nevent: delta\ndata: {"text":"hi"}\n\n'
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].event).toBe("delta");
  });

  it("discards blocks missing event or data", () => {
    const { blocks } = parseSSEBuffer("data: orphaned\n\n");
    expect(blocks).toHaveLength(0);
  });

  it("preserves partial last block across chunks", () => {
    const chunk1 = 'event: delta\ndata: {"text":"';
    const { blocks: b1, remaining: r1 } = parseSSEBuffer(chunk1);
    expect(b1).toHaveLength(0);

    const chunk2 = r1 + 'world"}\n\n';
    const { blocks: b2, remaining: r2 } = parseSSEBuffer(chunk2);
    expect(b2).toHaveLength(1);
    expect(b2[0].data).toBe('{"text":"world"}');
    expect(r2).toBe("");
  });
});

describe("parseSSEBlock", () => {
  it("parses message_start event", () => {
    const event = parseSSEBlock({
      event: "message_start",
      data: '{"message_id":"abc-123"}',
    });
    expect(event).toEqual({
      type: "message_start",
      data: { message_id: "abc-123" },
    });
  });

  it("parses delta event", () => {
    const event = parseSSEBlock({
      event: "delta",
      data: '{"text":"hello world"}',
    });
    expect(event).toEqual({ type: "delta", data: { text: "hello world" } });
  });

  it("parses message_stop event with usage", () => {
    const event = parseSSEBlock({
      event: "message_stop",
      data: '{"message_id":"abc","usage":{"input_tokens":10,"output_tokens":20}}',
    });
    expect(event?.type).toBe("message_stop");
    if (event?.type === "message_stop") {
      expect(event.data.usage.input_tokens).toBe(10);
    }
  });

  it("parses error event", () => {
    const event = parseSSEBlock({
      event: "error",
      data: '{"message":"rate limited"}',
    });
    expect(event).toEqual({
      type: "error",
      data: { message: "rate limited" },
    });
  });

  it("returns null for [DONE] terminator", () => {
    expect(parseSSEBlock({ event: "any", data: "[DONE]" })).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseSSEBlock({ event: "delta", data: "not-json" })).toBeNull();
  });

  it("passes through tool_use as-is", () => {
    const event = parseSSEBlock({
      event: "tool_use",
      data: '{"query":"latest news","tool":"web_search"}',
    });
    expect(event?.type).toBe("tool_use");
  });

  it("passes through citation as-is", () => {
    const event = parseSSEBlock({
      event: "citation",
      data: '{"url":"https://example.com","title":"Example"}',
    });
    expect(event?.type).toBe("citation");
  });

  it("returns null for unknown event types", () => {
    const event = parseSSEBlock({ event: "unknown_future_event", data: '{}' });
    expect(event).toBeNull();
  });
});
