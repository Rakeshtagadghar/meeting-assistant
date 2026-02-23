"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ASRProvider } from "@ainotes/core";
import { Button, ConsentModal } from "@ainotes/ui";
import { useTranscriptSession } from "@/features/capture/hooks/use-transcript-session";
import { useLiveAnalysis } from "@/features/capture/hooks/use-live-analysis";
import { createASRProvider } from "@/features/capture/lib/asr-provider-factory";
import { TranscriptBubble } from "@/features/capture/components/TranscriptBubble";
import { TranscriptHeader } from "@/features/capture/components/TranscriptHeader";
import { TranscriptFooter } from "@/features/capture/components/TranscriptFooter";
import { EchoCancellationBanner } from "@/features/capture/components/EchoCancellationBanner";
import { LiveAnalysisPanel } from "@/features/capture/components/LiveAnalysisPanel";
import { LiveNudgesTray } from "@/features/capture/components/LiveNudgesTray";

function QuickNotePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [asrProvider, setAsrProvider] = useState<ASRProvider | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isClientRuntime, setIsClientRuntime] = useState(false);
  const [speakerAliases, setSpeakerAliases] = useState<Record<string, string>>(
    {},
  );

  // Initialize ASR provider on mount
  useEffect(() => {
    let disposed = false;
    let createdProvider: ASRProvider | null = null;
    void createASRProvider().then((provider) => {
      if (disposed) {
        provider.dispose();
        return;
      }
      createdProvider = provider;
      setAsrProvider(provider);
    });
    return () => {
      disposed = true;
      createdProvider?.dispose();
    };
  }, []);

  useEffect(() => {
    setIsClientRuntime(true);
  }, []);

  const {
    windowState,
    finalChunks,
    partialText,
    showConsentModal,
    micLevel,
    language,
    setLanguage,
    captureSystemAudio,
    setCaptureSystemAudio,
    speakerRoleOverrides,
    setSpeakerRoleOverride,
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
    sessionId,
    noteId,
  } = useTranscriptSession(asrProvider);

  const liveAnalysis = useLiveAnalysis({
    sessionId,
    windowState,
    finalChunks,
    partialText,
  });

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

  const detectedSpeakers = useMemo(() => {
    return [
      ...new Set(finalChunks.map((chunk) => chunk.speaker).filter(Boolean)),
    ]
      .map((speaker) => speaker as string)
      .sort();
  }, [finalChunks]);
  const primarySpeaker = detectedSpeakers[0] ?? "Speaker 1";
  const primarySalesSpeaker =
    detectedSpeakers.find(
      (speakerId) => speakerRoleOverrides[speakerId] === "SALES",
    ) ?? primarySpeaker;

  useEffect(() => {
    if (detectedSpeakers.length === 0) return;
    setSpeakerAliases((current) => {
      const next = { ...current };
      let changed = false;
      for (const speaker of detectedSpeakers) {
        if (!next[speaker]) {
          next[speaker] = speaker;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [detectedSpeakers]);

  const displayChunks = useMemo(() => {
    return filteredChunks.map((chunk, index) => {
      const rawSpeaker = chunk.speaker ?? "Speaker 1";
      const speaker = speakerAliases[rawSpeaker] || rawSpeaker;
      const previous = index > 0 ? filteredChunks[index - 1] : null;
      const previousRawSpeaker = previous?.speaker ?? "Speaker 1";
      const showSpeaker = previousRawSpeaker !== rawSpeaker;
      return {
        ...chunk,
        rawSpeaker,
        speaker,
        showSpeaker,
      };
    });
  }, [filteredChunks, speakerAliases]);

  const isDesktop =
    isClientRuntime &&
    typeof globalThis !== "undefined" &&
    ("__TAURI__" in globalThis || "__TAURI_INTERNALS__" in globalThis);
  const isWindows =
    isClientRuntime &&
    typeof navigator !== "undefined" &&
    navigator.userAgent.includes("Windows");

  const providerLabel: Record<string, string> = {
    "elevenlabs-realtime": "ElevenLabs Realtime",
    "groq-whisper-realtime-fallback": "Groq Whisper Fallback",
    "web-speech-api": "Web Speech API",
    "whisper-wasm": "Whisper WASM",
    "whisper-cpp": "Whisper CPP",
  };

  const speakerPalette = [
    { bubble: "bg-emerald-50 border-emerald-200", label: "text-emerald-800" },
    { bubble: "bg-amber-50 border-amber-200", label: "text-amber-800" },
    { bubble: "bg-sky-50 border-sky-200", label: "text-sky-800" },
    { bubble: "bg-rose-50 border-rose-200", label: "text-rose-800" },
    { bubble: "bg-lime-50 border-lime-200", label: "text-lime-800" },
  ] as const;

  const getSpeakerColor = (speaker: string | null) => {
    if (!speaker) return null;
    let hash = 0;
    for (let i = 0; i < speaker.length; i++) {
      hash = (hash * 31 + speaker.charCodeAt(i)) >>> 0;
    }
    return speakerPalette[hash % speakerPalette.length]!;
  };

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
    setSpeakerAliases({});
  };

  const showLiveAnalysisPanel = false;

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
              {modelLoadProgress}% - First-time download, cached for future use
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
          {!isDesktop && (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              {captureSystemAudio
                ? "Capture: Mic + System Audio"
                : "Capture: Mic only"}
            </span>
          )}
          <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
            Auto diarization on
          </span>
        </div>
      )}
      <EchoCancellationBanner show={isDesktop && isWindows} />

      <div className="min-h-0 flex-1 overflow-hidden">
        <div
          className={`grid h-full min-h-0 ${
            showLiveAnalysisPanel
              ? "grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] md:grid-cols-2 md:grid-rows-1"
              : "grid-cols-1"
          }`}
        >
          {/* Main: transcript feed */}
          <div className="min-h-0 overflow-y-auto px-3 py-3">
            {windowState === "idle" && (
              <div className="mx-auto flex h-full w-full max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
                <div className="rounded-full bg-emerald-100 p-4">
                  <svg
                    className="h-8 w-8 text-emerald-700"
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
                  <p className="text-base font-semibold text-gray-800">
                    Ready to transcribe with diarization
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Capture speaker-separated transcript for live meetings.
                  </p>
                </div>
                {!isDesktop && (
                  <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-left">
                    <label className="flex items-center justify-between text-xs font-medium text-emerald-900">
                      <span>Capture system audio with mic (Web)</span>
                      <input
                        type="checkbox"
                        checked={captureSystemAudio}
                        onChange={(event) =>
                          setCaptureSystemAudio(event.target.checked)
                        }
                        className="h-4 w-4 rounded border-emerald-300 text-emerald-700"
                      />
                    </label>
                    <p className="mt-1 text-[11px] text-emerald-800/90">
                      When enabled, you will be prompted to share a tab/window
                      audio stream in addition to microphone.
                    </p>
                  </div>
                )}
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

            {windowState !== "idle" && (
              <>
                {detectedSpeakers.length > 0 && (
                  <section className="mb-3 rounded-xl border border-warm-200/70 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-warm-500">
                        Diarization Mapping
                      </p>
                      <span className="text-[10px] text-gray-500">
                        Rename and map Me/Client
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {detectedSpeakers.map((speakerId) => (
                        <div key={speakerId} className="text-xs text-gray-700">
                          <span className="mb-1 block text-[11px] text-warm-500">
                            {speakerId}
                          </span>
                          <input
                            value={speakerAliases[speakerId] ?? speakerId}
                            onChange={(event) =>
                              setSpeakerAliases((current) => ({
                                ...current,
                                [speakerId]: event.target.value || speakerId,
                              }))
                            }
                            className="w-full rounded-md border border-warm-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-indigo-400 focus:outline-none"
                          />
                          <select
                            value={speakerRoleOverrides[speakerId] ?? "AUTO"}
                            onChange={(event) =>
                              setSpeakerRoleOverride(
                                speakerId,
                                event.target.value as
                                  | "SALES"
                                  | "CLIENT"
                                  | "AUTO",
                              )
                            }
                            className="mt-1 w-full rounded-md border border-warm-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-indigo-400 focus:outline-none"
                          >
                            <option value="AUTO">Role: Auto</option>
                            <option value="SALES">Role: Me</option>
                            <option value="CLIENT">Role: Client</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {windowState !== "completed" &&
                  filteredChunks.length === 0 &&
                  !partialText && (
                    <div className="flex h-full flex-col items-center justify-center gap-3 py-24 text-center">
                      <div className="relative">
                        <div className="h-12 w-12 rounded-full bg-red-100 p-3">
                          <div className="h-full w-full animate-pulse rounded-full bg-red-400" />
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

                {windowState === "completed" && finalChunks.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-sm text-warm-400">
                      No transcript recorded.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {displayChunks.map((chunk) => {
                      const colors = getSpeakerColor(chunk.rawSpeaker);
                      return (
                        <TranscriptBubble
                          key={chunk.id}
                          speaker={chunk.speaker}
                          text={chunk.text}
                          timestamp={new Date(
                            chunk.tEndMs,
                          ).toLocaleTimeString()}
                          showTimestamp
                          showSpeaker={chunk.showSpeaker}
                          confidence={chunk.confidence}
                          alignment={
                            chunk.rawSpeaker === primarySalesSpeaker
                              ? "right"
                              : "left"
                          }
                          speakerClassName={colors?.label}
                          bubbleClassName={colors?.bubble}
                        />
                      );
                    })}

                    {partialText && !searchQuery && (
                      <TranscriptBubble
                        speaker={
                          speakerAliases[primarySalesSpeaker] ??
                          primarySalesSpeaker
                        }
                        text={partialText}
                        isPartial
                        alignment="left"
                      />
                    )}

                    {searchQuery && displayChunks.length === 0 && (
                      <p className="py-4 text-center text-sm text-warm-400">
                        No matches found.
                      </p>
                    )}
                    <div ref={bottomRef} />
                  </div>
                )}

                {/* Completed state */}
                {windowState === "completed" && (
                  <>
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleNewMeeting}
                        >
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
              </>
            )}
          </div>

          {showLiveAnalysisPanel && (
            <div className="min-h-0 border-t border-warm-200/70 md:border-l md:border-t-0">
              <LiveAnalysisPanel
                isSessionCompleted={windowState === "completed"}
                enabled={liveAnalysis.enabled}
                setEnabled={liveAnalysis.setEnabled}
                privacyMode={liveAnalysis.privacyMode}
                setPrivacyMode={liveAnalysis.setPrivacyMode}
                sensitivity={liveAnalysis.sensitivity}
                setSensitivity={liveAnalysis.setSensitivity}
                coachingAggressiveness={liveAnalysis.coachingAggressiveness}
                setCoachingAggressiveness={
                  liveAnalysis.setCoachingAggressiveness
                }
                streamStatus={liveAnalysis.streamStatus}
                latencyMs={liveAnalysis.latencyMs}
                metrics={liveAnalysis.metrics}
                summary={liveAnalysis.summary}
                coach={liveAnalysis.coach}
                insights={liveAnalysis.insights}
                usedSuggestionIds={liveAnalysis.usedSuggestionIds}
                suggestionRatings={liveAnalysis.suggestionRatings}
                onCopySuggestion={liveAnalysis.copySuggestion}
                onMarkSuggestionUsed={liveAnalysis.markSuggestionUsed}
                onRateSuggestion={liveAnalysis.rateSuggestion}
              />
            </div>
          )}
        </div>
      </div>

      <LiveNudgesTray
        visible={false}
        metrics={liveAnalysis.metrics}
        coach={liveAnalysis.coach}
        summary={liveAnalysis.summary}
        insights={liveAnalysis.insights}
      />

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

export default function QuickNotePage() {
  return (
    <Suspense fallback={<div className="h-screen bg-bg-secondary" />}>
      <QuickNotePageContent />
    </Suspense>
  );
}
