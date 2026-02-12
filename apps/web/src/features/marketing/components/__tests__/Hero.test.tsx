import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Hero } from "../Hero";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
  signIn: vi.fn(),
}));

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

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: {
      children?: React.ReactNode;
      [key: string]: unknown;
    }) => <div {...props}>{children}</div>,
    h1: ({
      children,
      ...props
    }: {
      children?: React.ReactNode;
      [key: string]: unknown;
    }) => <h1 {...props}>{children}</h1>,
    p: ({
      children,
      ...props
    }: {
      children?: React.ReactNode;
      [key: string]: unknown;
    }) => <p {...props}>{children}</p>,
  },
}));

vi.mock("../MockPreview", () => ({
  MockPreview: () => <div data-testid="mock-preview" />,
}));

let mockVariant: string | undefined;

vi.mock("posthog-js/react", () => ({
  useFeatureFlagVariantKey: () => mockVariant,
  usePostHog: () => null,
}));

describe("Hero CTA variants", () => {
  it("renders default CTA for control variant", () => {
    mockVariant = "control";
    render(<Hero />);
    expect(screen.getByText("Sign in with Google")).toBeInTheDocument();
  });

  it("renders alternative copy for cta_primary_copy_v2", () => {
    mockVariant = "cta_primary_copy_v2";
    render(<Hero />);
    expect(screen.getByText("Start taking notes free")).toBeInTheDocument();
  });

  it("renders default CTA when flag is undefined (loading)", () => {
    mockVariant = undefined;
    render(<Hero />);
    expect(screen.getByText("Sign in with Google")).toBeInTheDocument();
  });

  it("renders blue button variant for cta_primary_blue", () => {
    mockVariant = "cta_primary_blue";
    render(<Hero />);
    const btn = screen.getByText("Sign in with Google").closest("button");
    expect(btn?.className).toContain("bg-blue-600");
  });
});
