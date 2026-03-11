"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { AlertCircle, ArrowDown, RefreshCw, FileText, Search, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatBytes } from "@/lib/utils";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { attachmentUrl } from "@/lib/api";
import type { DisplayMessage } from "@/lib/useChat";
import type { AttachmentOut, CitationOut } from "@/types/api";

const NEAR_BOTTOM_THRESHOLD = 120;

const SUGGESTIONS = [
  "Summarize a PDF for me",
  "Debug some code I'm working on",
  "Search the web for the latest AI news",
  "Explain a concept in simple terms",
];

interface Props {
  messages: DisplayMessage[];
  onRetry?: () => void;
  onSuggest?: (text: string) => void;
}

function EmptyChat({ onSuggest }: { onSuggest?: (text: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
      <div>
        <h2 className="text-lg font-semibold mb-1">How can I help you today?</h2>
        <p className="text-sm text-muted-foreground">
          Ask me anything, share a file, or try one of these:
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full max-w-md">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggest?.(s)}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-left hover:bg-accent transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function AttachmentPills({ attachments }: { attachments: AttachmentOut[] }) {
  if (!attachments.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-2" role="list" aria-label="Attachments">
      {attachments.map((a) => {
        const isImage = a.media_type.startsWith("image/");
        const url = attachmentUrl(a.id);
        return (
          <a
            key={a.id}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            role="listitem"
            title={`${a.filename} (${formatBytes(a.size_bytes)})`}
            className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-xs text-primary-foreground/80 hover:bg-primary/20 transition-colors max-w-[180px]"
          >
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={a.filename}
                className="h-6 w-6 rounded object-cover shrink-0"
              />
            ) : (
              <FileText className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">{a.filename}</span>
            <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
          </a>
        );
      })}
    </div>
  );
}

function SearchIndicator({
  status,
  count,
}: {
  status: DisplayMessage["searchStatus"];
  count?: number;
}) {
  if (status === "idle") return null;
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
      <Search
        className={cn(
          "h-3.5 w-3.5",
          status === "searching" && "animate-pulse text-primary"
        )}
      />
      {status === "searching" ? (
        <span className="animate-pulse">Searching the web…</span>
      ) : (
        <span>Read {count ?? 0} result{count !== 1 ? "s" : ""}</span>
      )}
    </div>
  );
}

// Injects [^n] footnote markers into content at citation character positions
// so MarkdownRenderer can render them as superscripts via GFM footnotes.
function injectCitationMarkers(content: string, citations: CitationOut[]): string {
  const positioned = citations
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.start_index != null && c.end_index != null)
    .sort((a, b) => (b.c.end_index ?? 0) - (a.c.end_index ?? 0)); // reverse order to preserve indices

  let result = content;
  for (const { i, c } of positioned) {
    result =
      result.slice(0, c.end_index!) + `[^${i + 1}]` + result.slice(c.end_index!);
  }
  return result;
}

function SourcesSection({ citations }: { citations: CitationOut[] }) {
  if (!citations.length) return null;

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <p className="text-xs font-medium text-muted-foreground mb-1.5">Sources</p>
      <ol className="space-y-1">
        {citations.map((c, i) => {
          let domain = "";
          try {
            domain = new URL(c.url).hostname.replace(/^www\./, "");
          } catch {
            domain = c.url;
          }
          return (
            <li key={c.id ?? i} className="flex items-start gap-1.5 text-xs">
              <span className="text-muted-foreground shrink-0 w-4 text-right">
                {i + 1}.
              </span>
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                title={c.cited_text ?? c.title ?? c.url}
                className="flex items-center gap-1.5 text-primary hover:underline min-w-0 group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://www.google.com/s2/favicons?sz=16&domain=${domain}`}
                  alt=""
                  className="h-3.5 w-3.5 shrink-0 rounded-sm opacity-80"
                  aria-hidden="true"
                />
                <span className="truncate">{c.title ?? domain}</span>
                <span className="text-muted-foreground shrink-0 hidden group-hover:inline">
                  ({domain})
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function MessageList({ messages, onRetry, onSuggest }: Props) {
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
    return <EmptyChat onSuggest={onSuggest} />;
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
              <div className="rounded-xl px-4 py-3 text-sm leading-relaxed bg-primary text-primary-foreground">
                <AttachmentPills attachments={msg.attachments} />
                <span className="whitespace-pre-wrap">{msg.content}</span>
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
                ) : (
                  <>
                    <SearchIndicator
                      status={msg.searchStatus}
                      count={msg.searchResultCount}
                    />
                    {msg.content ? (
                      <div className="relative">
                        <MarkdownRenderer
                          content={injectCitationMarkers(msg.content, msg.citations)}
                        />
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
                    <SourcesSection citations={msg.citations} />
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {showJumpToBottom && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <Button
            variant="outline"
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
