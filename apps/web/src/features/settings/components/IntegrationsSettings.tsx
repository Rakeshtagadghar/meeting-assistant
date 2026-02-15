"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { IntegrationConnection } from "@ainotes/api";
import { Button, Badge } from "@ainotes/ui";

interface IntegrationsResponse {
  integrations: IntegrationConnection[];
}

export function IntegrationsSettings() {
  const [integrations, setIntegrations] = useState<IntegrationConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const callbackStatus = searchParams.get("status");
  const callbackReason = searchParams.get("reason");
  const callbackIntegration = searchParams.get("integration");

  const notionIntegration = useMemo(
    () => integrations.find((integration) => integration.provider === "NOTION"),
    [integrations],
  );

  const loadIntegrations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/integrations", { method: "GET" });
      if (!res.ok) {
        throw new Error("Failed to load integrations");
      }

      const data = (await res.json()) as IntegrationsResponse;
      setIntegrations(data.integrations);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIntegrations().catch(() => undefined);
  }, [loadIntegrations]);

  const connectNotion = useCallback(() => {
    window.location.assign("/api/integrations/notion/connect");
  }, []);

  const disconnectNotion = useCallback(async () => {
    setBusyProvider("NOTION");
    setError(null);

    try {
      const res = await fetch("/api/integrations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "NOTION" }),
      });

      if (!res.ok) {
        throw new Error("Failed to disconnect Notion");
      }

      await loadIntegrations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disconnect Notion");
    } finally {
      setBusyProvider(null);
    }
  }, [loadIntegrations]);

  const notionWorkspaceName = notionIntegration?.metadataJson
    ? ((notionIntegration.metadataJson as { workspace_name?: string })
        .workspace_name ?? null)
    : null;

  return (
    <div className="glass-card rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-heading">
          Integrations
        </h2>
        {loading ? (
          <span className="text-sm text-text-muted">Loading...</span>
        ) : notionIntegration ? (
          <Badge variant="success">Notion Connected</Badge>
        ) : (
          <Badge variant="default">Not Connected</Badge>
        )}
      </div>

      {callbackIntegration === "notion" && callbackStatus === "connected" ? (
        <p className="text-sm text-emerald-600 mb-3">
          Notion connected successfully.
        </p>
      ) : null}

      {callbackIntegration === "notion" && callbackStatus === "error" ? (
        <p className="text-sm text-red-600 mb-3">
          Notion connection failed
          {callbackReason ? ` (${callbackReason.replaceAll("_", " ")})` : ""}.
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}

      <div className="flex items-center justify-between py-3 border-t border-gray-100">
        <div>
          <p className="font-medium text-text-heading">Notion</p>
          <p className="text-sm text-text-muted">
            {notionWorkspaceName
              ? `Workspace: ${notionWorkspaceName}`
              : "Export summaries and action items to Notion pages."}
          </p>
        </div>

        {notionIntegration ? (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={busyProvider === "NOTION"}
              onClick={() => {
                void disconnectNotion();
              }}
            >
              {busyProvider === "NOTION" ? "Disconnecting..." : "Disconnect"}
            </Button>
          </div>
        ) : (
          <Button variant="primary" onClick={connectNotion}>
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}
