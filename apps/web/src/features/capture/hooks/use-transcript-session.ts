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
  speakerRole: "SALES" | "CLIENT" | "UNKNOWN";
  audioSource: "microphone" | "systemAudio" | "tabAudio";
  prosodyEnergy: number | null;
  prosodyPauseRatio: number | null;
  prosodyVoicedMs: number | null;
  prosodySnrDb: number | null;
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
  captureSystemAudio: boolean;
  setCaptureSystemAudio: (value: boolean) => void;
  speakerRoleOverrides: Record<string, "SALES" | "CLIENT">;
  setSpeakerRoleOverride: (
    speakerId: string,
    role: "SALES" | "CLIENT" | "AUTO",
  ) => void;

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

interface DiarizationState {
  knownSpeakers: string[];
  lastSpeaker: string | null;
  primarySpeaker: string | null;
  lastText: string;
  lastEndMs: number;
}

const FINAL_DEDUPE_MAX_KEYS = 500;

function normalizeTranscriptText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function finalChunkDedupeKey(
  text: string,
  tStartMs: number,
  tEndMs: number,
): string {
  const normalized = normalizeTranscriptText(text).toLowerCase();
  return `${String(Math.round(tStartMs / 500))}:${String(Math.round(tEndMs / 500))}:${normalized}`;
}

function applyHeuristicDiarization(
  state: DiarizationState,
  args: {
    suggestedSpeaker: string | null;
    text: string;
    tStartMs: number;
    tEndMs: number;
  },
): string {
  const suggested = args.suggestedSpeaker?.trim() ?? "";
  if (suggested) {
    if (!state.knownSpeakers.includes(suggested)) {
      state.knownSpeakers.push(suggested);
    }
    state.lastSpeaker = suggested;
    state.lastText = args.text;
    state.lastEndMs = args.tEndMs;
    return suggested;
  }

  const hasQuestionBefore = state.lastText.includes("?");
  const gapMs = Math.max(0, args.tStartMs - state.lastEndMs);
  const looksLikeResponse =
    /^(yes|no|yeah|nope|sure|right|i think|we|our)\b/i.test(args.text);

  let resolved: string;
  if (state.knownSpeakers.length === 0) {
    resolved = "Speaker 1";
  } else if (state.knownSpeakers.length === 1) {
    resolved =
      hasQuestionBefore || looksLikeResponse || gapMs >= 1800
        ? "Speaker 2"
        : state.knownSpeakers[0]!;
  } else {
    const current = state.lastSpeaker ?? state.knownSpeakers[0]!;
    const alternate = state.knownSpeakers.find((item) => item !== current);
    const shouldSwitch =
      hasQuestionBefore || looksLikeResponse || gapMs >= 2200;
    resolved = shouldSwitch && alternate ? alternate : current;
  }

  if (!state.knownSpeakers.includes(resolved)) {
    state.knownSpeakers.push(resolved);
  }
  state.lastSpeaker = resolved;
  state.lastText = args.text;
  state.lastEndMs = args.tEndMs;
  return resolved;
}

