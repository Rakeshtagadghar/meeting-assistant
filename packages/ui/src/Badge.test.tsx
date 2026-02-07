import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>Tag</Badge>);
    expect(screen.getByText("Tag")).toBeInTheDocument();
  });

  it("applies default variant classes", () => {
    render(<Badge data-testid="badge">Tag</Badge>);
    expect(screen.getByTestId("badge").className).toContain("bg-gray-100");
  });

  it("applies success variant classes", () => {
    render(
      <Badge variant="success" data-testid="badge">
        Done
      </Badge>,
    );
    expect(screen.getByTestId("badge").className).toContain("bg-green-100");
  });

  it("applies error variant classes", () => {
    render(
      <Badge variant="error" data-testid="badge">
        Fail
      </Badge>,
    );
    expect(screen.getByTestId("badge").className).toContain("bg-red-100");
  });

  it("shows remove button when removable", () => {
    render(<Badge removable>Tag</Badge>);
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("does not show remove button by default", () => {
    render(<Badge>Tag</Badge>);
    expect(
      screen.queryByRole("button", { name: "Remove" }),
    ).not.toBeInTheDocument();
  });

  it("calls onRemove when remove button is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <Badge removable onRemove={onRemove}>
        Tag
      </Badge>,
    );
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
