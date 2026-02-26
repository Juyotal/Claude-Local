// SSE parser — real implementation in Deliverable 6.

export type SSEEventType =
  | "message_start"
  | "delta"
  | "tool_use"
  | "tool_result"
  | "citation"
  | "message_stop"
  | "error";

export interface SSEEvent {
  type: SSEEventType;
  data: Record<string, unknown>;
}

export type SSEHandler = (event: SSEEvent) => void;

export function connectSSE(
  _url: string,
  _onEvent: SSEHandler,
  _onDone: () => void,
  _onError: (err: Error) => void
): () => void {
  console.log("connectSSE: Coming in Deliverable 6");
  return () => {};
}
