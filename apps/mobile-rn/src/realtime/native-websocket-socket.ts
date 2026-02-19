import type { SocketFactory, SocketLike } from "./mobile-realtime-client";

interface NativeSocketCloseEvent {
  code?: number;
  reason?: string;
}

interface NativeSocketMessageEvent {
  data?: unknown;
}

interface NativeSocket {
  readonly readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: NativeSocketMessageEvent) => void) | null;
  onclose: ((event: NativeSocketCloseEvent) => void) | null;
  onerror: (() => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export interface NativeWebSocketFactoryOptions {
  protocols?: string | string[];
}

export function createNativeWebSocketFactory(
  options?: NativeWebSocketFactoryOptions,
): SocketFactory {
  return (url: string) => new NativeWebSocketAdapter(url, options?.protocols);
}

class NativeWebSocketAdapter implements SocketLike {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code?: number; reason?: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  private readonly socket: NativeSocket;

  constructor(url: string, protocols?: string | string[]) {
    if (typeof WebSocket === "undefined") {
      throw new Error("WebSocket is not available in this runtime.");
    }

    const nativeSocket = protocols
      ? new WebSocket(url, protocols)
      : new WebSocket(url);
    this.socket = nativeSocket as unknown as NativeSocket;

    this.socket.onopen = () => {
      this.onopen?.();
    };

    this.socket.onmessage = (event) => {
      if (typeof event.data === "string") {
        this.onmessage?.({ data: event.data });
        return;
      }
      if (event.data === null || event.data === undefined) return;
      this.onmessage?.({ data: String(event.data) });
    };

    this.socket.onclose = (event) => {
      this.onclose?.({
        code: event.code,
        reason: event.reason,
      });
    };

    this.socket.onerror = () => {
      this.onerror?.();
    };
  }

  get readyState(): number {
    return this.socket.readyState;
  }

  send(data: string): void {
    this.socket.send(data);
  }

  close(code?: number, reason?: string): void {
    this.socket.close(code, reason);
  }
}
