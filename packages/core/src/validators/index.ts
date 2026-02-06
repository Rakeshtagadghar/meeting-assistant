import type {
  CreateNoteInput,
  UpdateNoteInput,
  CreateShareLinkInput,
  CreateMeetingSessionInput,
} from "../domain/types";
import {
  NoteType,
  ShareVisibility,
  MeetingSessionSource,
} from "../domain/types";

interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const MAX_TITLE_LENGTH = 500;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 50;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateTitle(title: string, errors: string[]): void {
  if (title.trim().length === 0) {
    errors.push("title must not be empty");
  } else if (title.length > MAX_TITLE_LENGTH) {
    errors.push(`title must not exceed ${String(MAX_TITLE_LENGTH)} characters`);
  }
}

function validateTags(tags: readonly string[], errors: string[]): void {
  if (tags.length > MAX_TAGS) {
    errors.push(`tags must not exceed ${String(MAX_TAGS)} items`);
  }
  for (let i = 0; i < tags.length; i++) {
    if (tags[i]!.length > MAX_TAG_LENGTH) {
      errors.push(
        `tag at index ${String(i)} exceeds ${String(MAX_TAG_LENGTH)} characters`,
      );
    }
  }
}

export function validateCreateNoteInput(
  input: CreateNoteInput,
): ValidationResult {
  const errors: string[] = [];

  validateTitle(input.title, errors);

  const validTypes = Object.values(NoteType);
  if (!validTypes.includes(input.type)) {
    errors.push(`type must be one of: ${validTypes.join(", ")}`);
  }

  validateTags(input.tags, errors);

  return { valid: errors.length === 0, errors };
}

export function validateUpdateNoteInput(
  input: UpdateNoteInput,
): ValidationResult {
  const errors: string[] = [];

  if (input.title !== undefined) {
    validateTitle(input.title, errors);
  }

  if (input.tags !== undefined) {
    validateTags(input.tags, errors);
  }

  return { valid: errors.length === 0, errors };
}

export function validateCreateShareLinkInput(
  input: CreateShareLinkInput,
): ValidationResult {
  const errors: string[] = [];

  const validVisibilities = Object.values(ShareVisibility);
  if (!validVisibilities.includes(input.visibility)) {
    errors.push(`visibility must be one of: ${validVisibilities.join(", ")}`);
  }

  if (input.visibility === "RESTRICTED" && input.allowedEmails.length === 0) {
    errors.push("RESTRICTED visibility requires at least one allowed email");
  }

  for (let i = 0; i < input.allowedEmails.length; i++) {
    if (!EMAIL_REGEX.test(input.allowedEmails[i]!)) {
      errors.push(`allowedEmails[${String(i)}]: invalid email format`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateCreateMeetingSessionInput(
  input: CreateMeetingSessionInput,
): ValidationResult {
  const errors: string[] = [];

  const validSources = Object.values(MeetingSessionSource);
  if (!validSources.includes(input.source)) {
    errors.push(`source must be one of: ${validSources.join(", ")}`);
  }

  return { valid: errors.length === 0, errors };
}
