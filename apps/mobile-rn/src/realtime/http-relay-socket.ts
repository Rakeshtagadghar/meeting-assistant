import type { SocketFactory, SocketLike } from "./mobile-realtime-client";

const SOCKET_CONNECTING = 0;
const SOCKET_OPEN = 1;
const SOCKET_CLOSED = 3;

export interface HttpRelaySocketFactoryOptions {
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  openDelayMs?: number;
}

export function createHttpRelaySocketFactory(
  options?: HttpRelaySocketFactoryOptions,
): SocketFactory {
  return (url: string) => new HttpRelaySocket(url, options);
}

class HttpRelaySocket implements SocketLike {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code?: number; reason?: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  private readonly url: string;
  private readonly headers: Record<string, string>;
  private readonly credentials: RequestCredentials;
  private mutableReadyState = SOCKET_CONNECTING;
  private closed = false;
  private sendQueue: Promise<void> = Promise.resolve();

  constructor(url: string, options?: HttpRelaySocketFactoryOptions) {
    this.url = url;
    this.headers = options?.headers ?? {};
    this.credentials = options?.credentials ?? "include";
    const openDelayMs = options?.openDelayMs ?? 0;

    setTimeout(() => {
      if (this.closed) return;
      this.mutableReadyState = SOCKET_OPEN;
      this.onopen?.();
    }, openDelayMs);
  }

  get readyState(): number {
    return this.mutableReadyState;
  }

  send(data: string): void {
    if (this.mutableReadyState !== SOCKET_OPEN || this.closed) return;
    this.sendQueue = this.sendQueue.then(() => this.postEvent(data));
  }

  close(code?: number, reason?: string): void {
    if (this.closed) return;
    this.closed = true;
    this.mutableReadyState = SOCKET_CLOSED;
    this.onclose?.({ code, reason });
  }

  private async postEvent(data: string): Promise<void> {
    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.headers,
        },
        credentials: this.credentials,
        body: data,
      });

      if (!response.ok) {
        this.onerror?.();
        this.close(1011, `relay-http-${String(response.status)}`);
        return;
      }

      const payload = (await response.json()) as {
        events?: unknown;
      };
      if (!Array.isArray(payload.events)) return;

      for (const event of payload.events) {
        this.onmessage?.({
          data: JSON.stringify(event),
        });
      }
    } catch {
      this.onerror?.();
      this.close(1011, "relay-request-failed");
    }
  }
}
