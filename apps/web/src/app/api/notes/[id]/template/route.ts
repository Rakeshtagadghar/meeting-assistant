import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, ApiErrorCode } from "@/lib/api";
import { TemplateMode } from "@prisma/client";

const updateNoteTemplateSchema = z.object({
  templateId: z.string().uuid().optional().nullable(),
  mode: z.enum(["AUTO", "SELECTED"]),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getAuthUserId();
  if (!userId) {
    return apiError(ApiErrorCode.UNAUTHORIZED);
  }

  const { id } = await params;

  // Verify note ownership
  const note = await prisma.note.findUnique({
    where: { id, userId: userId },
  });

  if (!note) {
    return apiError(ApiErrorCode.NOT_FOUND);
  }

  try {
    const json = await req.json();
    const body = updateNoteTemplateSchema.parse(json);

    await prisma.note.update({
      where: { id },
      data: {
        templateId: body.templateId,
        templateMode:
          body.mode === "AUTO" ? TemplateMode.AUTO : TemplateMode.SELECTED,
        templateSelectedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(ApiErrorCode.VALIDATION_ERROR, error.message);
    }
    console.error("Failed to update note template:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}
