import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";

// vi.hoisted runs before vi.mock hoisting, making variables available
const { mockOptIn, mockOptOut, mockSetConfig, mockPosthog } = vi.hoisted(() => {
  const mockOptIn = vi.fn();
  const mockOptOut = vi.fn();
  const mockSetConfig = vi.fn();
  const mockPosthog = {
    opt_in_capturing: mockOptIn,
    opt_out_capturing: mockOptOut,
    set_config: mockSetConfig,
    __loaded: true,
  };
  return { mockOptIn, mockOptOut, mockSetConfig, mockPosthog };
});

vi.mock("../client", () => ({
  POSTHOG_KEY: "phc_test",
  POSTHOG_HOST: "https://eu.i.posthog.com",
  initPostHog: () => mockPosthog,
}));

vi.mock("posthog-js", () => ({ default: mockPosthog }));

vi.mock("posthog-js/react", () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

import { PostHogProvider } from "../PostHogProvider";

describe("PostHogProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("does not opt in when consent is not given", () => {
    render(
      <PostHogProvider>
        <div>child</div>
      </PostHogProvider>,
    );

    expect(mockOptIn).not.toHaveBeenCalled();
    expect(mockOptOut).not.toHaveBeenCalled();
  });

  it("opts in when consent is already granted", () => {
    localStorage.setItem("ainotes-consent", "true");

    render(
      <PostHogProvider>
        <div>child</div>
      </PostHogProvider>,
    );

    expect(mockOptIn).toHaveBeenCalled();
    expect(mockSetConfig).toHaveBeenCalledWith({
      persistence: "localStorage+cookie",
    });
  });

  it("uses memory persistence and keeps capture enabled when consent was declined", () => {
    localStorage.setItem("ainotes-consent", "false");

    render(
      <PostHogProvider>
        <div>child</div>
      </PostHogProvider>,
    );

    expect(mockSetConfig).toHaveBeenCalledWith({ persistence: "memory" });
    expect(mockOptIn).toHaveBeenCalled();
    expect(mockOptOut).not.toHaveBeenCalled();
  });

  it("reacts to consent update events", () => {
    render(
      <PostHogProvider>
        <div>child</div>
      </PostHogProvider>,
    );

    localStorage.setItem("ainotes-consent", "true");
    act(() => {
      globalThis.dispatchEvent(new CustomEvent("ainotes-consent-update"));
    });

    expect(mockOptIn).toHaveBeenCalled();
  });
});
