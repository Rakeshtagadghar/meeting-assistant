"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export type AudioCaptureStatus = "idle" | "capturing" | "paused" | "error";

interface UseAudioCaptureReturn {
  status: AudioCaptureStatus;
  error: string | null;
  micLevel: number;
  start: () => Promise<MediaStream>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
}

/**
 * Low-level audio capture hook using Web Audio API.
 * Provides microphone access with real-time level monitoring.
 * Used by the transcript session hook alongside the ASR provider.
 */
export function useAudioCapture(): UseAudioCaptureReturn {
  const [status, setStatus] = useState<AudioCaptureStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  // Mic level animation loop
  const updateMicLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const data = new Uint8Array(analyserRef.current.fftSize);
    analyserRef.current.getByteTimeDomainData(data);

    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const normalized = (data[i]! - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / data.length);
    setMicLevel(Math.min(1, rms * 3));

    rafRef.current = requestAnimationFrame(updateMicLevel);
  }, []);

  const start = useCallback(async (): Promise<MediaStream> => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: 16000 },
          channelCount: { exact: 1 },
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;

      // Set up analyser for level monitoring
      const ctx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      setStatus("capturing");

      // Start level monitoring
      rafRef.current = requestAnimationFrame(updateMicLevel);

      return stream;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Microphone access denied or not available";
      setError(message);
      setStatus("error");
      throw err;
    }
  }, [updateMicLevel]);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    analyserRef.current = null;
    setMicLevel(0);
    setStatus("idle");
  }, []);

  const pause = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setMicLevel(0);
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    setStatus("capturing");
    rafRef.current = requestAnimationFrame(updateMicLevel);
  }, [updateMicLevel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return { status, error, micLevel, start, stop, pause, resume };
}
