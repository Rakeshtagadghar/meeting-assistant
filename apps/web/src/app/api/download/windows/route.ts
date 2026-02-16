import { NextResponse } from "next/server";
import {
  GITHUB_RELEASES_PAGE,
  getLatestWindowsRelease,
} from "@/lib/releases/github-releases";

export async function GET() {
  const latestRelease = await getLatestWindowsRelease({ cache: "no-store" });

  if (!latestRelease) {
    return NextResponse.redirect(GITHUB_RELEASES_PAGE, 307);
  }

  return NextResponse.redirect(latestRelease.downloadUrl, 307);
}
