import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { UUID } from "@ainotes/core";
import { ProcessingJobStatus } from "@ainotes/core";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";
import { prisma, createProcessingJobsRepository } from "@/lib/db";

const jobsRepo = createProcessingJobsRepository(prisma);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const userId = await getAuthUserId();
  if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

  try {
    const { jobId } = await params;

    const job = await jobsRepo.findById(jobId as UUID, userId);
    if (!job) return apiError(ApiErrorCode.NOT_FOUND);

    if (
      job.status !== ProcessingJobStatus.QUEUED &&
      job.status !== ProcessingJobStatus.RUNNING
    ) {
      return apiError(
        ApiErrorCode.CONFLICT,
        `Cannot cancel job in ${job.status} status`,
      );
    }

    await jobsRepo.update(job.id, {
      status: ProcessingJobStatus.CANCELLED,
      endedAt: new Date(),
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("POST /api/jobs/:jobId/cancel error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}
