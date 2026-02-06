import type {
  ShareLink,
  UUID,
  ISODateString,
  CreateShareLinkInput,
} from "./types";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isShareLinkExpired(
  shareLink: ShareLink,
  now: ISODateString,
): boolean {
  if (shareLink.expiresAt === null) return false;
  return shareLink.expiresAt <= now;
}

export function isShareLinkOwner(shareLink: ShareLink, userId: UUID): boolean {
  return shareLink.createdByUserId === userId;
}

export function canAccessShareLink(
  shareLink: ShareLink,
  accessorEmail: string,
  now: ISODateString,
): { allowed: boolean; reason: string } {
  if (shareLink.visibility === "PRIVATE") {
    return { allowed: false, reason: "private" };
  }

  if (isShareLinkExpired(shareLink, now)) {
    return { allowed: false, reason: "expired" };
  }

  const normalized = normalizeEmail(accessorEmail);
  const emailAllowed = shareLink.allowedEmails.some(
    (e) => normalizeEmail(e) === normalized,
  );

  if (emailAllowed) {
    return { allowed: true, reason: "email_allowed" };
  }

  return { allowed: false, reason: "email_not_allowed" };
}

export function createShareLink(
  input: CreateShareLinkInput,
  id: UUID,
  token: string,
  now: ISODateString,
): ShareLink {
  return {
    id,
    noteId: input.noteId,
    createdByUserId: input.createdByUserId,
    visibility: input.visibility,
    allowedEmails: input.allowedEmails.map(normalizeEmail),
    token,
    expiresAt: input.expiresAt,
    createdAt: now,
  };
}
