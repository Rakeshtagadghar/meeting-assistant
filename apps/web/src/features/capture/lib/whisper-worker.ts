/**
 * Web Worker for Whisper inference via @huggingface/transformers.
 *
 * Runs the ASR pipeline off the main thread to prevent UI freezing
 * during the 2-4s WASM inference per audio window.
 *
 * Protocol:
 *   Main → Worker: { type: "load", modelId } | { type: "transcribe", audio, language } | { type: "dispose" }
 *   Worker → Main: { type: "progress", ... } | { type: "status", status } | { type: "result", text } | { type: "error", message }
 */

import type { AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

const MODEL_MAP: Record<string, string> = {
  tiny: "onnx-community/whisper-tiny",
  "tiny.en": "onnx-community/whisper-tiny.en",
  base: "onnx-community/whisper-base",
  small: "onnx-community/whisper-small",
};

let transcriber: AutomaticSpeechRecognitionPipeline | null = null;
let loading = false;

async function load(modelId: string) {
  if (transcriber || loading) return;
  loading = true;

  self.postMessage({
    type: "status",
    status: "loading",
    message: "Loading model...",
  });

  const modelName = MODEL_MAP[modelId] ?? MODEL_MAP["tiny"]!;

  // Detect WebGPU support
  const gpu = "gpu" in navigator ? (navigator as { gpu?: unknown }).gpu : null;
  const device = gpu ? "webgpu" : "wasm";

  const deviceConfig =
    device === "webgpu"
      ? {
          device: "webgpu" as const,
          dtype: {
            encoder_model: "fp32" as const,
            decoder_model_merged: "q4" as const,
          },
        }
      : {
          device: "wasm" as const,
          dtype: "q8" as const,
        };

  try {
    // Dynamic import to avoid TS2590 union explosion from pipeline() overloads
    const { pipeline: createPipeline } =
      await import("@huggingface/transformers");
    transcriber = (await (createPipeline as Function)(
      "automatic-speech-recognition",
      modelName,
      {
        ...deviceConfig,
        progress_callback: (progress: {
          status: string;
          progress?: number;
          file?: string;
          loaded?: number;
          total?: number;
        }) => {
          self.postMessage({ type: "progress", ...progress });
        },
      },
    )) as AutomaticSpeechRecognitionPipeline;

    // Warm up with a short dummy audio (compiles WASM / shaders)
    if (device === "webgpu") {
      self.postMessage({
        type: "status",
        status: "loading",
        message: "Compiling shaders...",
      });
      await transcriber(new Float32Array(16_000), { language: "en" });
    }

    loading = false;
    self.postMessage({
      type: "status",
      status: "ready",
      message: `Model ready (${device})`,
    });
  } catch (err) {
    loading = false;
    self.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : "Failed to load model",
    });
  }
}

async function transcribe(audio: Float32Array, language: string) {
  if (!transcriber) {
    self.postMessage({ type: "error", message: "Model not loaded" });
    return;
  }

  const lang = language === "auto" ? undefined : language;

  try {
    const result = await transcriber(audio, {
      language: lang,
      return_timestamps: false,
      chunk_length_s: 30,
    });

    const text = Array.isArray(result)
      ? result.map((r) => (r as { text: string }).text).join(" ")
      : (result as { text: string }).text;

    self.postMessage({ type: "result", text: text?.trim() ?? "" });
  } catch (err) {
    self.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : "Transcription failed",
    });
  }
}

self.addEventListener("message", (e: MessageEvent) => {
  const { type, ...data } = e.data as {
    type: string;
    modelId?: string;
    audio?: Float32Array;
    language?: string;
  };

  switch (type) {
    case "load":
      void load(data.modelId ?? "tiny");
      break;
    case "transcribe":
      if (data.audio) {
        void transcribe(data.audio, data.language ?? "auto");
      }
      break;
    case "dispose":
      transcriber = null;
      loading = false;
      break;
  }
});
