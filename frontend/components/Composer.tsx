"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Send, Paperclip, Square } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const MAX_LINES = 8;
const LINE_HEIGHT_PX = 24;

interface Props {
  isStreaming: boolean;
  onSend: (content: string) => void;
  onStop: () => void;
}

export default function Composer({ isStreaming, onSend, onStop }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea up to MAX_LINES, then scroll
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxH = LINE_HEIGHT_PX * MAX_LINES + 24;
    el.style.height = `${Math.min(el.scrollHeight, maxH)}px`;
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setValue("");
    // Return focus to composer after send
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [value, isStreaming, onSend]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t border-border bg-background px-4 py-3">
      <div className="max-w-3xl mx-auto flex gap-2 items-end">
        <div className="flex-1">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Claude… (Shift+Enter for newline)"
            className="min-h-[44px] resize-none overflow-y-auto text-sm"
            rows={1}
            aria-label="Message input"
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          title="Attach file (Coming in Deliverable 7)"
          disabled
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        {isStreaming ? (
          <Button
            size="icon"
            variant="outline"
            className="shrink-0"
            onClick={onStop}
            title="Stop streaming"
            aria-label="Stop streaming"
          >
            <Square className="h-4 w-4 fill-current" />
          </Button>
        ) : (
          <Button
            size="icon"
            className="shrink-0"
            onClick={handleSend}
            disabled={!value.trim()}
            title="Send"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
