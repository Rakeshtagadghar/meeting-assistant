import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { UUID } from "@ainotes/core";
import { getAuthUserId } from "@/lib/auth";
import { apiError, ApiErrorCode } from "@/lib/api";
import {
  prisma,
  createProcessingJobsRepository,
  createArtifactsRepository,
} from "@/lib/db";

const jobsRepo = createProcessingJobsRepository(prisma);
const artifactsRepo = createArtifactsRepository(prisma);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const userId = getAuthUserId(request);
  if (!userId) return apiError(ApiErrorCode.UNAUTHORIZED);

  try {
    const { jobId } = await params;

    const job = await jobsRepo.findById(jobId as UUID, userId);
    if (!job) return apiError(ApiErrorCode.NOT_FOUND);

    const artifacts = await artifactsRepo.findByJob(job.id);

    return NextResponse.json({ job, artifacts });
  } catch (error: unknown) {
    console.error("GET /api/jobs/:jobId error:", error);
    return apiError(ApiErrorCode.INTERNAL_ERROR);
  }
}
