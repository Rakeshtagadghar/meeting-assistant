import type { NextRequest } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";
import { prisma } from "@/lib/db";
import type { ChatFilters } from "@/features/chat/types";
import { normalizeMode, normalizeScope } from "../_lib/rag";
import {
  mapSessionRow,
  sessionTitleFromMessage,
  type ChatSessionRow,
} from "../_lib/sessions";

interface CreateSessionBody {
  title?: string;
  scope?: string;
  mode?: string;
  filters?: ChatFilters;
}

export async function GET(): Promise<Response> {
  const userId = await getAuthUserId();
  if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

  const rows = await prisma.$queryRawUnsafe<ChatSessionRow[]>(
    `
    SELECT
      s.id,
      s.title,
      s.scope,
      s.mode,
      s.filters,
      s.created_at,
      s.updated_at,
      (
        SELECT m.content
        FROM chat_messages m
        WHERE m.session_id = s.id
          AND m.role = 'user'
        ORDER BY m.created_at ASC
        LIMIT 1
      ) AS preview,
      (
        SELECT COUNT(*)::int
        FROM chat_messages cm
        WHERE cm.session_id = s.id
      ) AS message_count
    FROM chat_sessions s
    WHERE s.user_id = $1::uuid
    ORDER BY s.updated_at DESC
    LIMIT 50
    `,
    userId,
  );

  return Response.json({
    sessions: rows.map(mapSessionRow),
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  const userId = await getAuthUserId();
  if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

  let body: CreateSessionBody;
  try {
    body = (await request.json()) as CreateSessionBody;
  } catch {
    body = {};
  }

  const scope = normalizeScope(body.scope);
  const mode = normalizeMode(body.mode);
  const title = body.title?.trim()
    ? sessionTitleFromMessage(body.title)
    : "New chat";
  const filters = body.filters ?? {};

  const rows = await prisma.$queryRawUnsafe<ChatSessionRow[]>(
    `
    INSERT INTO chat_sessions (
      user_id,
      title,
      scope,
      mode,
      filters
    ) VALUES (
      $1::uuid,
      $2,
      $3,
      $4,
      $5::jsonb
    )
    RETURNING
      id,
      title,
      scope,
      mode,
      filters,
      created_at,
      updated_at
    `,
    userId,
    title,
    scope,
    mode,
    JSON.stringify(filters),
  );

  const created = rows[0];
  if (!created) {
    return apiError(
      ApiErrorCode.INTERNAL_ERROR,
      "Failed to create chat session",
    );
  }

  return Response.json({ session: mapSessionRow(created) }, { status: 201 });
}

export async function DELETE(): Promise<Response> {
  const userId = await getAuthUserId();
  if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

  await prisma.$executeRawUnsafe(
    `
    DELETE FROM chat_sessions
    WHERE user_id = $1::uuid
    `,
    userId,
  );

  return Response.json({ ok: true });
}
