"use client";

import { useState, useCallback } from "react";
import { Globe } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import ModelPicker from "@/components/ModelPicker";
import SystemPromptEditor from "@/components/SystemPromptEditor";
import MessageList from "@/components/MessageList";
import Composer from "@/components/Composer";
import { updateConversation } from "@/lib/api";
import { useChat } from "@/lib/useChat";
import type { ConversationDetail } from "@/types/api";

interface Props {
  conversation: ConversationDetail;
}

export default function ChatPane({ conversation: initial }: Props) {
  const [conv, setConv] = useState(initial);
  const { messages, isStreaming, send, stop, retry } = useChat(
    conv.id,
    initial.messages
  );

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
    async (content: string) => {
      const newTitle = await send(content);
      if (newTitle) {
        setConv((c) => ({ ...c, title: newTitle }));
        // Signal Sidebar to refresh its conversation list
        window.dispatchEvent(new CustomEvent("conversation-updated"));
      }
    },
    [send]
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background">
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
      <Composer isStreaming={isStreaming} onSend={handleSend} onStop={stop} />
    </div>
  );
}
