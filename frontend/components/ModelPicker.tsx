"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listModels, updateConversation } from "@/lib/api";
import type { ModelInfo } from "@/types/api";

interface Props {
  conversationId: string;
  currentModel: string;
  onModelChange: (model: string) => void;
}

export default function ModelPicker({ conversationId, currentModel, onModelChange }: Props) {
  const [models, setModels] = useState<ModelInfo[]>([]);

  useEffect(() => {
    listModels()
      .then(setModels)
      .catch(() => {});
  }, []);

  async function handleSelect(modelId: string) {
    onModelChange(modelId);
    try {
      await updateConversation(conversationId, { model: modelId });
    } catch (err) {
      console.error("Failed to update model", err);
    }
  }

  const currentLabel =
    models.find((m) => m.id === currentModel)?.label ?? currentModel;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent">
          {currentLabel}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {models.map((m) => (
          <DropdownMenuItem
            key={m.id}
            onClick={() => handleSelect(m.id)}
            className={m.id === currentModel ? "font-medium" : ""}
          >
            {m.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
