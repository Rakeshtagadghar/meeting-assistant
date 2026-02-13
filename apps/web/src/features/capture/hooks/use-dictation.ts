"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ASRProvider, ASREvent } from "@ainotes/core";
import { createASRProvider } from "../lib/asr-provider-factory";

interface UseDictationResult {
  /** Accumulated final transcript text */
  transcript: string;
  /** Current partial (interim) text */
  partialText: string;
  /** Whether ASR is actively listening */
  isListening: boolean;
  /** Whether the provider is currently processing audio (ASR active) */
  isProcessing: boolean;
  /** Whether the provider has been initialized and is ready */
  isReady: boolean;
  /** Whether the provider is currently initializing */
  isInitializing: boolean;
  /** Name of the active ASR provider */
  providerName: string | null;
  /** Model download progress (0-100), null when not loading */
  modelLoadProgress: number | null;
  /** Start dictation (initializes provider on first call) */
  start: () => Promise<void>;
  /** Stop dictation */
  stop: () => void;
  /** Clear transcript and partial text */
  clear: () => void;
  /** Error message if any */
  error: string | null;
}

const providerModelId: Record<string, string> = {
  "whisper-cpp": "small",
  "whisper-wasm": "base",
  "web-speech-api": "default",
};

export function useDictation(): UseDictationResult {
  const [transcript, setTranscript] = useState("");
  const [partialText, setPartialText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [providerName, setProviderName] = useState<string | null>(null);
  const [modelLoadProgress, setModelLoadProgress] = useState<number | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const providerRef = useRef<ASRProvider | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const transcriptRef = useRef("");

  // Create provider on mount
  useEffect(() => {
    let disposed = false;
    void createASRProvider().then((provider) => {
      if (disposed) {
        provider.dispose();
        return;
      }
      providerRef.current = provider;
      setProviderName(provider.name);
    });
    return () => {
      disposed = true;
      if (unsubRef.current) unsubRef.current();
      providerRef.current?.dispose();
    };
  }, []);

  const handleASREvent = useCallback((event: ASREvent) => {
    switch (event.type) {
      case "ASR_STATUS":
        if (event.state === "processing") {
          setIsProcessing(true);
        } else {
          setIsProcessing(false);
        }

        if (event.state === "listening") {
          setIsListening(true);
        } else if (
          event.state === "stopped" ||
          event.state === "paused" ||
          event.state === "error"
        ) {
          setIsListening(false);
        }
        if (event.state === "error") {
          setError(event.message);
        }
        break;

      case "ASR_PARTIAL":
        setPartialText(event.text);
        break;

      case "ASR_FINAL":
        transcriptRef.current +=
          (transcriptRef.current ? " " : "") + event.text.trim();
        setTranscript(transcriptRef.current);
        setPartialText("");
        break;
    }
  }, []);

  const start = useCallback(async () => {
    const provider = providerRef.current;
    if (!provider) {
      setError("ASR provider not available yet");
      return;
    }

    setError(null);

    // Initialize on first start
    if (!provider.isReady()) {
      setIsInitializing(true);
      const modelId = providerModelId[provider.name] ?? "base";
      try {
        setModelLoadProgress(0);
        await provider.initialize(modelId, (pct) => setModelLoadProgress(pct));
        setModelLoadProgress(null);
        setIsReady(true);
      } catch (e) {
        setModelLoadProgress(null);
        setError(
          `Failed to initialize ${provider.name}: ${e instanceof Error ? e.message : String(e)}`,
        );
        setIsInitializing(false);
        return;
      }
      setIsInitializing(false);
    }

    // Subscribe to events
    if (unsubRef.current) unsubRef.current();
    unsubRef.current = provider.onEvent(handleASREvent);

    // Start listening
    setIsListening(true);
    await provider.startListening({ language: "auto", sampleRate: 16000 });
  }, [handleASREvent]);

  const stop = useCallback(() => {
    providerRef.current?.stopListening();
    setIsListening(false);

    // Finalize any partial text
    if (partialText) {
      transcriptRef.current += (transcriptRef.current ? " " : "") + partialText;
      setTranscript(transcriptRef.current);
    }
    setPartialText("");
  }, [partialText]);

  const clear = useCallback(() => {
    transcriptRef.current = "";
    setTranscript("");
    setPartialText("");
  }, []);

  return {
    transcript,
    partialText,
    isListening,
    isProcessing,
    isReady,
    isInitializing,
    providerName,
    modelLoadProgress,
    start,
    stop,
    clear,
    error,
  };
}
