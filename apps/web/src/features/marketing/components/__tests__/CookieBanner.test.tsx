import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CookieBanner } from "../CookieBanner";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockOptIn = vi.fn();
const mockOptOut = vi.fn();

vi.mock("posthog-js/react", () => ({
  usePostHog: () => ({
    opt_in_capturing: mockOptIn,
    opt_out_capturing: mockOptOut,
  }),
}));

describe("CookieBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("shows banner when no consent decision exists", () => {
    render(<CookieBanner />);
    expect(screen.getByText("We care about your privacy")).toBeInTheDocument();
  });

  it("does not show banner when consent already given", () => {
    localStorage.setItem("ainotes-consent", "true");
    render(<CookieBanner />);
    expect(
      screen.queryByText("We care about your privacy"),
    ).not.toBeInTheDocument();
  });

  it("does not show banner when consent already declined", () => {
    localStorage.setItem("ainotes-consent", "false");
    render(<CookieBanner />);
    expect(
      screen.queryByText("We care about your privacy"),
    ).not.toBeInTheDocument();
  });

  it("persists consent=true and opts in on accept", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);

    await user.click(screen.getByText("Accept All"));

    expect(localStorage.getItem("ainotes-consent")).toBe("true");
    expect(mockOptIn).toHaveBeenCalled();
  });

  it("persists consent=false and opts out on decline", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);

    await user.click(screen.getByText("Decline"));

    expect(localStorage.getItem("ainotes-consent")).toBe("false");
    expect(mockOptOut).toHaveBeenCalled();
  });

  it("hides banner after accepting", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);

    await user.click(screen.getByText("Accept All"));

    expect(
      screen.queryByText("We care about your privacy"),
    ).not.toBeInTheDocument();
  });
});
