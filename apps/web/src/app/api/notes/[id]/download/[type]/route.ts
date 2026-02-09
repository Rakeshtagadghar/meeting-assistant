import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma, createArtifactsRepository } from "@/lib/db";
import type { ArtifactType } from "@ainotes/core";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> },
) {
  const userId = await getAuthUserId();
  if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

  const { id, type } = await params;
  const artifactType = type.toUpperCase() as ArtifactType;

  if (artifactType !== "PDF" && artifactType !== "DOCX") {
    return apiError(ApiErrorCode.VALIDATION_ERROR, "Invalid download type");
  }

  const artifactsRepo = createArtifactsRepository(prisma);
  const artifact = await artifactsRepo.findByNoteAndType(
    id as import("@ainotes/core").UUID,
    artifactType,
  );

  if (!artifact || artifact.status !== "READY" || !artifact.storagePath) {
    return apiError(ApiErrorCode.NOT_FOUND, "Download not ready or not found");
  }

  // Handle Supabase Storage
  if (artifact.storagePath.startsWith("exports/")) {
    const { supabaseAdmin } = await import("@/lib/supabase-admin");
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.storage
        .from("artifacts")
        .createSignedUrl(artifact.storagePath, 60 * 60); // 1 hour

      if (data?.signedUrl) {
        return NextResponse.redirect(data.signedUrl);
      }
      // eslint-disable-next-line no-console
      console.error("Failed to sign URL:", error);
    }
  }

  // Handle Data URI (fallback)
  if (artifact.storagePath.startsWith("data:")) {
    // We can't easily redirect to a data URI.
    // Option 1: Render a page that redirects (messy)
    // Option 2: Serve the content directly.

    const match = artifact.storagePath.match(
      /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/,
    );
    if (match) {
      const contentType = match[1] || "application/pdf";
      const base64Data = match[2] || "";
      const buffer = Buffer.from(base64Data, "base64");

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="summary-${id.slice(0, 8)}.pdf"`,
          "Content-Length": buffer.length.toString(),
        },
      });
    }
  }

  return apiError(ApiErrorCode.INTERNAL_ERROR, "Count not serve download");
}
