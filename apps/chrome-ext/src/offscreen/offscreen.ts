/// <reference types="chrome" />
/* eslint-disable no-console */

interface StartRecordingPayload {
  sessionId: string;
  apiBaseUrl: string;
  authToken: string;
}

let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let currentPayload: StartRecordingPayload | null = null;

const CHUNK_INTERVAL_MS = 5000;

chrome.runtime.onMessage.addListener(
  (
    message: { type: string; payload?: StartRecordingPayload },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => {
    if (message.type === "START_RECORDING" && message.payload) {
      startCapture(message.payload)
        .then(() => sendResponse({ ok: true }))
        .catch((err: Error) => {
          console.error("[Golden Minutes] Capture error:", err);
          chrome.runtime.sendMessage({
            type: "RECORDING_ERROR",
            payload: { error: err.message },
          });
          sendResponse({ ok: false, error: err.message });
        });
      return true;
    }

    if (message.type === "STOP_RECORDING") {
      stopCapture();
      sendResponse({ ok: true });
    }
  },
);

async function startCapture(payload: StartRecordingPayload): Promise<void> {
  currentPayload = payload;

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 16000,
    },
    video: false,
  });

  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : "audio/webm";

  mediaRecorder = new MediaRecorder(mediaStream, { mimeType });

  mediaRecorder.ondataavailable = async (event) => {
    if (event.data.size > 0 && currentPayload) {
      await sendChunkToApi(event.data, currentPayload);
    }
  };

  mediaRecorder.onerror = (event) => {
    console.error("[Golden Minutes] MediaRecorder error:", event);
    chrome.runtime.sendMessage({
      type: "RECORDING_ERROR",
      payload: { error: "MediaRecorder error" },
    });
  };

  mediaRecorder.start(CHUNK_INTERVAL_MS);
  console.log("[Golden Minutes] Recording started");
}

function stopCapture(): void {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }

  if (mediaStream) {
    for (const track of mediaStream.getTracks()) {
      track.stop();
    }
    mediaStream = null;
  }

  mediaRecorder = null;
  currentPayload = null;
  console.log("[Golden Minutes] Recording stopped");
}

async function sendChunkToApi(
  blob: Blob,
  payload: StartRecordingPayload,
): Promise<void> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);

    const response = await fetch(
      `${payload.apiBaseUrl}/api/asr/elevenlabs/transcribe`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${payload.authToken}`,
        },
        body: JSON.stringify({
          audioBase64: base64,
          mimeType: blob.type || "audio/webm",
        }),
      },
    );

    if (!response.ok) {
      console.error(
        "[Golden Minutes] Transcription API error:",
        response.status,
      );
      return;
    }

    const data = (await response.json()) as { text?: string };
    const text = (data.text ?? "").trim();

    if (text) {
      chrome.runtime.sendMessage({
        type: "TRANSCRIPT_CHUNK",
        payload: {
          text,
          ts: Date.now(),
          sessionId: payload.sessionId,
        },
      });
    }
  } catch (err) {
    console.error("[Golden Minutes] Failed to send chunk:", err);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCodePoint(bytes[i]!);
  }
  return btoa(binary);
}
