import { getServerSession } from "next-auth";
import { authOptions } from "./config";
import type { UUID } from "@ainotes/core";

export async function getAuthUserId(): Promise<UUID | null> {
  const session = await getServerSession(authOptions);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session?.user as any)?.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (session?.user as any)?.id as UUID;
  }

  // Fallback for dev mode without auth (if needed, or verify if Credentials provider handles it)
  // Credentials provider returns a fixed ID, so it is handled.

  return null;
}
