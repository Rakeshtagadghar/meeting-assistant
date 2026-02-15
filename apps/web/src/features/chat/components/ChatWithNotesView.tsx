"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Streamdown } from "streamdown";
import {
  CHAT_MODES,
  CHAT_SCOPES,
  type ChatFilters,
  type ChatMode,
  type ChatScope,
  type ChatSession,
} from "../types";
import { useChatWithNotes } from "../hooks/use-chat-with-notes";

const QUICK_PROMPTS = [
  "List recent todos",
  "Write weekly recap",
  "Summarize last meeting",
  "What did we decide about the API?",
  "Find all action items for me",
];

const SCOPE_LABELS: Record<ChatScope, string> = {
  my_notes: "My notes",
  all_meetings: "All meetings",
  folder: "Specific folder",
  tag: "Specific tag",
  date_range: "Date range",
  shared_with_me: "Shared with me",
};

const MODE_LABELS: Record<ChatMode, string> = {
  auto: "Auto",
  qa: "Q&A",
  summarize: "Summarize",
  action_items: "Extract action items",
  email_draft: "Draft email",
};

function formatSessionDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getSessionPreview(session: ChatSession): string {
  const text = (session.preview ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "No messages yet";
  return text.length > 90 ? `${text.slice(0, 87)}...` : text;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export function ChatWithNotesView() {
  const [scope, setScope] = useState<ChatScope>("my_notes");
  const [mode, setMode] = useState<ChatMode>("auto");
  const [message, setMessage] = useState("");
  const [folderId, setFolderId] = useState("");
  const [tag, setTag] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [noteType, setNoteType] = useState<"" | "FREEFORM" | "MEETING">("");
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
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
  } = useChatWithNotes();

  const latestAssistant = useMemo(
    () =>
      [...messages]
        .reverse()
        .find(
          (entry) =>
            entry.role === "assistant" && entry.content.trim().length > 0,
        ),
    [messages],
  );

  useEffect(() => {
    if (!activeSession) return;
    setScope(activeSession.scope);
    setMode(activeSession.mode);
    setFolderId(activeSession.filters?.folderId ?? "");
    setTag(activeSession.filters?.tag ?? "");
    setNoteType(activeSession.filters?.noteType ?? "");
    const from = activeSession.filters?.dateRange?.from;
    const to = activeSession.filters?.dateRange?.to;
    setDateFrom(from ? from.slice(0, 10) : "");
    setDateTo(to ? to.slice(0, 10) : "");
  }, [activeSession]);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [messages, statusMessage]);

  const filters: ChatFilters = useMemo(() => {
    return {
      ...(folderId.trim() ? { folderId: folderId.trim() } : {}),
      ...(tag.trim() ? { tag: tag.trim() } : {}),
      ...(noteType ? { noteType } : {}),
      ...(dateFrom || dateTo
        ? {
            dateRange: {
              ...(dateFrom ? { from: new Date(dateFrom).toISOString() } : {}),
              ...(dateTo ? { to: new Date(dateTo).toISOString() } : {}),
            },
          }
        : {}),
    };
  }, [dateFrom, dateTo, folderId, noteType, tag]);

  const handleSend = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setActionFeedback(null);
    setMessage("");
    await sendMessage({ message: trimmed, scope, mode, filters });
  }, [filters, message, mode, scope, sendMessage]);

  const handleQuickPrompt = useCallback(
    async (prompt: string) => {
      if (isStreaming) return;
      setMessage("");
      setActionFeedback(null);
      await sendMessage({ message: prompt, scope, mode, filters });
    },
    [filters, isStreaming, mode, scope, sendMessage],
  );

  const handleCreateNote = useCallback(async () => {
    if (!latestAssistant || isCreatingNote) return;

    setIsCreatingNote(true);
    setActionFeedback(null);
    try {
      const now = new Date();
      const title = `Chat answer ${now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })}`;
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          contentRich: {},
          contentPlain: latestAssistant.content,
          type: "FREEFORM",
          tags: ["chat"],
        }),
      });
      if (!response.ok) throw new Error("Failed to create note");

      const body = (await response.json()) as { noteId: string };
      setActionFeedback(`Saved as note. Open: /note/${body.noteId}`);
    } catch (createError: unknown) {
      const msg =
        createError instanceof Error
          ? createError.message
          : "Failed to create note";
      setActionFeedback(msg);
    } finally {
      setIsCreatingNote(false);
    }
  }, [isCreatingNote, latestAssistant]);

  const handleCopy = useCallback(async () => {
    if (!latestAssistant) return;
    try {
      await navigator.clipboard.writeText(latestAssistant.content);
      setActionFeedback("Copied answer to clipboard.");
    } catch {
      setActionFeedback("Could not copy to clipboard.");
    }
  }, [latestAssistant]);

  const handleDraftEmail = useCallback(() => {
    if (!latestAssistant) return;
    const subject = encodeURIComponent("Meeting notes follow-up");
    const body = encodeURIComponent(latestAssistant.content);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }, [latestAssistant]);

  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      setActionFeedback(null);
      try {
        await selectSession(sessionId);
      } catch (selectError: unknown) {
        const msg =
          selectError instanceof Error
            ? selectError.message
            : "Failed to load session";
        setActionFeedback(msg);
      }
    },
    [selectSession],
  );

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      setActionFeedback(null);
      try {
        await deleteSession(sessionId);
      } catch (deleteError: unknown) {
        const msg =
          deleteError instanceof Error
            ? deleteError.message
            : "Failed to delete session";
        setActionFeedback(msg);
      }
    },
    [deleteSession],
  );

  const handleClearAll = useCallback(async () => {
    setActionFeedback(null);
    try {
      await clearAllSessions();
    } catch (clearError: unknown) {
      const msg =
        clearError instanceof Error
          ? clearError.message
          : "Failed to clear sessions";
      setActionFeedback(msg);
    }
  }, [clearAllSessions]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(155deg,#f8fafc_0%,#f5f3ff_35%,#fef9f4_100%)]">
      <div className="pointer-events-none absolute -left-28 top-10 h-72 w-72 rounded-full bg-cyan-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full bg-fuchsia-200/40 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl" />

      <div className="relative mx-auto px-3 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <motion.aside
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ duration: 0.35 }}
            className="relative rounded-3xl border border-white/70 bg-white/65 p-4 shadow-[0_20px_70px_-30px_rgba(49,46,129,0.45)] backdrop-blur-xl"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h1
                className="text-lg font-semibold tracking-tight text-slate-900"
                style={{
                  fontFamily:
                    '"Space Grotesk", "Manrope", "Segoe UI", sans-serif',
                }}
              >
                Conversations
              </h1>
              <button
                type="button"
                onClick={startNewSession}
                className="rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm transition hover:brightness-105"
              >
                New
              </button>
            </div>
            <div className="mb-4">
              <button
                type="button"
                onClick={() => void handleClearAll()}
                className="w-full rounded-lg border border-slate-200/80 bg-white/70 px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
              >
                Clear all sessions
              </button>
            </div>
            <div className="max-h-[76vh] space-y-2 overflow-y-auto pr-1">
              {!isHydrated ? (
                <p className="rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 text-xs text-slate-500">
                  Loading sessions...
                </p>
              ) : sessions.length === 0 ? (
                <p className="rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 text-xs text-slate-500">
                  No sessions yet. Start your first chat.
                </p>
              ) : (
                sessions.map((session, index) => {
                  const active = session.id === activeSession?.id;
                  return (
                    <motion.div
                      key={session.id}
                      variants={fadeUp}
                      initial="hidden"
                      animate="show"
                      transition={{
                        delay: Math.min(index * 0.03, 0.22),
                        duration: 0.25,
                      }}
                      role="button"
                      tabIndex={0}
                      onClick={() => void handleSelectSession(session.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          void handleSelectSession(session.id);
                        }
                      }}
                      className={`group w-full rounded-2xl border px-3 py-2 text-left transition-all duration-200 ${
                        active
                          ? "border-indigo-300/80 bg-gradient-to-r from-indigo-50/95 to-sky-50/95 shadow-sm"
                          : "border-slate-200/80 bg-white/80 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {session.title}
                        </p>
                        <span className="text-[11px] text-slate-500">
                          {formatSessionDate(session.updatedAt)}
                        </span>
                      </div>
                      <p className="mb-2 text-xs text-slate-600">
                        {getSessionPreview(session)}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                          {MODE_LABELS[session.mode]}
                        </span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDeleteSession(session.id);
                          }}
                          className="text-[11px] text-slate-500 transition hover:text-rose-600"
                        >
                          Delete
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.aside>

          <motion.section
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ duration: 0.4, delay: 0.05 }}
            className="space-y-4"
          >
            <div className="rounded-3xl border border-white/70 bg-white/65 p-5 shadow-[0_20px_70px_-30px_rgba(15,23,42,0.35)] backdrop-blur-xl">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2
                    className="bg-gradient-to-r from-slate-900 via-indigo-800 to-sky-700 bg-clip-text text-3xl font-semibold text-transparent"
                    style={{
                      fontFamily:
                        '"Space Grotesk", "Manrope", "Segoe UI", sans-serif',
                    }}
                  >
                    {activeSession
                      ? activeSession.title
                      : "Chat with your notes"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Ask questions, summarize decisions, and extract action items
                    instantly.
                  </p>
                </div>
                {activeSession && (
                  <span className="rounded-xl bg-slate-100/90 px-3 py-1 text-xs font-medium text-slate-600">
                    Updated {formatSessionDate(activeSession.updatedAt)}
                  </span>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">Scope</span>
                  <select
                    value={scope}
                    onChange={(event) =>
                      setScope(event.target.value as ChatScope)
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none"
                  >
                    {CHAT_SCOPES.map((option) => (
                      <option key={option} value={option}>
                        {SCOPE_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">Mode</span>
                  <select
                    value={mode}
                    onChange={(event) =>
                      setMode(event.target.value as ChatMode)
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none"
                  >
                    {CHAT_MODES.map((option) => (
                      <option key={option} value={option}>
                        {MODE_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            {scope === "date_range" && (
              <div className="rounded-3xl border border-white/70 bg-white/65 p-4 shadow-[0_20px_70px_-30px_rgba(15,23,42,0.25)] backdrop-blur-xl">
                <div className="grid gap-3 md:grid-cols-2">
                  {/* {(scope === "folder" || scope === "my_notes") && (
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-700">Folder ID</span>
                    <input
                      value={folderId}
                      onChange={(event) => setFolderId(event.target.value)}
                      placeholder="folder uuid"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none"
                    />
                  </label>
                )}
                {(scope === "tag" || scope === "my_notes") && (
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-700">Tag</span>
                    <input
                      value={tag}
                      onChange={(event) => setTag(event.target.value)}
                      placeholder="e.g. project-x"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none"
                    />
                  </label>
                )} */}
                  {scope === "date_range" && (
                    <>
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium text-slate-700">From</span>
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(event) => setDateFrom(event.target.value)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium text-slate-700">To</span>
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(event) => setDateTo(event.target.value)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none"
                        />
                      </label>
                    </>
                  )}
                  {/* <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">Note type</span>
                  <select
                    value={noteType}
                    onChange={(event) =>
                      setNoteType(event.target.value as "" | "FREEFORM" | "MEETING")
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none"
                  >
                    <option value="">All</option>
                    <option value="FREEFORM">Freeform</option>
                    <option value="MEETING">Meeting</option>
                  </select>
                </label> */}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void handleQuickPrompt(prompt)}
                  disabled={isStreaming}
                  className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-60"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div
              ref={containerRef}
              className="max-h-[56vh] overflow-y-auto rounded-3xl border border-white/70 bg-white/70 p-4 shadow-[0_20px_70px_-35px_rgba(2,6,23,0.45)] backdrop-blur-xl"
            >
              {messages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-5 text-sm text-slate-500">
                  Start a new chat or continue a previous conversation.
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((entry, index) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.2,
                        delay: Math.min(index * 0.02, 0.15),
                      }}
                      className={
                        entry.role === "user"
                          ? "ml-auto max-w-[82%] rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-900 px-4 py-3 text-sm text-white shadow-lg"
                          : "max-w-[94%] rounded-2xl border border-indigo-100 bg-gradient-to-r from-white to-indigo-50/80 px-4 py-3 text-sm text-slate-800 shadow-sm"
                      }
                    >
                      {entry.role === "assistant" ? (
                        <div className="streaming-prose">
                          <Streamdown>{entry.content || "..."}</Streamdown>
                        </div>
                      ) : (
                        <p>{entry.content}</p>
                      )}
                      {entry.citations && entry.citations.length > 0 && (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-white/90 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Citations
                          </p>
                          <ul className="space-y-2 text-xs text-slate-600">
                            {entry.citations.map((citation) => (
                              <li key={citation.citation_id}>
                                <div className="font-medium text-slate-700">
                                  [{citation.citation_id}] {citation.title}
                                </div>
                                <p>{citation.snippet}</p>
                                <div className="mt-1 flex items-center gap-2">
                                  <Link
                                    href={`/note/${citation.noteId}`}
                                    className="text-indigo-600 hover:underline"
                                  >
                                    Open note
                                  </Link>
                                  {citation.time_range_optional && (
                                    <span className="text-slate-500">
                                      {citation.time_range_optional}
                                    </span>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
              {statusMessage && (
                <p className="mt-3 inline-flex items-center rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-700">
                  {statusMessage}
                </p>
              )}
              {error && (
                <p className="mt-3 inline-flex items-center rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-700">
                  {error}
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/70 p-4 shadow-[0_20px_70px_-30px_rgba(2,6,23,0.35)] backdrop-blur-xl">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Ask about decisions, action items, summaries, or next steps..."
                className="mb-3 h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-inner focus:border-indigo-400 focus:outline-none"
                onKeyDown={(event) => {
                  if (
                    (event.metaKey || event.ctrlKey) &&
                    event.key === "Enter"
                  ) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  Press Ctrl/Cmd + Enter to send
                </p>
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={isStreaming || message.trim().length === 0}
                  className="rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:brightness-110 disabled:opacity-60"
                >
                  {isStreaming ? "Answering..." : "Send"}
                </button>
              </div>
            </div>

            {latestAssistant && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/70 bg-white/70 p-3 backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => void handleCreateNote()}
                  disabled={isCreatingNote}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-60"
                >
                  {isCreatingNote ? "Saving..." : "Create note"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={handleDraftEmail}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
                >
                  Draft email
                </button>
                <span className="text-xs text-slate-500">
                  Export PDF remains available from saved notes.
                </span>
              </div>
            )}

            {actionFeedback && (
              <p className="inline-flex rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600">
                {actionFeedback}
              </p>
            )}
          </motion.section>
        </div>
      </div>
    </div>
  );
}
