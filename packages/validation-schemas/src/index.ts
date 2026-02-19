import {
  EVENT_PROTOCOL_VERSION,
  type ClientToServerEvent,
  type ServerToClientEvent,
} from "@ainotes/event-protocol";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isProtocolVersion(
  value: unknown,
): value is typeof EVENT_PROTOCOL_VERSION {
  return value === EVENT_PROTOCOL_VERSION;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parseClientEventEnvelope(
  value: unknown,
): ClientToServerEvent | null {
  if (!isRecord(value)) return null;
  if (!isProtocolVersion(value["protocolVersion"])) return null;
  if (!isString(value["type"])) return null;
  if (!isRecord(value["payload"])) return null;
  return value as unknown as ClientToServerEvent;
}

export function parseServerEventEnvelope(
  value: unknown,
): ServerToClientEvent | null {
  if (!isRecord(value)) return null;
  if (!isProtocolVersion(value["protocolVersion"])) return null;
  if (!isString(value["type"])) return null;
  if (!isRecord(value["payload"])) return null;

  if (value["type"] === "session.ack") {
    const payload = value["payload"];
    if (!isString(payload["meetingId"])) return null;
    if (!isNumber(payload["lastAckedSeq"])) return null;
  }

  return value as unknown as ServerToClientEvent;
}
