/**
 * Stub type declaration for @transcribe/transcriber.
 * This optional dependency provides whisper.cpp WASM bindings.
 * It's dynamically imported with webpackIgnore and wrapped in try/catch.
 */
declare module "@transcribe/transcriber" {
  export class Transcriber {
    constructor(options: { model: ArrayBuffer; workerPath?: string });
    transcribe(audio: Float32Array): Promise<{ text: string }>;
    destroy(): void;
  }
}