function resolveRoleAndSource(
  state: DiarizationState,
  speaker: string,
  captureSystemAudio: boolean,
  hintedRole?: "SALES" | "CLIENT" | "UNKNOWN",
  hintedSource?: "microphone" | "systemAudio" | "tabAudio",
  speakerRoleOverride?: "SALES" | "CLIENT",
): {
  speakerRole: "SALES" | "CLIENT";
  audioSource: "microphone" | "systemAudio";
} {
  if (speakerRoleOverride === "SALES") {
    return { speakerRole: "SALES", audioSource: "microphone" };
  }
  if (speakerRoleOverride === "CLIENT") {
    return {
      speakerRole: "CLIENT",
      audioSource: captureSystemAudio ? "systemAudio" : "microphone",
    };
  }

  if (hintedSource === "microphone") {
    return { speakerRole: "SALES", audioSource: "microphone" };
  }
  if (hintedSource === "systemAudio" || hintedSource === "tabAudio") {
    return {
      speakerRole: "CLIENT",
      audioSource: captureSystemAudio ? "systemAudio" : "microphone",
    };
  }
  if (hintedRole === "SALES") {
    return { speakerRole: "SALES", audioSource: "microphone" };
  }
  if (hintedRole === "CLIENT") {
    return {
      speakerRole: "CLIENT",
      audioSource: captureSystemAudio ? "systemAudio" : "microphone",
    };
  }

  if (!state.primarySpeaker) {
    state.primarySpeaker = speaker;
  }

  if (speaker === state.primarySpeaker) {
    return {
      speakerRole: "SALES",
      audioSource: "microphone",
    };
  }

  return {
    speakerRole: "CLIENT",
    audioSource: captureSystemAudio ? "systemAudio" : "microphone",
  };
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
  const [captureSystemAudio, setCaptureSystemAudio] = useState(true);
  const [speakerRoleOverrides, setSpeakerRoleOverrides] = useState<
    Record<string, "SALES" | "CLIENT">
  >({});
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
  const finalDedupeKeysRef = useRef<Set<string>>(new Set());
  const diarizationStateRef = useRef<DiarizationState>({
    knownSpeakers: [],
    lastSpeaker: null,
    primarySpeaker: null,
    lastText: "",
    lastEndMs: 0,
  });
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
          const normalizedText = normalizeTranscriptText(event.text);
          if (!normalizedText) break;

          const dedupeKey = finalChunkDedupeKey(
            normalizedText,
            event.tStartMs,
            event.tEndMs,
          );
          if (finalDedupeKeysRef.current.has(dedupeKey)) break;
          finalDedupeKeysRef.current.add(dedupeKey);
          if (finalDedupeKeysRef.current.size > FINAL_DEDUPE_MAX_KEYS) {
            const oldest = finalDedupeKeysRef.current.values().next().value;
            if (typeof oldest === "string") {
              finalDedupeKeysRef.current.delete(oldest);
            }
          }

          setPartialText(null);
          const speaker = applyHeuristicDiarization(
            diarizationStateRef.current,
            {
              suggestedSpeaker: event.speaker,
              text: normalizedText,
              tStartMs: event.tStartMs,
              tEndMs: event.tEndMs,
            },
          );
          const { speakerRole, audioSource } = resolveRoleAndSource(
            diarizationStateRef.current,
            speaker,
            captureSystemAudio,
            event.speakerRole,
            event.audioSource,
            speakerRoleOverrides[speaker],
          );
          const chunk: TranscriptSessionChunk = {
            id: crypto.randomUUID(),
            sequence: event.sequence,
            tStartMs: event.tStartMs,
            tEndMs: event.tEndMs,
            speaker,
            speakerRole,
            audioSource,
            prosodyEnergy: event.prosodyEnergy ?? null,
            prosodyPauseRatio: event.prosodyPauseRatio ?? null,
            prosodyVoicedMs: event.prosodyVoicedMs ?? null,
            prosodySnrDb: event.prosodySnrDb ?? null,
            text: normalizedText,
            confidence: event.confidence,
            isFinal: true,
          };
          sequenceRef.current = Math.max(
            sequenceRef.current,
            event.sequence + 1,
          );
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
    [captureSystemAudio, flushChunks, speakerRoleOverrides],
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
      finalDedupeKeysRef.current = new Set();
      setSpeakerRoleOverrides({});
      diarizationStateRef.current = {
        knownSpeakers: [],
        lastSpeaker: null,
        primarySpeaker: null,
        lastText: "",
        lastEndMs: 0,
      };

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
          enableSystemAudio: captureSystemAudio,
        });

        setWindowState("listening");
      } catch {
        setWindowState("idle");
      }
    },
    [captureSystemAudio, language, handleASREvent],
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
    finalDedupeKeysRef.current = new Set();
    setSpeakerRoleOverrides({});
    diarizationStateRef.current = {
      knownSpeakers: [],
      lastSpeaker: null,
      primarySpeaker: null,
      lastText: "",
      lastEndMs: 0,
    };
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
        const normalizedPartial = normalizeTranscriptText(finalPartialText);
        if (normalizedPartial) {
          const now = Date.now();
          const dedupeKey = finalChunkDedupeKey(normalizedPartial, now, now);
          if (!finalDedupeKeysRef.current.has(dedupeKey)) {
            finalDedupeKeysRef.current.add(dedupeKey);
            const speaker = applyHeuristicDiarization(
              diarizationStateRef.current,
              {
                suggestedSpeaker: null,
                text: normalizedPartial,
                tStartMs: now,
                tEndMs: now,
              },
            );
            const { speakerRole, audioSource } = resolveRoleAndSource(
              diarizationStateRef.current,
              speaker,
              captureSystemAudio,
              undefined,
              undefined,
              speakerRoleOverrides[speaker],
            );
            const chunk: TranscriptSessionChunk = {
              id: crypto.randomUUID(),
              sequence: sequenceRef.current++,
              tStartMs: now, // Approximate
              tEndMs: now,
              speaker,
              speakerRole,
              audioSource,
              prosodyEnergy: null,
              prosodyPauseRatio: null,
              prosodyVoicedMs: null,
              prosodySnrDb: null,
              text: normalizedPartial,
              confidence: 1, // Assume high confidence since user accepted it by stopping
              isFinal: true,
            };

            // Add to pending chunks for API flush
            pendingChunksRef.current.push(chunk);

            // Update local state so it appears in UI immediately
            setFinalChunks((prev) => [...prev, chunk]);
          }
        }
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
  }, [captureSystemAudio, flushChunks, partialText, speakerRoleOverrides]);

  const setSpeakerRoleOverride = useCallback(
    (speakerId: string, role: "SALES" | "CLIENT" | "AUTO") => {
      setSpeakerRoleOverrides((current) => {
        if (role === "AUTO") {
          if (!(speakerId in current)) return current;
          const next = { ...current };
          delete next[speakerId];
          return next;
        }
        if (current[speakerId] === role) return current;
        return { ...current, [speakerId]: role };
      });
    },
    [],
  );

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
    providerName: asrProvider?.name ?? null,
    modelLoadProgress,
    meetingTitle,
    participants,
    sessionId,
    noteId,
  };
}
