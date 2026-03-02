import { z } from "zod";
import { streamSSE } from "@/lib/sse";
import type { SSEEvent } from "@/lib/sse";
import {
  AttachmentOutSchema,
  ConversationDetailSchema,
  ConversationOutSchema,
  ModelInfoSchema,
  type AttachmentOut,
  type ConversationCreate,
  type ConversationDetail,
  type ConversationOut,
  type ConversationUpdate,
  type ModelInfo,
} from "@/types/api";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function apiFetch<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  init?: RequestInit
): Promise<z.output<S>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  const json: unknown = await res.json();
  return schema.parse(json) as z.output<S>;
}

// ── Models ───────────────────────────────────────────────────────────────────

export async function listModels(): Promise<ModelInfo[]> {
  return apiFetch("/api/models", z.array(ModelInfoSchema));
}

// ── Conversations ────────────────────────────────────────────────────────────

export async function listConversations(): Promise<ConversationOut[]> {
  return apiFetch("/api/conversations", z.array(ConversationOutSchema));
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  return apiFetch(`/api/conversations/${id}`, ConversationDetailSchema);
}

export async function createConversation(
  body?: ConversationCreate
): Promise<ConversationOut> {
  return apiFetch("/api/conversations", ConversationOutSchema, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function updateConversation(
  id: string,
  patch: ConversationUpdate
): Promise<ConversationOut> {
  return apiFetch(`/api/conversations/${id}`, ConversationOutSchema, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteConversation(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/conversations/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
}

// ── Messages ─────────────────────────────────────────────────────────────────

export function sendMessage(
  conversationId: string,
  content: string,
  attachmentIds?: string[],
  signal?: AbortSignal
): AsyncGenerator<SSEEvent> {
  return streamSSE(
    `${BASE_URL}/api/conversations/${conversationId}/messages`,
    { content, attachment_ids: attachmentIds ?? [] },
    signal
  );
}

// ── Uploads (stubs — real impl in Deliverable 7) ─────────────────────────────

export async function uploadFile(
  _conversationId: string,
  _file: File
): Promise<AttachmentOut> {
  console.log("uploadFile: Coming in Deliverable 7");
  return AttachmentOutSchema.parse({
    id: "",
    filename: _file.name,
    media_type: _file.type,
    size_bytes: _file.size,
  });
}

export async function deleteUpload(
  _conversationId: string,
  _attachmentId: string
): Promise<void> {
  console.log("deleteUpload: Coming in Deliverable 7");
}
