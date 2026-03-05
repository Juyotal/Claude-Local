"use client";

import { useState, useRef, useCallback } from "react";
import { sendMessage, getConversation } from "@/lib/api";
import type { MessageOut, CitationOut } from "@/types/api";

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming: boolean;
  error: string | null;
  citations: CitationOut[];
}

function toDisplay(m: MessageOut): DisplayMessage {
  return {
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    isStreaming: false,
    error: null,
    citations: m.citations,
  };
}

export function useChat(conversationId: string, initialMessages: MessageOut[]) {
  const [messages, setMessages] = useState<DisplayMessage[]>(() =>
    initialMessages.map(toDisplay)
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const isFirstRef = useRef(initialMessages.length === 0);
  const lastUserContentRef = useRef("");

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = useCallback(
    async (content: string): Promise<string | null> => {
      if (isStreaming || !content.trim()) return null;

      lastUserContentRef.current = content;
      const tempUserId = `optimistic-user-${Date.now()}`;
      const tempAssistantId = `optimistic-assistant-${Date.now() + 1}`;

      setMessages((prev) => [
        ...prev,
        {
          id: tempUserId,
          role: "user",
          content,
          isStreaming: false,
          error: null,
          citations: [],
        },
        {
          id: tempAssistantId,
          role: "assistant",
          content: "",
          isStreaming: true,
          error: null,
          citations: [],
        },
      ]);

      setIsStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;
      const wasFirst = isFirstRef.current;
      let newTitle: string | null = null;

      try {
        const stream = sendMessage(
          conversationId,
          content,
          [],
          controller.signal
        );
        let serverAssistantId: string | null = null;

        for await (const event of stream) {
          if (event.type === "message_start") {
            serverAssistantId = event.data.message_id;
          } else if (event.type === "delta") {
            const text = event.data.text;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId
                  ? { ...m, content: m.content + text }
                  : m
              )
            );
          } else if (event.type === "message_stop") {
            const finalId = serverAssistantId ?? tempAssistantId;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId
                  ? { ...m, id: finalId, isStreaming: false }
                  : m
              )
            );
          } else if (event.type === "error") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId
                  ? { ...m, isStreaming: false, error: event.data.message }
                  : m
              )
            );
          }
        }

        if (wasFirst) {
          isFirstRef.current = false;
          try {
            const conv = await getConversation(conversationId);
            newTitle = conv.title;
          } catch {
            // ignore title refresh errors
          }
        }
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAssistantId ? { ...m, isStreaming: false } : m
            )
          );
        } else {
          const message =
            err instanceof Error ? err.message : "An error occurred";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAssistantId
                ? { ...m, isStreaming: false, error: message }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }

      return newTitle;
    },
    [conversationId, isStreaming]
  );

  // Retry the last failed message: remove the error bubble + user message, resend
  const retry = useCallback(async (): Promise<string | null> => {
    const content = lastUserContentRef.current;
    if (!content || isStreaming) return null;
    setMessages((prev) => prev.slice(0, -2));
    return send(content);
  }, [isStreaming, send]);

  return { messages, isStreaming, send, stop, retry };
}
