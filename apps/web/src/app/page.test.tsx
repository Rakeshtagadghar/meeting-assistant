import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

// Navbar uses useSession from next-auth/react
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
}));

describe("HomePage", () => {
  it("renders the brand link", () => {
    render(<HomePage />);
    expect(screen.getByRole("link", { name: "AINotes" })).toBeInTheDocument();
  });

  it("renders the main content area", () => {
    render(<HomePage />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
