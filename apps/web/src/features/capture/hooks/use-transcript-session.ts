"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ASREvent, ASRProvider, UUID } from "@ainotes/core";
import type { ConsentFormData } from "@ainotes/ui";
import type { TranscriptWindowState } from "../components/TranscriptFooter";

const BATCH_SIZE = 10;

export interface TranscriptSessionChunk {
  id: string;
  sequence: number;
  tStartMs: number;
  tEndMs: number;
  speaker: string | null;
  text: string;
  confidence: number | null;
  isFinal: boolean;
}

interface UseTranscriptSessionReturn {
  // State
  windowState: TranscriptWindowState;
  finalChunks: TranscriptSessionChunk[];
  partialText: string | null;

  // Consent modal
  showConsentModal: boolean;

  // Audio
  micLevel: number;

  // Settings
  language: string;
  setLanguage: (lang: string) => void;

  // Actions
  requestStart: () => void;
  confirmConsent: (data: ConsentFormData) => void;
  cancelConsent: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
  copyTranscript: () => Promise<boolean>;

  // Provider info
  providerName: string | null;

  // Model loading
  modelLoadProgress: number | null;

  // Meeting info
  meetingTitle: string;
  participants: string[];
  sessionId: string | null;
  noteId: string | null;
}

interface UseTranscriptSessionOptions {
  noteId?: UUID;
}

async function apiCreateNote(title: string): Promise<string> {
  const res = await fetch("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: title || "Meeting Transcript",
      contentRich: {},
      contentPlain: "",
      type: "MEETING",
      tags: ["meeting"],
    }),
  });
  if (!res.ok) throw new Error("Failed to create note");
  const data = (await res.json()) as { noteId: string };
  return data.noteId;
}

async function apiUpdateNoteContent(noteId: string, contentPlain: string) {
  const res = await fetch(`/api/notes/${noteId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentPlain }),
  });
  if (!res.ok) throw new Error("Failed to update note");
}

async function apiCreateSession(
  noteId: UUID,
  title?: string,
  participants?: string[],
) {
  const res = await fetch("/api/meetings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ noteId, title, participants }),
  });
  if (!res.ok) throw new Error("Failed to create meeting session");
  return res.json() as Promise<{ session: { id: string } }>;
}

async function apiConfirmConsent(
  sessionId: string,
  consentText: string | null,
  title?: string,
  participants?: string[],
) {
  const res = await fetch(`/api/meetings/${sessionId}/consent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consentText, title, participants }),
  });
  if (!res.ok) throw new Error("Failed to confirm consent");
}

