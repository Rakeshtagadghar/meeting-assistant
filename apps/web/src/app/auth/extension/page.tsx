import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/config";
import { ExtensionAuthClient } from "./client";

interface PageProps {
  searchParams: Promise<{ extId?: string }>;
}

export default async function ExtensionAuthPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const extId = params.extId;

  if (!extId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Invalid Request
          </h1>
          <p className="text-gray-500">Missing extension ID parameter.</p>
        </div>
      </div>
    );
  }

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(
      `/api/auth/signin?callbackUrl=${encodeURIComponent(`/auth/extension?extId=${extId}`)}`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session.user as any)?.id as string | undefined;
  const email = session.user.email ?? undefined;

  const tokenPayload = {
    userId: userId ?? "unknown",
    email: email ?? "unknown",
    extId,
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000,
  };

  const token = Buffer.from(JSON.stringify(tokenPayload)).toString("base64url");

  return (
    <ExtensionAuthClient
      token={token}
      email={email ?? null}
      extId={extId}
      expiresAt={tokenPayload.exp}
    />
  );
}
