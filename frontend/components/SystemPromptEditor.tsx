"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { updateConversation } from "@/lib/api";

interface Props {
  conversationId: string;
  systemPrompt: string | null;
  onSave: (prompt: string | null) => void;
}

export default function SystemPromptEditor({ conversationId, systemPrompt, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(systemPrompt ?? "");
  const [saving, setSaving] = useState(false);

  function handleOpen(o: boolean) {
    if (o) setValue(systemPrompt ?? "");
    setOpen(o);
  }

  async function handleSave() {
    setSaving(true);
    const trimmed = value.trim() || null;
    try {
      await updateConversation(conversationId, { system_prompt: trimmed });
      onSave(trimmed);
      setOpen(false);
    } catch (err) {
      console.error("Failed to save system prompt", err);
    } finally {
      setSaving(false);
    }
  }

  const hasPrompt = Boolean(systemPrompt?.trim());

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <button
          className={`flex items-center gap-1.5 text-sm px-2 py-1 rounded-md transition-colors ${
            hasPrompt
              ? "text-primary hover:bg-accent"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}
          title="System prompt"
        >
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">System</span>
          {hasPrompt && (
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>System Prompt</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="system-prompt" className="sr-only">
            System prompt
          </Label>
          <Textarea
            id="system-prompt"
            placeholder="Give Claude a persona, instructions, or context that apply to the whole conversation…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="min-h-[180px] font-mono text-sm"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
