import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, ApiErrorCode } from "@/lib/api";
import { TemplateOwnerType } from "@prisma/client";

const createTemplateSchema = z.object({
  name: z.string().min(1).max(80),
  icon: z.string().optional(),
  meetingContext: z.string().min(0).max(4000),
  sections: z
    .array(
      z.object({
        title: z.string().min(1).max(60),
        hint: z.string().max(240).optional(),
      }),
    )
    .min(1)
    .max(25),
});

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) {
    return apiError(ApiErrorCode.UNAUTHORIZED);
  }

  try {
    const templates = await prisma.template.findMany({
      where: {
        OR: [
          { ownerType: TemplateOwnerType.SYSTEM },
          {
            ownerType: TemplateOwnerType.USER,
            ownerUserId: userId,
            isDeleted: false,
          },
        ],
      },
      include: {
        sections: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: [
        { ownerType: "asc" }, // SYSTEM first
        { name: "asc" },
      ],
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Failed to fetch templates:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}

export async function POST(req: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return apiError(ApiErrorCode.UNAUTHORIZED);
  }

  try {
    const json = await req.json();
    const body = createTemplateSchema.parse(json);

    const template = await prisma.template.create({
      data: {
        ownerType: TemplateOwnerType.USER,
        ownerUserId: userId,
        name: body.name,
        icon: body.icon,
        meetingContext: body.meetingContext,
        sections: {
          create: body.sections.map((section, index) => ({
            order: index,
            title: section.title,
            hint: section.hint,
          })),
        },
      },
      include: {
        sections: true,
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(ApiErrorCode.VALIDATION_ERROR, error.message);
    }
    console.error("Failed to create template:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}
