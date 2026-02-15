import { apiError, ApiErrorCode } from "@/lib/api";
import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  buildSessionDetail,
  mapSessionRow,
  type ChatMessageRow,
  type ChatSessionRow,
} from "../../_lib/sessions";

async function findSessionForUser(
  sessionId: string,
  userId: string,
): Promise<ChatSessionRow | null> {
  const rows = await prisma.$queryRawUnsafe<ChatSessionRow[]>(
    `
    SELECT
      id,
      title,
      scope,
      mode,
      filters,
      created_at,
      updated_at
    FROM chat_sessions
    WHERE id = $1::uuid
      AND user_id = $2::uuid
    LIMIT 1
    `,
    sessionId,
    userId,
  );
  return rows[0] ?? null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  void request;
  const userId = await getAuthUserId();
  if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

  const { sessionId } = await params;
  const sessionRow = await findSessionForUser(sessionId, userId);
  if (!sessionRow) return apiError(ApiErrorCode.NOT_FOUND);

  const messageRows = await prisma.$queryRawUnsafe<ChatMessageRow[]>(
    `
    SELECT
      id,
      role,
      content,
      citations,
      created_at
    FROM chat_messages
    WHERE session_id = $1::uuid
      AND user_id = $2::uuid
    ORDER BY created_at ASC
    LIMIT 300
    `,
    sessionId,
    userId,
  );

  return Response.json({
    session: buildSessionDetail(sessionRow, messageRows),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const userId = await getAuthUserId();
  if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

  const { sessionId } = await params;
  const sessionRow = await findSessionForUser(sessionId, userId);
  if (!sessionRow) return apiError(ApiErrorCode.NOT_FOUND);

  let body: { title?: string };
  try {
    body = (await request.json()) as { title?: string };
  } catch {
    body = {};
  }

  const title = body.title?.trim();
  if (!title) {
    return apiError(ApiErrorCode.VALIDATION_ERROR, "title is required");
  }

  const rows = await prisma.$queryRawUnsafe<ChatSessionRow[]>(
    `
    UPDATE chat_sessions
    SET
      title = $1,
      updated_at = NOW()
    WHERE id = $2::uuid
      AND user_id = $3::uuid
    RETURNING
      id,
      title,
      scope,
      mode,
      filters,
      created_at,
      updated_at
    `,
    title,
    sessionId,
    userId,
  );

  const updated = rows[0];
  if (!updated) return apiError(ApiErrorCode.NOT_FOUND);

  return Response.json({ session: mapSessionRow(updated) });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  void request;
  const userId = await getAuthUserId();
  if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

  const { sessionId } = await params;

  await prisma.$executeRawUnsafe(
    `
    DELETE FROM chat_sessions
    WHERE id = $1::uuid
      AND user_id = $2::uuid
    `,
    sessionId,
    userId,
  );

  return Response.json({ ok: true });
}
