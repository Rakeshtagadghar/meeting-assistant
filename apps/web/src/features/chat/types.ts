export const CHAT_SCOPES = [
  "my_notes",
  "all_meetings",
  "folder",
  "tag",
  "date_range",
  "shared_with_me",
] as const;

export type ChatScope = (typeof CHAT_SCOPES)[number];

export const CHAT_MODES = [
  "auto",
  "qa",
  "summarize",
  "action_items",
  "email_draft",
] as const;

export type ChatMode = (typeof CHAT_MODES)[number];

export interface ChatDateRangeFilter {
  from?: string;
  to?: string;
}

export interface ChatFilters {
  folderId?: string;
  tag?: string;
  dateRange?: ChatDateRangeFilter;
  noteType?: "FREEFORM" | "MEETING";
}

export interface ChatCitation {
  citation_id: string;
  noteId: string;
  title: string;
  sourceType: "note" | "transcript" | "summary";
  snippet: string;
  time_range_optional?: string;
}

export interface ChatSearchResult {
  noteId: string;
  title: string;
  sourceType: "note" | "transcript" | "summary";
  snippet: string;
  score: number;
  timeRange?: string;
}

export interface ChatRequestBody {
  message: string;
  scope?: ChatScope;
  filters?: ChatFilters;
  mode?: ChatMode;
  conversationId?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: ChatCitation[];
}

export interface ChatSession {
  id: string;
  title: string;
  scope: ChatScope;
  mode: ChatMode;
  filters?: ChatFilters;
  preview?: string;
  messageCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSessionDetail extends ChatSession {
  messages: ChatMessage[];
}
