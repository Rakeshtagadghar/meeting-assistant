import type {
  Note,
  UUID,
  ISODateString,
  CreateNoteInput,
  UpdateNoteInput,
  JsonValue,
} from "./types";

const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 50;

export function createNote(
  input: CreateNoteInput,
  userId: UUID,
  id: UUID,
  now: ISODateString,
): Note {
  return {
    id,
    userId,
    title: input.title,
    contentRich: input.contentRich,
    contentPlain: input.contentPlain,
    type: input.type,
    tags: normalizeTags(input.tags),
    pinned: false,
    folderId: input.folderId ?? null,
    templateId: null,
    templateMode: "AUTO",
    templateSelectedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

export function updateNote(
  note: Note,
  changes: UpdateNoteInput,
  now: ISODateString,
): Note {
  return {
    ...note,
    ...(changes.title !== undefined && { title: changes.title }),
    ...(changes.contentRich !== undefined && {
      contentRich: changes.contentRich,
    }),
    ...(changes.contentPlain !== undefined && {
      contentPlain: changes.contentPlain,
    }),
    ...(changes.tags !== undefined && { tags: normalizeTags(changes.tags) }),
    ...(changes.pinned !== undefined && { pinned: changes.pinned }),
    ...(changes.folderId !== undefined && {
      folderId: changes.folderId ?? null,
    }),
    updatedAt: now,
  };
}

export function softDeleteNote(note: Note, now: ISODateString): Note {
  return { ...note, deletedAt: now, updatedAt: now };
}

export function restoreNote(note: Note): Note {
  return { ...note, deletedAt: null };
}

export function serializeNote(note: Note): Record<string, JsonValue> {
  return {
    id: note.id,
    userId: note.userId,
    title: note.title,
    contentRich: note.contentRich,
    contentPlain: note.contentPlain,
    type: note.type,
    tags: [...note.tags],
    pinned: note.pinned,
    folderId: note.folderId,
    templateId: note.templateId,
    templateMode: note.templateMode,
    templateSelectedAt: note.templateSelectedAt,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    deletedAt: note.deletedAt,
  };
}

export function extractPlainText(contentRich: JsonValue): string {
  if (contentRich === null || typeof contentRich !== "object") {
    return "";
  }

  if (Array.isArray(contentRich)) {
    return contentRich.map((item) => extractPlainText(item)).join("");
  }

  const obj = contentRich as Record<string, JsonValue>;

  if (obj["type"] === "text" && typeof obj["text"] === "string") {
    return obj["text"];
  }

  if (Array.isArray(obj["content"])) {
    const parts = (obj["content"] as JsonValue[]).map((child) =>
      extractPlainText(child),
    );

    if (obj["type"] === "doc") {
      return parts.filter(Boolean).join("\n").trim();
    }

    return parts.join("");
  }

  return "";
}

export function normalizeTags(tags: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();
    if (normalized.length === 0) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= MAX_TAGS) break;
  }

  return result;
}

export function isValidTag(tag: string): boolean {
  const trimmed = tag.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_TAG_LENGTH;
}

export function addTag(note: Note, tag: string, now: ISODateString): Note {
  const normalized = tag.trim().toLowerCase();
  if (!isValidTag(normalized)) return note;
  if (note.tags.includes(normalized)) return { ...note, updatedAt: now };
  if (note.tags.length >= MAX_TAGS) return { ...note, updatedAt: now };

  return {
    ...note,
    tags: [...note.tags, normalized],
    updatedAt: now,
  };
}

export function removeTag(note: Note, tag: string, now: ISODateString): Note {
  const normalized = tag.trim().toLowerCase();
  const filtered = note.tags.filter((t) => t !== normalized);

  return {
    ...note,
    tags: filtered,
    updatedAt: now,
  };
}

export function pinNote(note: Note, now: ISODateString): Note {
  return { ...note, pinned: true, updatedAt: now };
}

export function unpinNote(note: Note, now: ISODateString): Note {
  return { ...note, pinned: false, updatedAt: now };
}
