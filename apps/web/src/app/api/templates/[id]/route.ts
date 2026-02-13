import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, ApiErrorCode } from "@/lib/api";
import { TemplateOwnerType } from "@prisma/client";

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  icon: z.string().optional(),
  meetingContext: z.string().min(0).max(4000).optional(),
  sections: z
    .array(
      z.object({
        id: z.string().optional(), // If present, update; else create
        title: z.string().min(1).max(60),
        hint: z.string().max(240).optional(),
      }),
    )
    .min(1)
    .max(25)
    .optional(),
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

  // Check ownership
  const existing = await prisma.template.findFirst({
    where: { id, isDeleted: false },
  });

  if (!existing) {
    return apiError(ApiErrorCode.NOT_FOUND);
  }

  if (
    existing.ownerType !== TemplateOwnerType.USER ||
    existing.ownerUserId !== userId
  ) {
    return apiError(ApiErrorCode.FORBIDDEN, "Cannot edit this template");
  }

  try {
    const json = await req.json();
    const body = updateTemplateSchema.parse(json);

    // Transaction to handle sections update
    await prisma.$transaction(async (tx) => {
      // 1. Update main template fields
      const updated = await tx.template.update({
        where: { id },
        data: {
          name: body.name,
          icon: body.icon,
          meetingContext: body.meetingContext,
        },
      });

      // 2. Handle sections (replace strategy for simplicity or diffing)
      // For simplicity in this iteration: Delete all and recreate if sections provided
      // A more optimized approach would be to diff by ID
      if (body.sections) {
        await tx.templateSection.deleteMany({
          where: { templateId: id },
        });

        await tx.templateSection.createMany({
          data: body.sections.map((s, i) => ({
            templateId: id,
            order: i,
            title: s.title,
            hint: s.hint,
          })),
        });
      }

      return updated;
    });

    // Fetch fresh state to return
    const result = await prisma.template.findUnique({
      where: { id },
      include: { sections: { orderBy: { order: "asc" } } },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(ApiErrorCode.VALIDATION_ERROR, error.message);
    }
    console.error("Failed to update template:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getAuthUserId();
  if (!userId) {
    return apiError(ApiErrorCode.UNAUTHORIZED);
  }

  const { id } = await params;

  const existing = await prisma.template.findFirst({
    where: { id, isDeleted: false },
  });

  if (!existing) {
    return apiError(ApiErrorCode.NOT_FOUND);
  }

  if (
    existing.ownerType !== TemplateOwnerType.USER ||
    existing.ownerUserId !== userId
  ) {
    return apiError(ApiErrorCode.FORBIDDEN, "Cannot delete this template");
  }

  try {
    // Soft delete
    await prisma.template.update({
      where: { id },
      data: { isDeleted: true },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete template:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}
