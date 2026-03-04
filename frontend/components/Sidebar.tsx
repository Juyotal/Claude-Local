"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Plus, MessageSquare, MoreHorizontal, Pencil, Trash2, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/ThemeProvider";
import {
  listConversations,
  createConversation,
  deleteConversation,
  updateConversation,
} from "@/lib/api";
import type { ConversationOut } from "@/types/api";

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function Sidebar() {
  const router = useRouter();
  const params = useParams();
  const activeId = typeof params?.id === "string" ? params.id : null;
  const { theme, toggle } = useTheme();

  const [conversations, setConversations] = useState<ConversationOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const reload = useCallback(async () => {
    try {
      const data = await listConversations();
      setConversations(data);
    } catch {
      // silently fail — backend may not be running yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Refresh when ChatPane signals a title change (e.g. auto-title after first message)
  useEffect(() => {
    function onConversationUpdated() {
      void reload();
    }
    window.addEventListener("conversation-updated", onConversationUpdated);
    return () =>
      window.removeEventListener("conversation-updated", onConversationUpdated);
  }, [reload]);

  async function handleNew() {
    try {
      const conv = await createConversation();
      await reload();
      router.push(`/c/${conv.id}`);
    } catch (err) {
      console.error("Failed to create conversation", err);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteConversation(id);
      if (activeId === id) router.push("/");
      await reload();
    } catch (err) {
      console.error("Failed to delete conversation", err);
    }
  }

  function startRename(conv: ConversationOut) {
    setRenamingId(conv.id);
    setRenameValue(conv.title);
  }

  async function commitRename(id: string) {
    const trimmed = renameValue.trim();
    if (trimmed) {
      try {
        await updateConversation(id, { title: trimmed });
        await reload();
      } catch (err) {
        console.error("Failed to rename conversation", err);
      }
    }
    setRenamingId(null);
  }

  return (
    <aside className="flex flex-col w-[260px] shrink-0 border-r border-border bg-card h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <span className="font-semibold text-sm tracking-tight">Claude Local</span>
        <button
          onClick={toggle}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      {/* New conversation */}
      <div className="px-2 pt-2 pb-1">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-sm h-9"
          onClick={handleNew}
        >
          <Plus className="h-4 w-4" />
          New conversation
        </Button>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1 px-2 py-1">
        {loading ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">Loading…</div>
        ) : conversations.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">No conversations yet.</div>
        ) : (
          <ul className="space-y-0.5">
            {conversations.map((conv) => (
              <li key={conv.id}>
                {renamingId === conv.id ? (
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(conv.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void commitRename(conv.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="h-8 text-sm my-0.5"
                  />
                ) : (
                  <div
                    className={`group flex items-center gap-1 rounded-md px-2 py-2 cursor-pointer transition-colors ${
                      activeId === conv.id
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/60 text-foreground"
                    }`}
                    onClick={() => router.push(`/c/${conv.id}`)}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate leading-tight">{conv.title}</p>
                      <p className="text-xs text-muted-foreground">{relativeTime(conv.updated_at)}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Conversation options"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => startRename(conv)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-500 focus:text-red-500"
                          onClick={() => handleDelete(conv.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </aside>
  );
}
