import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  prisma,
  createProcessingJobsRepository,
  createArtifactsRepository,
} from "@/lib/db";
import {
  ArtifactType,
  ArtifactStatus,
  ProcessingJobStatus,
  ProcessingJobKind,
} from "@ainotes/core";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";
import { generatePdf } from "@/lib/pdf-generator";

// Allow up to 60 seconds for PDF generation on Vercel
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const jobsRepo = createProcessingJobsRepository(prisma);
const artifactsRepo = createArtifactsRepository(prisma);
// const notesRepo = createNotesRepository(prisma);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const userId = await getAuthUserId();
  if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

  const jobId = (await params).jobId as import("@ainotes/core").UUID;

  const job = await jobsRepo.findById(jobId, userId);
  if (!job) return apiError(ApiErrorCode.NOT_FOUND, "Job not found");

  if (job.kind !== ProcessingJobKind.EXPORT_PDF) {
    return apiError(ApiErrorCode.VALIDATION_ERROR, "Invalid job type");
  }

  // Set up SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        // If job already completed/failed, just return status
        if (job.status === ProcessingJobStatus.COMPLETED) {
          // Find the artifact to get the URL
          const artifacts = await artifactsRepo.findByJob(jobId);
          const pdfArtifact = artifacts.find(
            (a) => a.type === ArtifactType.PDF,
          );

          let downloadUrl = null;
          if (pdfArtifact?.storagePath) {
            // If it starts with 'exports/', assume it's in storage and generate signed URL
            if (pdfArtifact.storagePath.startsWith("exports/")) {
              const { supabaseAdmin } = await import("@/lib/supabase-admin");
              if (supabaseAdmin) {
                const { data } = await supabaseAdmin.storage
                  .from("artifacts")
                  .createSignedUrl(pdfArtifact.storagePath, 60 * 60); // 1 hour
                downloadUrl = data?.signedUrl;
              } else {
                // Should not happen if path is exports/, but handle gracefully
                // eslint-disable-next-line no-console
                console.warn(
                  "Supabase configured for storagePath but admin client missing",
                );
              }
            } else {
              // Fallback for data URI or legacy path
              downloadUrl = pdfArtifact.storagePath.startsWith("data:")
                ? pdfArtifact.storagePath
                : null;
            }
          }

          send("completed", { downloadUrl });
          controller.close();
          return;
        }

        if (job.status === ProcessingJobStatus.FAILED) {
          send("failed", { error: job.error || "Job failed previously" });
          controller.close();
          return;
        }

        await jobsRepo.update(jobId, {
          status: ProcessingJobStatus.RUNNING,
          progressPct: 10,
          message: "Starting PDF generation...",
        });
        send("progress", { pct: 10, message: "Starting PDF generation..." });

        // 1. Get HTML Source
        const htmlArtifact = await artifactsRepo.findByNoteAndType(
          job.noteId,
          ArtifactType.HTML_SUMMARY,
        );

        if (!htmlArtifact || !htmlArtifact.storagePath) {
          throw new Error("HTML Summary not found or empty");
        }

        await jobsRepo.update(jobId, {
          progressPct: 30,
          message: "Preparing content...",
        });
        send("progress", { pct: 30, message: "Preparing content..." });

        // 2. Generate PDF
        await jobsRepo.update(jobId, {
          progressPct: 50,
          message: "Rendering PDF...",
        });
        send("progress", { pct: 50, message: "Rendering PDF..." });

        const pdfBuffer = await generatePdf(htmlArtifact.storagePath);

        // 3. Save PDF to Supabase Storage or Fallback
        await jobsRepo.update(jobId, {
          progressPct: 90,
          message: "Uploading file...",
        });
        send("progress", { pct: 90, message: "Uploading file..." });

        const { supabaseAdmin } = await import("@/lib/supabase-admin");

        let downloadUrl = null;
        let storagePathVal = "";

        if (supabaseAdmin) {
          const filename = `exports/${userId}/${job.noteId}-${Date.now()}.pdf`;

          const { error: uploadError } = await supabaseAdmin.storage
            .from("artifacts")
            .upload(filename, pdfBuffer, {
              contentType: "application/pdf",
              upsert: true,
            });

          if (uploadError) {
            throw new Error(`Storage upload failed: ${uploadError.message}`);
          }

          // Get signed URL
          const { data: signData, error: signError } =
            await supabaseAdmin.storage
              .from("artifacts")
              .createSignedUrl(filename, 60 * 60 * 24 * 7);

          if (signError || !signData?.signedUrl) {
            throw new Error(
              `Failed to generate download URL: ${signError?.message}`,
            );
          }

          downloadUrl = signData.signedUrl;
          storagePathVal = filename;
        } else {
          // Fallback to Data URI
          // eslint-disable-next-line no-console
          console.warn(
            "Supabase Admin keys missing/invalid - fallback to Data URI",
          );
          const base64Pdf = `data:application/pdf;base64,${pdfBuffer.toString("base64")}`;
          downloadUrl = base64Pdf;
          storagePathVal = base64Pdf;
        }

        const pdfArtifact = await artifactsRepo
          .findByJob(jobId)
          .then((list) => list.find((a) => a.type === ArtifactType.PDF));

        if (pdfArtifact) {
          await artifactsRepo.update(pdfArtifact.id, {
            status: ArtifactStatus.READY,
            storagePath: storagePathVal,
          });
        }

        // 4. Complete
        await jobsRepo.update(jobId, {
          status: ProcessingJobStatus.COMPLETED,
          progressPct: 100,
          message: "PDF Ready",
          endedAt: new Date(),
        });

        send("completed", { downloadUrl });
      } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.error("PDF Generation failed:", error);

        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        await jobsRepo.update(jobId, {
          status: ProcessingJobStatus.FAILED,
          error: errorMessage,
          endedAt: new Date(),
        });

        send("failed", { error: errorMessage });
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
