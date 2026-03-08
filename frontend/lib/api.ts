import { z } from "zod";
import { streamSSE } from "@/lib/sse";
import type { SSEEvent } from "@/lib/sse";
import {
  AttachmentOutSchema,
  ConfigSchema,
  ConversationDetailSchema,
  ConversationOutSchema,
  ModelInfoSchema,
  type AttachmentOut,
  type Config,
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

// ── Config ────────────────────────────────────────────────────────────────────

export async function getConfig(): Promise<Config> {
  return apiFetch("/api/config", ConfigSchema);
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
  return apiFetch(`/api/conversations/${id}`, ConversationDetailSchema, { cache: "no-store" });
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

// ── Uploads ──────────────────────────────────────────────────────────────────

export async function uploadFile(file: File): Promise<AttachmentOut> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/api/uploads`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  const json: unknown = await res.json();
  return AttachmentOutSchema.parse(json);
}

export async function deleteUpload(attachmentId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/uploads/${attachmentId}`, {
    method: "DELETE",
  });
  // 404 means it was already cleaned up — treat as success
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
}

// ── Health ────────────────────────────────────────────────────────────────────

export async function getHealth(): Promise<{
  status: string;
  db: string;
  anthropic_key_present: boolean;
}> {
  return apiFetch(
    "/health",
    z.object({
      status: z.string(),
      db: z.string(),
      anthropic_key_present: z.boolean(),
    })
  );
}

// ── Attachments ───────────────────────────────────────────────────────────────

export function attachmentUrl(attachmentId: string): string {
  return `${BASE_URL}/api/attachments/${attachmentId}`;
}
