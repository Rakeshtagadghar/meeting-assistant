import type { NativePcmRecorder } from "../capture/mobile-microphone-service";

export interface NativeRecorderBridge {
  readonly platform: "ios" | "android" | "mock";
  createRecorder: () => NativePcmRecorder;
}

const BRIDGE_KEY = "__AINOTES_NATIVE_PCM_RECORDER_BRIDGE__";

type GlobalWithRecorderBridge = typeof globalThis & {
  [BRIDGE_KEY]?: NativeRecorderBridge;
};

export function registerNativeRecorderBridge(
  bridge: NativeRecorderBridge,
): void {
  (globalThis as GlobalWithRecorderBridge)[BRIDGE_KEY] = bridge;
}

export function getNativeRecorderBridge(): NativeRecorderBridge | null {
  return (globalThis as GlobalWithRecorderBridge)[BRIDGE_KEY] ?? null;
}

export function requireNativeRecorderBridge(): NativeRecorderBridge {
  const bridge = getNativeRecorderBridge();
  if (bridge) return bridge;
  throw new Error(
    "Native recorder bridge is not registered. Register one with registerNativeRecorderBridge().",
  );
}
