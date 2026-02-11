/**
 * Stub type declarations for @tauri-apps/api modules.
 * These are only available at runtime in Tauri desktop builds
 * and are dynamically imported with webpackIgnore comments.
 */
declare module "@tauri-apps/api/path" {
  export function appDataDir(): Promise<string>;
}

declare module "@tauri-apps/api/core" {
  export function invoke(
    cmd: string,
    args?: Record<string, unknown>,
  ): Promise<unknown>;
}

declare module "@tauri-apps/api/event" {
  export function listen<T>(
    event: string,
    handler: (event: { payload: T }) => void,
  ): Promise<() => void>;
}