async function apiSaveChunks(
  sessionId: string,
  chunks: Array<{
    sequence: number;
    tStartMs: number;
    tEndMs: number;
    speaker: string | null;
    text: string;
    confidence: number | null;
  }>,
) {
  if (chunks.length === 0) return;
  const res = await fetch(`/api/meetings/${sessionId}/chunks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chunks }),
  });
  if (!res.ok) throw new Error("Failed to save chunks");
}

async function apiStopSession(sessionId: string) {
  const res = await fetch(`/api/meetings/${sessionId}/stop`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to stop session");
}

export function useTranscriptSession(
  asrProvider?: ASRProvider | null,
  options?: UseTranscriptSessionOptions,
): UseTranscriptSessionReturn {
  const [windowState, setWindowState] = useState<TranscriptWindowState>("idle");
  const [finalChunks, setFinalChunks] = useState<TranscriptSessionChunk[]>([]);
  const [partialText, setPartialText] = useState<string | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [language, setLanguage] = useState("auto");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [noteId, setNoteId] = useState<string | null>(options?.noteId ?? null);
  const [modelLoadProgress, setModelLoadProgress] = useState<number | null>(
    null,
  );

  const providerRef = useRef<ASRProvider | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const sequenceRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const noteIdRef = useRef<string | null>(options?.noteId ?? null);
  const pendingChunksRef = useRef<TranscriptSessionChunk[]>([]);
  const micLevelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  // Set provider ref when it changes
  useEffect(() => {
    providerRef.current = asrProvider ?? null;
  }, [asrProvider]);

  // Flush pending chunks to API
  const flushChunks = useCallback(async () => {
    const sid = sessionIdRef.current;
    const pending = pendingChunksRef.current;
    if (!sid || pending.length === 0) return;

    pendingChunksRef.current = [];
    try {
      await apiSaveChunks(
        sid,
        pending.map((c) => ({
          sequence: c.sequence,
          tStartMs: c.tStartMs,
          tEndMs: c.tEndMs,
          speaker: c.speaker,
          text: c.text,
          confidence: c.confidence,
        })),
      );
    } catch {
      // Re-add on failure for retry
      pendingChunksRef.current = [...pending, ...pendingChunksRef.current];
    }
  }, []);

  const handleASREvent = useCallback(
    (event: ASREvent) => {
      switch (event.type) {
        case "ASR_STATUS":
          if (event.state === "listening") {
            setWindowState("listening");
          } else if (event.state === "paused") {
            setWindowState("paused");
          } else if (event.state === "stopped") {
            setWindowState("processing");
            setTimeout(() => setWindowState("completed"), 500);
          }
          break;

        case "ASR_PARTIAL":
          setPartialText(event.text);
          break;

        case "ASR_FINAL": {
          setPartialText(null);
          const chunk: TranscriptSessionChunk = {
            id: crypto.randomUUID(),
            sequence: event.sequence,
            tStartMs: event.tStartMs,
            tEndMs: event.tEndMs,
            speaker: event.speaker,
            text: event.text,
            confidence: event.confidence,
            isFinal: true,
          };
          setFinalChunks((prev) => [...prev, chunk]);

          // Add to pending batch
          pendingChunksRef.current.push(chunk);
          if (pendingChunksRef.current.length >= BATCH_SIZE) {
            void flushChunks();
          }
          break;
        }
      }
    },
    [flushChunks],
  );

  const requestStart = useCallback(() => {
    setShowConsentModal(true);
  }, []);

  const confirmConsent = useCallback(
    async (data: ConsentFormData) => {
      setShowConsentModal(false);
      setMeetingTitle(data.meetingTitle);
      setParticipants(data.participants);
      setFinalChunks([]);
      setPartialText(null);
      sequenceRef.current = 0;
      pendingChunksRef.current = [];

      const provider = providerRef.current;
      if (!provider) {
        setWindowState("idle");
        return;
      }

      setWindowState("processing");

      try {
        // Ensure we have a noteId — create a MEETING note if none provided
        let currentNoteId = noteIdRef.current;
        if (!currentNoteId) {
          currentNoteId = await apiCreateNote(
            data.meetingTitle || "Meeting Transcript",
          );
          noteIdRef.current = currentNoteId;
          setNoteId(currentNoteId);
        }

        // Create meeting session linked to the note
        const { session } = await apiCreateSession(
          currentNoteId as UUID,
          data.meetingTitle || undefined,
          data.participants.length > 0 ? data.participants : undefined,
        );
        sessionIdRef.current = session.id;
        setSessionId(session.id);

        // Confirm consent on the server
        await apiConfirmConsent(
          session.id,
          data.consentText || null,
          data.meetingTitle || undefined,
          data.participants.length > 0 ? data.participants : undefined,
        );

        if (!provider.isReady()) {
          setModelLoadProgress(0);
          // Desktop whisper.cpp uses "small" for better accuracy;
          // Web WASM uses "base" to keep download size reasonable
          const modelId = provider.name === "whisper-cpp" ? "small" : "base";
          await provider.initialize(modelId, (pct) => {
            setModelLoadProgress(pct);
          });
          setModelLoadProgress(null);
        }

        // Subscribe to events
        unsubscribeRef.current = provider.onEvent(handleASREvent);

        // Start listening
        provider.startListening({
          language,
          sampleRate: 16000,
        });

        setWindowState("listening");
      } catch {
        setWindowState("idle");
      }
    },
    [language, handleASREvent],
  );

  const cancelConsent = useCallback(() => {
    setShowConsentModal(false);
  }, []);

  const pause = useCallback(() => {
    providerRef.current?.pauseListening();
    setWindowState("paused");
  }, []);

  const resume = useCallback(() => {
    providerRef.current?.resumeListening();
    setWindowState("listening");
  }, []);

  const reset = useCallback(() => {
    setWindowState("idle");
    setFinalChunks([]);
    setPartialText(null);
    setMeetingTitle("");
    setParticipants([]);
    setSessionId(null);
    setNoteId(null);
    setMicLevel(0);
    sequenceRef.current = 0;
    sessionIdRef.current = null;
    noteIdRef.current = null;
    pendingChunksRef.current = [];
  }, []);

  const copyTranscript = useCallback(async (): Promise<boolean> => {
    const text = finalChunks
      .map((c) => {
        const speaker = c.speaker ? `${c.speaker}: ` : "";
        return `${speaker}${c.text}`;
      })
      .join("\n");
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, [finalChunks]);

  const stop = useCallback(() => {
    providerRef.current?.stopListening();
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;

    // Capture the current partial text at the moment of stopping
    const finalPartialText = partialText;
    setPartialText(null);
    setWindowState("processing");

    // Flush remaining chunks, save transcript to note, then stop session
    void (async () => {
      // If we have partial text, treat it as a final chunk
      if (finalPartialText?.trim()) {
        const chunk: TranscriptSessionChunk = {
          id: crypto.randomUUID(),
          sequence: sequenceRef.current++,
          tStartMs: Date.now(), // Approximate
          tEndMs: Date.now(),
          speaker: null, // Unknown speaker for partial
          text: finalPartialText.trim(),
          confidence: 1, // Assume high confidence since user accepted it by stopping
          isFinal: true,
        };

        // Add to pending chunks for API flush
        pendingChunksRef.current.push(chunk);

        // Update local state so it appears in UI immediately
        setFinalChunks((prev) => [...prev, chunk]);
      }

      await flushChunks();

      if (sessionIdRef.current) {
        try {
          await apiStopSession(sessionIdRef.current);
        } catch {
          // Non-critical
        }
      }

      // Save full transcript text into the note's contentPlain
      if (noteIdRef.current) {
        try {
          // Access the latest finalChunks via a state snapshot
          setFinalChunks((currentChunks) => {
            const transcriptText = currentChunks
              .map((c) => {
                const speaker = c.speaker ? `${c.speaker}: ` : "";
                return `${speaker}${c.text}`;
              })
              .join("\n");

            // Also append the partial text if it wasn't already in currentChunks
            // (Note: we added it to state above, but react batching might delay it,
            // so we should check or just rely on the new chunk we created)

            if (transcriptText) {
              void apiUpdateNoteContent(noteIdRef.current!, transcriptText);
            }
            return currentChunks; // Don't modify state
          });
        } catch {
          // Non-critical
        }
      }

      setWindowState("completed");
    })();
  }, [flushChunks, partialText]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
      if (micLevelIntervalRef.current) {
        clearInterval(micLevelIntervalRef.current);
      }
      providerRef.current?.dispose();
    };
  }, []);

  return {
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
    providerName: asrProvider?.name ?? null,
    modelLoadProgress,
    meetingTitle,
    participants,
    sessionId,
    noteId,
  };
}
