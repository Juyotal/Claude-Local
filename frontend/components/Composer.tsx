"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Send, Paperclip, Square, X, FileText, AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn, formatBytes } from "@/lib/utils";
import { attachmentUrl } from "@/lib/api";
import { useAttachments, type PendingAttachment } from "@/lib/useAttachments";

const MAX_LINES = 8;
const LINE_HEIGHT_PX = 24;

// Fallback limits used before /api/config loads — kept in sync with backend defaults.
const DEFAULT_MAX_BYTES = 26214400; // 25 MB — matches settings.MAX_UPLOAD_BYTES
const DEFAULT_SUPPORTED_TYPES = [
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "application/pdf",
  "text/plain", "text/markdown", "text/csv", "text/html", "text/css",
  "text/xml", "text/yaml", "text/javascript", "text/typescript",
  "text/x-python", "text/x-c", "text/x-c++", "text/x-java", "text/x-rust",
  "text/x-go", "text/x-ruby", "text/x-php", "text/x-swift", "text/x-kotlin",
  "text/x-scala", "text/x-shellscript", "text/x-sh", "text/x-sql",
  "application/json", "application/xml", "application/javascript",
  "application/typescript", "application/x-yaml", "application/x-sh",
  "application/toml",
];

export interface ComposerHandle {
  addFiles: (files: FileList | File[]) => void;
}

interface Props {
  isStreaming: boolean;
  onSend: (content: string, attachmentIds: string[]) => void;
  onStop: () => void;
  maxUploadBytes?: number;
  supportedMediaTypes?: string[];
}

function AttachmentPill({
  item,
  onRemove,
}: {
  item: PendingAttachment;
  onRemove: () => void;
}) {
  const isImage = (
    item.attachment?.media_type ?? item.file.type
  ).startsWith("image/");

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs max-w-[200px]",
        item.status === "error"
          ? "border-red-400 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          : "border-border bg-muted text-foreground"
      )}
    >
      {item.status === "done" && item.attachment && isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={attachmentUrl(item.attachment.id)}
          alt={item.attachment.filename}
          className="h-6 w-6 rounded object-cover shrink-0"
        />
      ) : item.status === "error" ? (
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
      ) : (
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}

      <div className="flex-1 min-w-0">
        <p className="truncate leading-tight">{item.file.name}</p>
        {item.status === "error" ? (
          <p className="truncate text-red-500">{item.errorMsg}</p>
        ) : item.status === "uploading" ? (
          <div className="mt-0.5 h-1 w-full rounded-full bg-border overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-200 rounded-full"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        ) : (
          <p className="text-muted-foreground">{formatBytes(item.file.size)}</p>
        )}
      </div>

      <button
        onClick={onRemove}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={`Remove ${item.file.name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

const Composer = forwardRef<ComposerHandle, Props>(function Composer(
  {
    isStreaming,
    onSend,
    onStop,
    maxUploadBytes = DEFAULT_MAX_BYTES,
    supportedMediaTypes = DEFAULT_SUPPORTED_TYPES,
  },
  ref
) {
  const [value, setValue] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { pending, addFiles, remove, clear, readyIds, isUploading } =
    useAttachments(maxUploadBytes, supportedMediaTypes);

  useImperativeHandle(ref, () => ({ addFiles }), [addFiles]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxH = LINE_HEIGHT_PX * MAX_LINES + 24;
    el.style.height = `${Math.min(el.scrollHeight, maxH)}px`;
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming || isUploading) return;
    onSend(trimmed, readyIds);
    setValue("");
    clear();
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [value, isStreaming, isUploading, onSend, readyIds, clear]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) {
      addFiles(e.dataTransfer.files);
    }
  }

  const hasPending = pending.length > 0;
  const canSend = value.trim().length > 0 && !isStreaming && !isUploading;

  return (
    <div
      className={cn(
        "border-t border-border bg-background px-4 py-3 transition-colors",
        isDragging && "bg-primary/5 border-primary"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="max-w-3xl mx-auto flex flex-col gap-2">
        {hasPending && (
          <div className="flex flex-wrap gap-1.5" role="list" aria-label="Pending attachments">
            {pending.map((item) => (
              <div key={item.uid} role="listitem">
                <AttachmentPill item={item} onRemove={() => remove(item.uid)} />
              </div>
            ))}
          </div>
        )}

        {isDragging && (
          <div className="text-xs text-primary text-center py-1 font-medium">
            Drop files to attach
          </div>
        )}

        <div className="flex gap-2 items-end">
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

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            aria-hidden="true"
            onChange={handleFileChange}
          />

          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            title="Attach file"
            aria-label="Attach file"
            onClick={() => fileInputRef.current?.click()}
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
              disabled={!canSend}
              title="Send"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

export default Composer;
