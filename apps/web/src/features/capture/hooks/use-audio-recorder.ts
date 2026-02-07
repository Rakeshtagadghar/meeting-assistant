import { useState, useCallback, useRef } from "react";

export type RecordingStatus = "IDLE" | "RECORDING" | "PAUSED" | "ERROR";

interface UseAudioRecorderReturn {
  status: RecordingStatus;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  mediaStream: MediaStream | null; // Exposed for visualization if needed
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [status, setStatus] = useState<RecordingStatus>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMediaStream(stream);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // In real impl, send this chunk to WS
          // console.log("Audio chunk", event.data.size);
        }
      };

      mediaRecorder.start(100); // 100ms chunks
      setStatus("RECORDING");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to start recording", err);
      setError("Microphone access denied or not available");
      setStatus("ERROR");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setMediaStream(null);
    setStatus("IDLE");
  }, []);

  return {
    status,
    error,
    startRecording,
    stopRecording,
    mediaStream,
  };
}
