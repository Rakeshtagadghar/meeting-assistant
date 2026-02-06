import { NextResponse } from "next/server";
import { healthcheck } from "@ainotes/api";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(healthcheck());
}
