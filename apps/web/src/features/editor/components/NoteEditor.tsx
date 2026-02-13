"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Badge, Spinner, Dropdown } from "@ainotes/ui";
import { useNote } from "../hooks/use-note";
import { useAutosave } from "../hooks/use-autosave";
import { useDictation } from "../../capture/hooks/use-dictation";
import { useStreamingSummary } from "../../ai/hooks/use-streaming-summary";
import { SummaryPanel } from "./SummaryPanel";
import { StreamingSummary } from "../../ai/components/StreamingSummary";
import { DownloadMenu } from "../../ai/components/DownloadMenu";
import {
  generateEmailContent,
  getComposeUrl,
} from "../../email/utils/email-generator";

export interface NoteEditorProps {
  noteId: string;
}

export function NoteEditor({ noteId }: NoteEditorProps) {
  const { note, summaries, artifacts, loading, error, refetch } =
    useNote(noteId);
  const { save, saving, lastSaved } = useAutosave(noteId);
  const {
    streamedText,
    status: streamingStatus,
    error: streamingError,
    generatedTitle,
    generate: generateStream,
    cancel: cancelStream,
    reset: resetStream,
  } = useStreamingSummary(noteId);

  // Update title when automatically generated
  useEffect(() => {
    if (generatedTitle) {
      setTitle(generatedTitle);
    }
  }, [generatedTitle]);

  const {
    transcript,
    partialText,
    isListening,
    isProcessing,
    modelLoadProgress,
    start: startListening,
    stop: stopListening,
    clear: clearTranscript,
  } = useDictation();

  const isGenerating =
    streamingStatus === "connecting" || streamingStatus === "streaming";

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

  // Replace content with base + transcript + partial while listening
  useEffect(() => {
    if (isListening && (transcript || partialText)) {
      const base = baseContentRef.current;
      const dictated = [transcript, partialText].filter(Boolean).join(" ");
      setContent(base + (base ? "\n" : "") + dictated);
    }
  }, [transcript, partialText, isListening]);

  // When speech stops, save the content
  useEffect(() => {
    if (!isListening && transcript) {
      save({ contentPlain: content });
      clearTranscript();
    }
  }, [isListening, transcript, save, clearTranscript, content]);

  // Refresh note data when streaming completes, then hide the streaming card
  useEffect(() => {
    if (streamingStatus === "done") {
      void refetch().then(() => resetStream());
    }
  }, [streamingStatus, refetch, resetStream]);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      setTitle(newTitle);
      save({ title: newTitle });
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
    // Pass current content to avoid race condition where DB isn't updated yet
    await generateStream(content);
  }, [generateStream, content]);

  const handleCancelGenerate = useCallback(() => {
    cancelStream();
  }, [cancelStream]);

  const handleToggleSpeech = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      void startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Helper to get best summary text (markdown artifact or plain text from summary objects)
  const getBestSummaryText = useCallback(() => {
    // Prefer markdown artifact
    const markdownArtifact = artifacts.find(
      (a) =>
        a.type === "MARKDOWN_SUMMARY" && a.status === "READY" && a.storagePath,
    );
    if (markdownArtifact?.storagePath) {
      return markdownArtifact.storagePath;
    }

    // Fallback to text from summaries (simple concatenation)
    return summaries
      .map((s) => {
        if (s.kind === "SUMMARY") return s.payload.oneLiner || "";
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
  }, [artifacts, summaries]);

  const handleCopySummary = useCallback(async () => {
    const text = getBestSummaryText();
    if (!text) return;

    try {
      const { body, htmlBody } = generateEmailContent(title, text, {
        includeLinks: true,
      });

      // Write both text and html to clipboard so it pastes nicely in rich editors
      const blobText = new Blob([body], { type: "text/plain" });
      const blobHtml = new Blob([htmlBody], { type: "text/html" });
      const item = new ClipboardItem({
        "text/plain": blobText,
        "text/html": blobHtml,
      });

      await navigator.clipboard.write([item]);
    } catch (err) {
      console.error("Failed to copy", err);
      // Fallback to simple text copy if rich copy fails
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        console.error("Fallback copy failed", e);
      }
    }
  }, [getBestSummaryText, title]);

  const handleDraftEmail = useCallback(() => {
    const text = getBestSummaryText();
    if (!text) return;

    const emailContent = generateEmailContent(title, text, {
      includeLinks: true, // we can support this later with real links
    });

    // Try Gmail first
    const gmailUrl = getComposeUrl("gmail", emailContent);
    const windowRef = window.open(gmailUrl, "_blank");

    // Fallback to mailto if blocked or failed (though window.open usually returns object even if blocked in some browsers, checking logic is fuzzy.
    // We'll just copy to clipboard as backup regardless)
    if (
      !windowRef ||
      windowRef.closed ||
      typeof windowRef.closed === "undefined"
    ) {
      window.location.href = getComposeUrl("mailto", emailContent);
    }
  }, [getBestSummaryText, title]);

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
    <div className="mx-auto px-6 py-8">
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
          {error && <div className="text-sm text-red-500">{error}</div>}

          <button
            onClick={handleToggleSpeech}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              isListening
                ? "bg-red-50 text-red-600 ring-1 ring-red-200 hover:bg-red-100"
                : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
            }`}
          >
            {isListening ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                </span>
                Stop
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4 text-gray-500"
                  fill="none"
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
                Dictate
              </>
            )}
          </button>

          {(content.trim().length > 0 ||
            summaries.length > 0 ||
            artifacts.length > 0) && (
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
          )}

          {(summaries.length > 0 || artifacts.length > 0) && (
            <DownloadMenu artifacts={artifacts} noteId={noteId} />
          )}

          {/* More actions menu */}
          <Dropdown
            align="right"
            trigger={
              <button
                aria-label="More options"
                className="flex items-center justify-center rounded-lg p-2 text-warm-400 transition-colors hover:bg-warm-100 hover:text-warm-500"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z"
                  />
                </svg>
              </button>
            }
            items={[
              {
                id: "draft-email",
                label: (
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 text-warm-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
                      />
                    </svg>
                    <span>Draft email</span>
                  </div>
                ),
                onClick: handleDraftEmail,
              },
              {
                id: "copy",
                label: (
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 text-warm-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"
                      />
                    </svg>
                    <span>Copy</span>
                  </div>
                ),
                onClick: handleCopySummary,
              },
            ]}
          />
        </div>
      </div>

      {/* AI streaming summary */}
      {streamingStatus !== "idle" && (
        <StreamingSummary
          streamedText={streamedText}
          status={streamingStatus}
          error={streamingError}
          onCancel={handleCancelGenerate}
        />
      )}

      {/* Title & Tags Card */}
      <div className="mb-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-warm-200/60">
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
      </div>

      <div className="mb-6">
        <SummaryPanel
          noteId={noteId}
          summaries={summaries}
          artifacts={artifacts}
          isGenerating={isGenerating}
          dictation={{
            isListening,
            isProcessing,
            transcript,
            partialText,
            toggleRecording: handleToggleSpeech,
          }}
          transcriptContent={content}
          onTranscriptChange={(val) => {
            setContent(val);
            save({ contentPlain: val });
          }}
        />
      </div>

      {/* Model loading progress overlay */}
      {modelLoadProgress !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-80 rounded-xl bg-white p-6 shadow-lg">
            <div className="mb-3 text-sm font-medium text-gray-700">
              Downloading Whisper model...
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-warm-200">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${modelLoadProgress}%` }}
              />
            </div>
            <div className="mt-2 text-center text-xs text-warm-400">
              {modelLoadProgress}% — First-time download, cached for future use
            </div>
          </div>
        </div>
      )}

      <div className="mt-2 flex justify-end px-2 text-xs text-warm-400">
        {content.split(/\s+/).filter(Boolean).length} words
      </div>
    </div>
  );
}
