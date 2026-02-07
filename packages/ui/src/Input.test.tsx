import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "./Input";

describe("Input", () => {
  it("renders an input element", () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  it("shows error message when error prop is set", () => {
    render(<Input error="Required field" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Required field");
  });

  it("sets aria-invalid when error is present", () => {
    render(<Input error="Invalid" data-testid="input" />);
    expect(screen.getByTestId("input")).toHaveAttribute("aria-invalid", "true");
  });

  it("does not show error when no error prop", () => {
    render(<Input />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("applies error border class when error is present", () => {
    render(<Input error="Bad" data-testid="input" />);
    expect(screen.getByTestId("input").className).toContain("border-red-500");
  });

  it("forwards additional props", () => {
    render(<Input type="email" disabled />);
    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
  });
});
