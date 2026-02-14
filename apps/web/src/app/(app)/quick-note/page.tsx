"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ASRProvider } from "@ainotes/core";
import { Button, ConsentModal } from "@ainotes/ui";
import { useTranscriptSession } from "@/features/capture/hooks/use-transcript-session";
import { createASRProvider } from "@/features/capture/lib/asr-provider-factory";
import { TranscriptBubble } from "@/features/capture/components/TranscriptBubble";
import { TranscriptHeader } from "@/features/capture/components/TranscriptHeader";
import { TranscriptFooter } from "@/features/capture/components/TranscriptFooter";
import { EchoCancellationBanner } from "@/features/capture/components/EchoCancellationBanner";

export default function QuickNotePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [asrProvider, setAsrProvider] = useState<ASRProvider | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Initialize ASR provider on mount
  useEffect(() => {
    let disposed = false;
    void createASRProvider().then((provider) => {
      if (!disposed) setAsrProvider(provider);
    });
    return () => {
      disposed = true;
      asrProvider?.dispose();
    };
  }, []);

  const {
    windowState,
    finalChunks,
    partialText,
    showConsentModal,
    micLevel,
    language,
    setLanguage,
    requestStart,
    confirmConsent,
    cancelConsent,
    pause,
    resume,
    stop,
    reset,
    copyTranscript,
    providerName,
    modelLoadProgress,
    noteId,
  } = useTranscriptSession(asrProvider);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new chunks
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [finalChunks, partialText]);

  // Filter chunks by search query
  const filteredChunks = useMemo(() => {
    if (!searchQuery.trim()) return finalChunks;
    const q = searchQuery.toLowerCase();
    return finalChunks.filter(
      (c) =>
        c.text.toLowerCase().includes(q) ||
        c.speaker?.toLowerCase().includes(q),
    );
  }, [finalChunks, searchQuery]);

  const isDesktop =
    typeof globalThis !== "undefined" &&
    ("__TAURI__" in globalThis || "__TAURI_INTERNALS__" in globalThis);
  const isWindows =
    typeof navigator !== "undefined" && navigator.userAgent.includes("Windows");

  const providerLabel: Record<string, string> = {
    "web-speech-api": "Web Speech API",
    "whisper-wasm": "Whisper WASM",
    "whisper-cpp": "Whisper CPP",
  };

  // Speaker color palette for visual differentiation
  const speakerColors: Record<string, { bg: string; label: string }> = {
    "Speaker 1": { bg: "bg-[#d4e4bc]", label: "text-green-700" },
    "Speaker 2": { bg: "bg-warm-200", label: "text-warm-600" },
    "Speaker 3": { bg: "bg-blue-100", label: "text-blue-700" },
    "Speaker 4": { bg: "bg-purple-100", label: "text-purple-700" },
  };

  const getSpeakerColor = (speaker: string | null) =>
    speaker
      ? (speakerColors[speaker] ?? {
          bg: "bg-warm-200",
          label: "text-warm-600",
        })
      : null;


  const autoStartTriggeredRef = useRef(false);

  useEffect(() => {
    const shouldAutoStart = searchParams.get("autostart") === "1";
    if (!shouldAutoStart || autoStartTriggeredRef.current) {
      return;
    }
    if (windowState !== "idle") {
      return;
    }

    autoStartTriggeredRef.current = true;
    requestStart();
  }, [requestStart, searchParams, windowState]);

  const handleClose = () => {
    if (windowState === "listening" || windowState === "paused") {
      stop();
    }
    router.push("/notes");
  };

  const handleCopy = async () => {
    const ok = await copyTranscript();
    if (ok) {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  const handleNewMeeting = () => {
    reset();
    setSearchQuery("");
    setCopyFeedback(false);
  };

  return (
    <div className="flex h-screen flex-col bg-bg-secondary">
      {/* Header */}
      <TranscriptHeader onClose={handleClose} onSearch={setSearchQuery} />

      {/* Model loading progress overlay */}
      {modelLoadProgress !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-80 rounded-xl bg-white p-6 shadow-lg">
            <div className="mb-3 text-sm font-medium text-gray-700">
              Downloading Whisper model...
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-warm-200">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${modelLoadProgress}%` }}
              />
            </div>
            <div className="mt-2 text-center text-xs text-warm-400">
              {modelLoadProgress}% — First-time download, cached for future use
            </div>
          </div>
        </div>
      )}

      {/* ASR engine badge + echo cancellation banner */}
      {providerName && windowState !== "idle" && (
        <div className="flex items-center gap-2 border-b border-warm-200/40 bg-warm-50 px-3 py-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            {providerLabel[providerName] ?? providerName}
          </span>
        </div>
      )}
      <EchoCancellationBanner show={isDesktop && isWindows} />

      {/* Main: transcript feed */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {windowState === "idle" && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-full bg-warm-100 p-4">
              <svg
                className="h-8 w-8 text-warm-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                Ready to transcribe
              </p>
              <p className="mt-1 text-xs text-warm-400">
                Click below to start a meeting transcription
              </p>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" onClick={handleClose}>
                Back
              </Button>

              <Button variant="outline" onClick={requestStart}>
                Start Meeting
              </Button>
            </div>
          </div>
        )}

        {/* Active/paused/processing transcript feed */}
        {windowState !== "idle" && windowState !== "completed" && (
          <div className="flex flex-col gap-2.5">
            {filteredChunks.length === 0 && !partialText && (
              <div className="flex h-full flex-col items-center justify-center gap-3 py-24 text-center">
                <div className="relative">
                  <div className="h-12 w-12 rounded-full bg-red-100 p-3">
                    <div className="h-full w-full rounded-full bg-red-400 animate-pulse" />
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-700">
                  {windowState === "paused"
                    ? "Transcription paused"
                    : "Listening..."}
                </p>
                <p className="text-xs text-warm-400">
                  {windowState === "paused"
                    ? "Resume to continue capturing audio"
                    : "Start speaking and your words will appear here"}
                </p>
              </div>
            )}
            {filteredChunks.map((chunk) => {
              const colors = getSpeakerColor(chunk.speaker);
              return (
                <TranscriptBubble
                  key={chunk.id}
                  speaker={chunk.speaker}
                  text={chunk.text}
                  alignment={chunk.speaker === "Speaker 1" ? "right" : "left"}
                  speakerClassName={colors?.label}
                  bubbleClassName={colors?.bg}
                />
              );
            })}

            {/* Partial text (in-progress transcription) */}
            {partialText && !searchQuery && (
              <TranscriptBubble
                speaker={null}
                text={partialText}
                isPartial
                alignment="left"
              />
            )}

            <div ref={bottomRef} />
          </div>
        )}

        {/* Completed state */}
        {windowState === "completed" && (
          <>
            {finalChunks.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {filteredChunks.map((chunk) => {
                  const colors = getSpeakerColor(chunk.speaker);
                  return (
                    <TranscriptBubble
                      key={chunk.id}
                      speaker={chunk.speaker}
                      text={chunk.text}
                      alignment={
                        chunk.speaker === "Speaker 1" ? "right" : "left"
                      }
                      speakerClassName={colors?.label}
                      bubbleClassName={colors?.bg}
                    />
                  );
                })}
                {searchQuery && filteredChunks.length === 0 && (
                  <p className="py-4 text-center text-sm text-warm-400">
                    No matches found.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-warm-400">No transcript recorded.</p>
              </div>
            )}

            {/* Post-transcript actions */}
            <div className="mt-6 flex flex-col items-center gap-3 border-t border-warm-200/60 pt-4">
              <p className="text-xs font-medium text-green-600">
                Transcript saved
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  disabled={finalChunks.length === 0}
                >
                  {copyFeedback ? "Copied!" : "Copy Transcript"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleNewMeeting}>
                  New Meeting
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    router.push(noteId ? `/note/${noteId}` : "/notes")
                  }
                >
                  {noteId ? "View Note" : "Go to Notes"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer: controls (active states only) */}
      {(windowState === "listening" ||
        windowState === "paused" ||
        windowState === "processing") && (
        <TranscriptFooter
          windowState={windowState}
          micLevel={micLevel}
          language={language}
          onLanguageChange={setLanguage}
          onPauseResume={windowState === "paused" ? resume : pause}
          onStop={stop}
        />
      )}

      {/* Consent modal */}
      <ConsentModal
        open={showConsentModal}
        onClose={cancelConsent}
        onConfirm={confirmConsent}
      />
    </div>
  );
}
