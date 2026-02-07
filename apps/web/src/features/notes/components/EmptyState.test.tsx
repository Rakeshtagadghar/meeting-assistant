import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders the 'No notes yet' heading", () => {
    render(<EmptyState />);

    expect(
      screen.getByRole("heading", { name: "No notes yet" }),
    ).toBeInTheDocument();
  });

  it("renders the CTA button when onCreateNote is provided", () => {
    render(<EmptyState onCreateNote={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "Create your first note" }),
    ).toBeInTheDocument();
  });

  it("calls onCreateNote when the CTA button is clicked", async () => {
    const user = userEvent.setup();
    const handleCreate = vi.fn();

    render(<EmptyState onCreateNote={handleCreate} />);

    await user.click(
      screen.getByRole("button", { name: "Create your first note" }),
    );

    expect(handleCreate).toHaveBeenCalledTimes(1);
  });

  it("does not render the CTA button when onCreateNote is not provided", () => {
    render(<EmptyState />);

    expect(
      screen.queryByRole("button", { name: "Create your first note" }),
    ).not.toBeInTheDocument();
  });
});
