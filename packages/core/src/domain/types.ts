// ─── Branded types (compile-time safety, zero runtime cost) ───

type Brand<K, T> = K & { readonly __brand: T };

export type UUID = Brand<string, "UUID">;
export type ISODateString = Brand<string, "ISODateString">;

// ─── Generic JSON type (for TipTap contentRich and flexible payloads) ───

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

// ─── Enums (as const objects — cleaner than TS enum) ───

export const NoteType = {
  FREEFORM: "FREEFORM",
  MEETING: "MEETING",
} as const;
export type NoteType = (typeof NoteType)[keyof typeof NoteType];

export const MeetingSessionSource = {
  MANUAL: "MANUAL",
  CALENDAR: "CALENDAR",
} as const;
export type MeetingSessionSource =
  (typeof MeetingSessionSource)[keyof typeof MeetingSessionSource];

export const MeetingSessionStatus = {
  IDLE: "IDLE",
  RECORDING: "RECORDING",
  PAUSED: "PAUSED",
  STOPPED: "STOPPED",
} as const;
export type MeetingSessionStatus =
  (typeof MeetingSessionStatus)[keyof typeof MeetingSessionStatus];

export const AISummaryKind = {
  SUMMARY: "SUMMARY",
  ACTION_ITEMS: "ACTION_ITEMS",
  DECISIONS: "DECISIONS",
  RISKS: "RISKS",
  KEY_POINTS: "KEY_POINTS",
} as const;
export type AISummaryKind = (typeof AISummaryKind)[keyof typeof AISummaryKind];

export const ShareVisibility = {
  PRIVATE: "PRIVATE",
  RESTRICTED: "RESTRICTED",
} as const;
export type ShareVisibility =
  (typeof ShareVisibility)[keyof typeof ShareVisibility];

// ─── Entity: User ───

export interface User {
  readonly id: UUID;
  readonly email: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

// ─── Entity: Note ───

export interface Note {
  readonly id: UUID;
  readonly userId: UUID;
  readonly title: string;
  readonly contentRich: JsonValue;
  readonly contentPlain: string;
  readonly type: NoteType;
  readonly tags: readonly string[];
  readonly pinned: boolean;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
  readonly deletedAt: ISODateString | null;
}

// ─── Entity: MeetingSession ───

export interface MeetingSession {
  readonly id: UUID;
  readonly userId: UUID;
  readonly noteId: UUID;
  readonly source: MeetingSessionSource;
  readonly startedAt: ISODateString;
  readonly endedAt: ISODateString | null;
  readonly consentConfirmed: boolean;
  readonly consentText: string | null;
  readonly audioStored: boolean;
  readonly status: MeetingSessionStatus;
}

// ─── Entity: TranscriptChunk ───

export interface TranscriptChunk {
  readonly id: UUID;
  readonly meetingSessionId: UUID;
  readonly tStartMs: number;
  readonly tEndMs: number;
  readonly speaker: string | null;
  readonly text: string;
  readonly createdAt: ISODateString;
}

// ─── AI Summary payload types (discriminated union) ───

export interface SummaryPayload {
  readonly title: string;
  readonly bullets: readonly string[];
  readonly oneLiner: string;
}

export interface ActionItem {
  readonly text: string;
  readonly owner: string | null;
  readonly due: string | null;
  readonly confidence: number;
}

export interface ActionItemsPayload {
  readonly items: readonly ActionItem[];
}

export interface DecisionsPayload {
  readonly decisions: readonly string[];
}

export interface RisksPayload {
  readonly risks: readonly string[];
}

export interface KeyPointsPayload {
  readonly keyPoints: readonly string[];
  readonly oneLiner: string;
}

export type AISummaryByKind =
  | { readonly kind: "SUMMARY"; readonly payload: SummaryPayload }
  | { readonly kind: "ACTION_ITEMS"; readonly payload: ActionItemsPayload }
  | { readonly kind: "DECISIONS"; readonly payload: DecisionsPayload }
  | { readonly kind: "RISKS"; readonly payload: RisksPayload }
  | { readonly kind: "KEY_POINTS"; readonly payload: KeyPointsPayload };

// ─── Entity: AISummary ───

export type AISummary = {
  readonly id: UUID;
  readonly noteId: UUID;
  readonly meetingSessionId: UUID | null;
  readonly modelInfo: JsonValue;
  readonly createdAt: ISODateString;
} & AISummaryByKind;

// ─── Entity: ShareLink ───

export interface ShareLink {
  readonly id: UUID;
  readonly noteId: UUID;
  readonly createdByUserId: UUID;
  readonly visibility: ShareVisibility;
  readonly allowedEmails: readonly string[];
  readonly token: string;
  readonly expiresAt: ISODateString | null;
  readonly createdAt: ISODateString;
}

// ─── Input DTOs ───

export interface CreateNoteInput {
  readonly title: string;
  readonly contentRich: JsonValue;
  readonly contentPlain: string;
  readonly type: NoteType;
  readonly tags: readonly string[];
}

export interface UpdateNoteInput {
  readonly title?: string;
  readonly contentRich?: JsonValue;
  readonly contentPlain?: string;
  readonly tags?: readonly string[];
  readonly pinned?: boolean;
}

export interface CreateShareLinkInput {
  readonly noteId: UUID;
  readonly createdByUserId: UUID;
  readonly visibility: ShareVisibility;
  readonly allowedEmails: readonly string[];
  readonly expiresAt: ISODateString | null;
}
