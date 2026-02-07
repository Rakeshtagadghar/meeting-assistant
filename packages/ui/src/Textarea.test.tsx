import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Textarea } from "./Textarea";

describe("Textarea", () => {
  it("renders a textarea element", () => {
    render(<Textarea placeholder="Enter text" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  it("shows error message when error prop is set", () => {
    render(<Textarea error="Too short" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Too short");
  });

  it("sets aria-invalid when error is present", () => {
    render(<Textarea error="Invalid" data-testid="ta" />);
    expect(screen.getByTestId("ta")).toHaveAttribute("aria-invalid", "true");
  });

  it("does not show error when no error prop", () => {
    render(<Textarea />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
