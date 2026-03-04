"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { AlertCircle, ArrowDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import type { DisplayMessage } from "@/lib/useChat";

const NEAR_BOTTOM_THRESHOLD = 120;

interface Props {
  messages: DisplayMessage[];
  isStreaming: boolean;
  onRetry?: () => void;
}

export default function MessageList({ messages, isStreaming, onRetry }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const wasNearBottomRef = useRef(true);

  const isNearBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_THRESHOLD;
  }, []);

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior,
    });
  }

  // Auto-scroll to bottom when messages change, only if user was near bottom
  useEffect(() => {
    if (wasNearBottomRef.current) {
      scrollToBottom("instant");
    }
  }, [messages]);

  function handleScroll() {
    const near = isNearBottom();
    wasNearBottomRef.current = near;
    setShowJumpToBottom(!near);
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        No messages yet. Start a conversation below.
      </div>
    );
  }

  return (
    <div className="flex-1 relative min-h-0">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-6 py-6 space-y-6"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex flex-col gap-1 max-w-3xl",
              msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start w-full"
            )}
            aria-live={msg.isStreaming ? "polite" : undefined}
            aria-atomic={msg.isStreaming ? "false" : undefined}
          >
            <span className="text-xs text-muted-foreground capitalize px-1">
              {msg.role === "user" ? "You" : "Claude"}
            </span>

            {msg.role === "user" ? (
              <div className="rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap bg-primary text-primary-foreground">
                {msg.content}
              </div>
            ) : (
              <div className="rounded-xl px-4 py-3 text-sm bg-muted text-foreground min-w-0 w-full">
                {msg.error ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-red-500">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{msg.error}</span>
                    </div>
                    {onRetry && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onRetry}
                        className="self-start gap-1.5"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Retry
                      </Button>
                    )}
                  </div>
                ) : msg.content ? (
                  <div className="relative">
                    <MarkdownRenderer content={msg.content} />
                    {msg.isStreaming && (
                      <span
                        className="inline-block w-1.5 h-4 bg-foreground/60 ml-0.5 align-text-bottom animate-pulse"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                ) : msg.isStreaming ? (
                  <span
                    className="inline-block w-1.5 h-4 bg-foreground/60 animate-pulse"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            )}

            {msg.citations.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-1 px-1">
                {msg.citations.map((c) => (
                  <a
                    key={c.id}
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <span className="truncate max-w-xs">{c.title ?? c.url}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {showJumpToBottom && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              scrollToBottom("smooth");
              wasNearBottomRef.current = true;
              setShowJumpToBottom(false);
            }}
            className="shadow-md rounded-full gap-1.5"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            Jump to bottom
          </Button>
        </div>
      )}
    </div>
  );
}
