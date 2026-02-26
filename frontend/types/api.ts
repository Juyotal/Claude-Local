import { z } from "zod";

// ── Models ──────────────────────────────────────────────────────────────────

export const ModelInfoSchema = z.object({
  id: z.string(),
  label: z.string(),
});
export type ModelInfo = z.infer<typeof ModelInfoSchema>;

// ── Conversations ────────────────────────────────────────────────────────────

export const ConversationOutSchema = z.object({
  id: z.string(),
  title: z.string(),
  model: z.string(),
  system_prompt: z.string().nullable(),
  web_search_enabled: z.boolean(),
  updated_at: z.string(),
  message_count: z.number(),
});
export type ConversationOut = z.infer<typeof ConversationOutSchema>;

export const CitationOutSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string().nullable(),
  cited_text: z.string().nullable(),
  start_index: z.number().nullable(),
  end_index: z.number().nullable(),
});
export type CitationOut = z.infer<typeof CitationOutSchema>;

export const MessageOutSchema = z.object({
  id: z.string(),
  role: z.string(),
  content: z.string(),
  created_at: z.string(),
  citations: z.array(CitationOutSchema).default([]),
});
export type MessageOut = z.infer<typeof MessageOutSchema>;

export const ConversationDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  model: z.string(),
  system_prompt: z.string().nullable(),
  web_search_enabled: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  messages: z.array(MessageOutSchema),
});
export type ConversationDetail = z.infer<typeof ConversationDetailSchema>;

export const AttachmentOutSchema = z.object({
  id: z.string(),
  filename: z.string(),
  media_type: z.string(),
  size_bytes: z.number(),
});
export type AttachmentOut = z.infer<typeof AttachmentOutSchema>;

// ── Request bodies ───────────────────────────────────────────────────────────

export interface ConversationCreate {
  title?: string;
  model?: string;
  system_prompt?: string | null;
}

export interface ConversationUpdate {
  title?: string;
  model?: string;
  system_prompt?: string | null;
  web_search_enabled?: boolean;
}

export interface MessageCreate {
  content: string;
  attachment_ids?: string[];
}
