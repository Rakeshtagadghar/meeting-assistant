"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Badge, Spinner } from "@ainotes/ui";
import { useNote } from "../hooks/use-note";
import { useAutosave } from "../hooks/use-autosave";
import { useJobProgress } from "../hooks/use-job-progress";
import { useSpeechRecognition } from "../../capture/hooks/use-speech-recognition";
import { SummaryPanel } from "./SummaryPanel";
import { ProgressBanner } from "./ProgressBanner";

export interface NoteEditorProps {
  noteId: string;
}

export function NoteEditor({ noteId }: NoteEditorProps) {
  const { note, summaries, artifacts, loading, error, refetch } =
    useNote(noteId);
  const { save, saving, lastSaved } = useAutosave(noteId);
  const {
    progressPct,
    message,
    status: jobStatus,
    startTracking,
    cancelJob,
    reset: resetJob,
  } = useJobProgress();
  const {
    transcript,
    isListening,
    isSupported: speechSupported,
    start: startListening,
    stop: stopListening,
    clear: clearTranscript,
  } = useSpeechRecognition();

  const isGenerating = jobStatus === "QUEUED" || jobStatus === "RUNNING";

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [pinned, setPinned] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const baseContentRef = useRef("");

  // Sync local state when note loads
  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.contentPlain);
      setTags([...note.tags]);
      setPinned(note.pinned);
    }
  }, [note]);

  // Snapshot content when recording starts
  useEffect(() => {
    if (isListening) {
      baseContentRef.current = content;
    }
    // Only capture snapshot when isListening transitions to true
  }, [isListening]);

  // Replace content with base + transcript while listening
  useEffect(() => {
    if (isListening && transcript) {
      const base = baseContentRef.current;
      setContent(base + (base ? "\n" : "") + transcript);
    }
  }, [transcript, isListening]);

  // When speech stops, save the content
  useEffect(() => {
    if (!isListening && transcript) {
      save({ contentPlain: content });
      clearTranscript();
    }
  }, [isListening, transcript, save, clearTranscript, content]);

  // Refresh note data when job completes
  useEffect(() => {
    if (jobStatus === "COMPLETED") {
      void refetch();
    }
  }, [jobStatus, refetch]);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      setTitle(newTitle);
      save({ title: newTitle });
    },
    [save],
  );

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      setContent(newContent);
      save({ contentPlain: newContent });
    },
    [save],
  );

  const handleTogglePin = useCallback(() => {
    const newPinned = !pinned;
    setPinned(newPinned);
    save({ pinned: newPinned });
  }, [pinned, save]);

  const handleAddTag = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && tagInput.trim()) {
        e.preventDefault();
        const newTag = tagInput.trim().toLowerCase();
        if (!tags.includes(newTag)) {
          const newTags = [...tags, newTag];
          setTags(newTags);
          save({ tags: newTags });
        }
        setTagInput("");
      }
    },
    [tagInput, tags, save],
  );

  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      const newTags = tags.filter((t) => t !== tagToRemove);
      setTags(newTags);
      save({ tags: newTags });
    },
    [tags, save],
  );

  const handleGenerate = useCallback(async () => {
    try {
      resetJob();
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId }),
      });
      if (!res.ok) throw new Error("Failed to start generation");
      const data = await res.json();
      if (data.jobId) {
        startTracking(data.jobId);
      }
    } catch {
      // TODO: show toast
    }
  }, [noteId, resetJob, startTracking]);

  const handleCancelGenerate = useCallback(async () => {
    await cancelJob();
  }, [cancelJob]);

  const handleToggleSpeech = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center p-16"
        data-testid="editor-loading"
      >
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8" role="alert">
        <div className="rounded-xl bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-warm-400">
          {saving && (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
              Saving...
            </span>
          )}
          {lastSaved && !saving && (
            <span>Saved {lastSaved.toLocaleTimeString()}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTogglePin}
            aria-label={pinned ? "Unpin note" : "Pin note"}
            aria-pressed={pinned}
            className={`rounded-lg p-2 transition-colors ${
              pinned
                ? "bg-amber-50 text-amber-600"
                : "text-warm-400 hover:bg-warm-100 hover:text-warm-500"
            }`}
          >
            <svg
              className="h-5 w-5"
              fill={pinned ? "currentColor" : "none"}
              viewBox="0 0 20 20"
              stroke="currentColor"
              strokeWidth={pinned ? 0 : 1.5}
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
              />
            </svg>
            {isGenerating ? "Generating..." : "Generate"}
          </button>
        </div>
      </div>

      {/* Progress banner */}
      <ProgressBanner
        status={jobStatus}
        progressPct={progressPct}
        message={message}
        onCancel={handleCancelGenerate}
      />

      {/* Note content card */}
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-warm-200/60">
        {/* Title */}
        <input
          value={title}
          onChange={handleTitleChange}
          placeholder="Untitled note"
          aria-label="Note title"
          className="w-full border-none bg-transparent text-2xl font-semibold text-gray-900 placeholder:text-warm-300 focus:outline-none"
        />

        {/* Meta row */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-warm-400">
          {note && (
            <>
              <span className="flex items-center gap-1.5">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                  />
                </svg>
                {new Date(note.updatedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <span className="flex items-center gap-1.5">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                  />
                </svg>
                Me
              </span>
            </>
          )}
          {/* Tags inline */}
          {tags.map((tag) => (
            <Badge key={tag} removable onRemove={() => handleRemoveTag(tag)}>
              {tag}
            </Badge>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            placeholder="+ Add tag"
            aria-label="Add tag"
            className="border-none bg-transparent text-sm text-warm-400 placeholder:text-warm-300 focus:outline-none"
            style={{ width: Math.max(80, tagInput.length * 8 + 20) }}
          />
        </div>

        {/* Divider */}
        <hr className="my-6 border-warm-200/60" />

        {/* Content area */}
        <textarea
          value={content}
          onChange={handleContentChange}
          placeholder="Start writing or use the microphone to dictate..."
          aria-label="Note content"
          className="min-h-[400px] w-full resize-none border-none bg-transparent text-[15px] leading-relaxed text-gray-800 placeholder:text-warm-300 focus:outline-none"
          rows={16}
        />
      </div>

      {/* Bottom toolbar - Speech to text */}
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-white px-5 py-3 shadow-sm ring-1 ring-warm-200/60">
        <div className="flex items-center gap-3">
          {speechSupported && (
            <button
              onClick={handleToggleSpeech}
              aria-label={isListening ? "Stop recording" : "Start recording"}
              className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                isListening
                  ? "bg-red-50 text-red-600 ring-2 ring-red-200"
                  : "bg-warm-100 text-warm-500 hover:bg-warm-200 hover:text-gray-700"
              }`}
            >
              {isListening && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                </span>
              )}
              <svg
                className="h-5 w-5"
                fill={isListening ? "currentColor" : "none"}
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
                />
              </svg>
              {isListening ? "Listening..." : "Dictate"}
            </button>
          )}
          {isListening && (
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-4 w-1 animate-pulse rounded-full bg-red-400"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
              <span className="text-xs text-warm-400">
                Speak now — text appears live above
              </span>
            </div>
          )}
        </div>

        <span className="text-xs text-warm-400">
          {content.split(/\s+/).filter(Boolean).length} words
        </span>
      </div>

      {/* AI Summaries */}
      <div className="mt-6">
        <SummaryPanel
          summaries={summaries}
          artifacts={artifacts}
          isGenerating={isGenerating}
        />
      </div>
    </div>
  );
}
