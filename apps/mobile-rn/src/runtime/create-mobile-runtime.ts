import {
  requireNativeRecorderBridge,
  type NativeRecorderBridge,
} from "../bridge/native-recorder-bridge";
import {
  createLoopbackMockSocketFactory,
  type LoopbackSocketOptions,
} from "../realtime/mock-loopback-socket";
import { createNativeWebSocketFactory } from "../realtime/native-websocket-socket";
import {
  createHttpRelaySocketFactory,
  type HttpRelaySocketFactoryOptions,
} from "../realtime/http-relay-socket";
import { MockNativePcmRecorder } from "../capture/mock-native-pcm-recorder";
import type { SocketFactory } from "../realtime/mobile-realtime-client";
import type { ReconnectPolicy } from "@ainotes/event-protocol";
import {
  MobileSessionRuntime,
  type MobileSessionRuntimeOptions,
} from "./mobile-session-runtime";

export interface CreateMobileRuntimeOptions {
  url: string;
  meetingId: string;
  language?: string;
  createSocket?: SocketFactory;
  httpRelay?: Pick<HttpRelaySocketFactoryOptions, "headers" | "credentials">;
  recorderBridge?: NativeRecorderBridge;
  reconnectPolicy?: ReconnectPolicy;
}

export function createMobileSessionRuntime(
  options: CreateMobileRuntimeOptions,
): MobileSessionRuntime {
  const bridge = options.recorderBridge ?? requireNativeRecorderBridge();
  const createSocket =
    options.createSocket ??
    resolveDefaultSocketFactory(options.url, options.httpRelay);
  return new MobileSessionRuntime({
    url: options.url,
    meetingId: options.meetingId,
    language: options.language,
    createSocket,
    recorder: bridge.createRecorder(),
    reconnectPolicy: options.reconnectPolicy,
  });
}

export function createMockMobileSessionRuntime(args: {
  url: string;
  meetingId: string;
  language?: string;
  loopback?: LoopbackSocketOptions;
  runtime?: Partial<Pick<MobileSessionRuntimeOptions, "reconnectPolicy">>;
}): MobileSessionRuntime {
  return new MobileSessionRuntime({
    url: args.url,
    meetingId: args.meetingId,
    language: args.language,
    createSocket: createLoopbackMockSocketFactory(args.loopback),
    recorder: new MockNativePcmRecorder(),
    reconnectPolicy: args.runtime?.reconnectPolicy,
  });
}

function resolveDefaultSocketFactory(
  url: string,
  httpRelay?: Pick<HttpRelaySocketFactoryOptions, "headers" | "credentials">,
): SocketFactory {
  if (/^wss?:\/\//i.test(url)) {
    return createNativeWebSocketFactory();
  }
  if (/^https?:\/\//i.test(url) || url.startsWith("/")) {
    return createHttpRelaySocketFactory(httpRelay);
  }
  return createLoopbackMockSocketFactory();
}
