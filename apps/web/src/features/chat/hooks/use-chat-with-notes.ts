"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChatCitation,
  ChatFilters,
  ChatMessage,
  ChatMode,
  ChatScope,
  ChatSession,
  ChatSessionDetail,
} from "../types";

interface SendChatInput {
  message: string;
  scope: ChatScope;
  mode: ChatMode;
  filters?: ChatFilters;
}

interface UseChatWithNotesResult {
  sessions: ChatSession[];
  activeSession: ChatSession | null;
  messages: ChatMessage[];
  isHydrated: boolean;
  isStreaming: boolean;
  error: string | null;
  statusMessage: string | null;
  sendMessage: (input: SendChatInput) => Promise<void>;
  startNewSession: () => void;
  selectSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  clearAllSessions: () => Promise<void>;
}

function createMessageId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sortSessionsByRecent(sessions: ChatSession[]): ChatSession[] {
  return [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

function isChatSession(value: unknown): value is ChatSession {
  if (!value || typeof value !== "object") return false;
  const session = value as ChatSession;
  return (
    typeof session.id === "string" &&
    typeof session.title === "string" &&
    typeof session.scope === "string" &&
    typeof session.mode === "string" &&
    typeof session.createdAt === "string" &&
    typeof session.updatedAt === "string"
  );
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as ChatMessage;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string"
  );
}

function isChatSessionDetail(value: unknown): value is ChatSessionDetail {
  if (!isChatSession(value)) return false;
  const detail = value as ChatSessionDetail;
  return Array.isArray(detail.messages) && detail.messages.every(isChatMessage);
}

export function useChatWithNotes(): UseChatWithNotesResult {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const sessionsRef = useRef<ChatSession[]>([]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const refreshSessions = useCallback(async (): Promise<ChatSession[]> => {
    const response = await fetch("/api/chat/sessions", {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch chat sessions (${response.status})`);
    }
    const body = (await response.json()) as { sessions?: unknown };
    const nextSessions = Array.isArray(body.sessions)
      ? body.sessions.filter(isChatSession)
      : [];
    const sorted = sortSessionsByRecent(nextSessions);
    setSessions(sorted);
    return sorted;
  }, []);

  const selectSession = useCallback(
    async (sessionId: string): Promise<void> => {
      setError(null);
      const response = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Failed to load chat session (${response.status})`);
      }

      const body = (await response.json()) as { session?: unknown };
      if (!isChatSessionDetail(body.session)) {
        throw new Error("Invalid session payload");
      }

      const detail = body.session;
      setActiveSessionId(detail.id);
      setMessages(detail.messages);
      setSessions((prev) => {
        const without = prev.filter((session) => session.id !== detail.id);
        return sortSessionsByRecent([detail, ...without]);
      });
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const loaded = await refreshSessions();
        if (cancelled) return;
        if (loaded[0]?.id) {
          await selectSession(loaded[0].id);
        }
      } catch (initError: unknown) {
        if (cancelled) return;
        const msg =
          initError instanceof Error
            ? initError.message
            : "Failed to load chats";
        setError(msg);
      } finally {
        if (!cancelled) setIsHydrated(true);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [refreshSessions, selectSession]);

  const createSession = useCallback(
    async (input: SendChatInput, title: string): Promise<ChatSession> => {
      const response = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          scope: input.scope,
          mode: input.mode,
          filters: input.filters ?? {},
        }),
      });
      if (!response.ok) {
        throw new Error(`Failed to create chat session (${response.status})`);
      }
      const body = (await response.json()) as { session?: unknown };
      if (!isChatSession(body.session)) {
        throw new Error("Invalid created session payload");
      }
      const session = body.session;
      setSessions((prev) =>
        sortSessionsByRecent([session, ...prev]).slice(0, 50),
      );
      setActiveSessionId(session.id);
      setMessages([]);
      return session;
    },
    [],
  );

  const sendMessage = useCallback(
    async (input: SendChatInput) => {
      const trimmed = input.message.trim();
      if (!trimmed || isStreaming) return;

      setError(null);
      setStatusMessage("Connecting...");
      setIsStreaming(true);

      let sessionId = activeSessionId;
      if (!sessionId) {
        const created = await createSession(input, trimmed);
        sessionId = created.id;
      }

      const stableSessionId = sessionId;
      const userMessageId = createMessageId();
      const assistantMessageId = createMessageId();
      const optimisticUser: ChatMessage = {
        id: userMessageId,
        role: "user",
        content: trimmed,
      };
      const optimisticAssistant: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        citations: [],
      };

      setMessages((prev) => [...prev, optimisticUser, optimisticAssistant]);
      setSessions((prev) =>
        sortSessionsByRecent(
          prev.map((session) =>
            session.id === stableSessionId
              ? {
                  ...session,
                  title: session.title || trimmed,
                  updatedAt: new Date().toISOString(),
                }
              : session,
          ),
        ),
      );

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            scope: input.scope,
            mode: input.mode,
            filters: input.filters ?? {},
            conversationId: stableSessionId,
          }),
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          throw new Error(
            body?.error?.message ?? `Request failed (${response.status})`,
          );
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const eventBlock of events) {
            const lines = eventBlock.split("\n");
            let eventName = "";
            let eventData = "";

            for (const line of lines) {
              if (line.startsWith("event: ")) {
                eventName = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                eventData = line.slice(6);
              }
            }

            if (!eventData) continue;

            try {
              const parsed = JSON.parse(eventData) as Record<string, unknown>;

              if (eventName === "status") {
                const msg = parsed["message"];
                if (typeof msg === "string") setStatusMessage(msg);
              }

              if (eventName === "citations") {
                const citations = parsed["citations"];
                if (Array.isArray(citations)) {
                  setMessages((prev) =>
                    prev.map((message) =>
                      message.id === assistantMessageId
                        ? { ...message, citations: citations as ChatCitation[] }
                        : message,
                    ),
                  );
                }
              }

              if (eventName === "token") {
                const token = parsed["text"];
                if (typeof token === "string" && token.length > 0) {
                  setMessages((prev) =>
                    prev.map((message) =>
                      message.id === assistantMessageId
                        ? { ...message, content: message.content + token }
                        : message,
                    ),
                  );
                }
              }

              if (eventName === "done") {
                setStatusMessage(null);
              }

              if (eventName === "error") {
                const msg = parsed["error"];
                if (typeof msg === "string") {
                  setError(msg);
                } else {
                  setError("Chat failed");
                }
              }
            } catch {
              // Ignore malformed SSE payloads.
            }
          }
        }

        await refreshSessions();
        if (stableSessionId) {
          await selectSession(stableSessionId);
        }
      } catch (streamError: unknown) {
        const msg =
          streamError instanceof Error ? streamError.message : "Chat failed";
        setError(msg);
        setStatusMessage(null);
      } finally {
        setIsStreaming(false);
      }
    },
    [
      activeSessionId,
      createSession,
      isStreaming,
      refreshSessions,
      selectSession,
    ],
  );

  const startNewSession = useCallback(() => {
    setActiveSessionId(null);
    setMessages([]);
    setError(null);
    setStatusMessage(null);
  }, []);

  const deleteSession = useCallback(
    async (sessionId: string): Promise<void> => {
      const response = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`Failed to delete chat session (${response.status})`);
      }

      setSessions((prev) => prev.filter((session) => session.id !== sessionId));
      if (activeSessionId === sessionId) {
        const remaining = sessionsRef.current.filter(
          (session) => session.id !== sessionId,
        );
        const nextSession = remaining[0];
        if (nextSession?.id) {
          await selectSession(nextSession.id);
        } else {
          setActiveSessionId(null);
          setMessages([]);
        }
      }
    },
    [activeSessionId, selectSession],
  );

  const clearAllSessions = useCallback(async (): Promise<void> => {
    const response = await fetch("/api/chat/sessions", {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`Failed to clear chat sessions (${response.status})`);
    }
    setSessions([]);
    setActiveSessionId(null);
    setMessages([]);
    setError(null);
    setStatusMessage(null);
  }, []);

  return useMemo(
    () => ({
      sessions,
      activeSession,
      messages,
      isHydrated,
      isStreaming,
      error,
      statusMessage,
      sendMessage,
      startNewSession,
      selectSession,
      deleteSession,
      clearAllSessions,
    }),
    [
      sessions,
      activeSession,
      messages,
      isHydrated,
      isStreaming,
      error,
      statusMessage,
      sendMessage,
      startNewSession,
      selectSession,
      deleteSession,
      clearAllSessions,
    ],
  );
}
