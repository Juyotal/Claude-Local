"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Globe } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import ModelPicker from "@/components/ModelPicker";
import SystemPromptEditor from "@/components/SystemPromptEditor";
import MessageList from "@/components/MessageList";
import Composer, { type ComposerHandle } from "@/components/Composer";
import { updateConversation, getConfig, getHealth } from "@/lib/api";
import { useChat } from "@/lib/useChat";
import type { ConversationDetail, Config } from "@/types/api";

interface Props {
  conversation: ConversationDetail;
}

export default function ChatPane({ conversation: initial }: Props) {
  const [conv, setConv] = useState(initial);
  const [config, setConfig] = useState<Config | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const composerRef = useRef<ComposerHandle>(null);

  const { messages, isStreaming, send, stop, retry } = useChat(
    conv.id,
    initial.messages
  );

  useEffect(() => {
    void getConfig()
      .then(setConfig)
      .catch(() => null);
    void getHealth()
      .then((h) => setApiKeyMissing(!h.anthropic_key_present))
      .catch(() => null);
  }, []);

  function handleModelChange(model: string) {
    setConv((c) => ({ ...c, model }));
  }

  function handleSystemPromptSave(system_prompt: string | null) {
    setConv((c) => ({ ...c, system_prompt }));
  }

  async function handleWebSearchToggle(enabled: boolean) {
    setConv((c) => ({ ...c, web_search_enabled: enabled }));
    try {
      await updateConversation(conv.id, { web_search_enabled: enabled });
    } catch (err) {
      console.error("Failed to update web search setting", err);
      setConv((c) => ({ ...c, web_search_enabled: !enabled }));
    }
  }

  const handleSend = useCallback(
    async (content: string, attachmentIds: string[]) => {
      const newTitle = await send(content, attachmentIds);
      if (newTitle) {
        setConv((c) => ({ ...c, title: newTitle }));
        window.dispatchEvent(new CustomEvent("conversation-updated"));
      }
    },
    [send]
  );

  // Forward drag events from the full chat pane to the Composer
  function handlePaneDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
    }
  }

  function handlePaneDrop(e: React.DragEvent) {
    if (e.dataTransfer.files.length) {
      e.preventDefault();
      composerRef.current?.addFiles(e.dataTransfer.files);
    }
  }

  return (
    <div
      className="flex flex-col flex-1 min-h-0 bg-background"
      onDragOver={handlePaneDragOver}
      onDrop={handlePaneDrop}
    >
      {/* API key missing banner */}
      {apiKeyMissing && (
        <div className="bg-amber-50 dark:bg-amber-950 border-b border-amber-300 dark:border-amber-700 px-4 py-2 text-sm text-amber-800 dark:text-amber-200 text-center">
          <strong>API key not set.</strong> Add{" "}
          <code className="font-mono text-xs bg-amber-100 dark:bg-amber-900 px-1 rounded">
            ANTHROPIC_API_KEY
          </code>{" "}
          to{" "}
          <code className="font-mono text-xs bg-amber-100 dark:bg-amber-900 px-1 rounded">
            backend/.env
          </code>{" "}
          and restart the server.
        </div>
      )}

      {/* Header */}
      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-medium truncate" title={conv.title}>
            {conv.title}
          </h1>
        </div>

        <ModelPicker
          conversationId={conv.id}
          currentModel={conv.model}
          onModelChange={handleModelChange}
        />

        <SystemPromptEditor
          conversationId={conv.id}
          systemPrompt={conv.system_prompt}
          onSave={handleSystemPromptSave}
        />

        <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">Web search</span>
          <Switch
            checked={conv.web_search_enabled}
            onCheckedChange={handleWebSearchToggle}
          />
        </label>
      </header>

      {/* Messages */}
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        onRetry={() => void retry()}
      />

      {/* Composer */}
      <Composer
        ref={composerRef}
        isStreaming={isStreaming}
        onSend={handleSend}
        onStop={stop}
        maxUploadBytes={config?.max_upload_bytes}
        supportedMediaTypes={config?.supported_media_types}
      />
    </div>
  );
}
