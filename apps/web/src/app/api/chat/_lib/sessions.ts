import type { Prisma } from "@prisma/client";
import type {
  ChatFilters,
  ChatMessage,
  ChatMode,
  ChatScope,
  ChatSession,
  ChatSessionDetail,
} from "@/features/chat/types";

export interface ChatSessionRow {
  id: string;
  title: string;
  scope: string;
  mode: string;
  filters: unknown;
  created_at: Date;
  updated_at: Date;
  preview?: string | null;
  message_count?: number | bigint | null;
}

export interface ChatMessageRow {
  id: string;
  role: string;
  content: string;
  citations: unknown;
  created_at: Date;
}

export function normalizeDbScope(scope: string): ChatScope {
  switch (scope) {
    case "my_notes":
    case "all_meetings":
    case "folder":
    case "tag":
    case "date_range":
    case "shared_with_me":
      return scope;
    default:
      return "my_notes";
  }
}

export function normalizeDbMode(mode: string): ChatMode {
  switch (mode) {
    case "qa":
    case "summarize":
    case "action_items":
    case "email_draft":
      return mode;
    default:
      return "auto";
  }
}

export function parseFilters(value: unknown): ChatFilters {
  if (!value || typeof value !== "object") return {};
  const obj = value as Record<string, unknown>;
  const dateRange = obj["dateRange"] as Record<string, unknown> | undefined;
  return {
    ...(typeof obj["folderId"] === "string"
      ? { folderId: obj["folderId"] }
      : {}),
    ...(typeof obj["tag"] === "string" ? { tag: obj["tag"] } : {}),
    ...(obj["noteType"] === "FREEFORM" || obj["noteType"] === "MEETING"
      ? { noteType: obj["noteType"] }
      : {}),
    ...(dateRange &&
    (typeof dateRange["from"] === "string" ||
      typeof dateRange["to"] === "string")
      ? {
          dateRange: {
            ...(typeof dateRange["from"] === "string"
              ? { from: dateRange["from"] }
              : {}),
            ...(typeof dateRange["to"] === "string"
              ? { to: dateRange["to"] }
              : {}),
          },
        }
      : {}),
  };
}

export function mapSessionRow(row: ChatSessionRow): ChatSession {
  return {
    id: row.id,
    title: row.title || "Untitled chat",
    scope: normalizeDbScope(row.scope),
    mode: normalizeDbMode(row.mode),
    filters: parseFilters(row.filters),
    preview: row.preview ?? undefined,
    messageCount:
      row.message_count !== undefined && row.message_count !== null
        ? Number(row.message_count)
        : undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function mapMessageRow(row: ChatMessageRow): ChatMessage {
  let citations: ChatMessage["citations"] = undefined;
  const raw = row.citations as Prisma.JsonValue | null;
  if (Array.isArray(raw)) {
    citations = raw as unknown as ChatMessage["citations"];
  }

  return {
    id: row.id,
    role: row.role === "user" ? "user" : "assistant",
    content: row.content,
    ...(citations ? { citations } : {}),
  };
}

export function buildSessionDetail(
  sessionRow: ChatSessionRow,
  messageRows: ChatMessageRow[],
): ChatSessionDetail {
  return {
    ...mapSessionRow(sessionRow),
    messages: messageRows.map(mapMessageRow),
  };
}

export function sessionTitleFromMessage(message: string): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) return "New chat";
  return normalized.length > 60 ? `${normalized.slice(0, 57)}...` : normalized;
}
