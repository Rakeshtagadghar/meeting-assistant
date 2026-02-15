import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationsSettings } from "./IntegrationsSettings";

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

describe("IntegrationsSettings", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads integrations and shows connect when notion is not connected", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ integrations: [] }),
    } as Response);

    render(<IntegrationsSettings />);

    expect(await screen.findByText("Integrations")).toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/integrations", {
        method: "GET",
      });
    });

    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
  });

  it("shows connected state and workspace name when notion is connected", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        integrations: [
          {
            provider: "NOTION",
            expiresAt: null,
            metadataJson: { workspace_name: "Team Wiki" },
            createdAt: "2026-02-15T00:00:00.000Z",
            updatedAt: "2026-02-15T00:00:00.000Z",
          },
        ],
      }),
    } as Response);

    render(<IntegrationsSettings />);

    expect(await screen.findByText("Notion Connected")).toBeInTheDocument();
    expect(screen.getByText("Workspace: Team Wiki")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Disconnect" }),
    ).toBeInTheDocument();
  });
});
