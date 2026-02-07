import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "./Sidebar";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/notes",
}));

// Mock next/link
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

describe("Sidebar", () => {
  it("renders the logo", () => {
    render(<Sidebar />);
    const logos = screen.getAllByText("AINotes");
    expect(logos.length).toBeGreaterThan(0);
  });

  it("renders Notes nav link", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /^Notes$/ })).toBeInTheDocument();
  });

  it("renders Settings nav link", () => {
    render(<Sidebar />);
    expect(
      screen.getByRole("link", { name: /^Settings$/ }),
    ).toBeInTheDocument();
  });

  it("highlights active nav item with aria-current", () => {
    render(<Sidebar />);
    const notesLink = screen.getByRole("link", { name: /^Notes$/ });
    expect(notesLink).toHaveAttribute("aria-current", "page");
  });

  it("does not highlight non-active nav item", () => {
    render(<Sidebar />);
    const settingsLink = screen.getByRole("link", { name: /^Settings$/ });
    expect(settingsLink).not.toHaveAttribute("aria-current");
  });

  it("renders user placeholder", () => {
    render(<Sidebar />);
    expect(screen.getByText("User")).toBeInTheDocument();
  });

  it("renders main navigation landmark", () => {
    render(<Sidebar />);
    expect(
      screen.getByRole("navigation", { name: "Main" }),
    ).toBeInTheDocument();
  });

  it("renders toggle menu button on mobile", () => {
    render(<Sidebar />);
    expect(
      screen.getByRole("button", { name: "Toggle menu" }),
    ).toBeInTheDocument();
  });

  it("shows overlay when mobile menu is opened", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    expect(screen.queryByTestId("sidebar-overlay")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Toggle menu" }));
    expect(screen.getByTestId("sidebar-overlay")).toBeInTheDocument();
  });

  it("closes mobile menu when overlay is clicked", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(screen.getByRole("button", { name: "Toggle menu" }));
    expect(screen.getByTestId("sidebar-overlay")).toBeInTheDocument();

    await user.click(screen.getByTestId("sidebar-overlay"));
    expect(screen.queryByTestId("sidebar-overlay")).not.toBeInTheDocument();
  });
});
