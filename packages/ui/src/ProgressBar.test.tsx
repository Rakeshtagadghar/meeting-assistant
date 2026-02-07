import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressBar } from "./ProgressBar";

describe("ProgressBar", () => {
  it("renders with correct aria attributes", () => {
    render(<ProgressBar value={50} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "50");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("renders label when provided", () => {
    render(<ProgressBar value={75} label="Uploading" />);
    expect(screen.getByText("Uploading")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("clamps value to 0-100 range", () => {
    render(<ProgressBar value={150} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
  });

  it("clamps negative value to 0", () => {
    render(<ProgressBar value={-10} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
  });

  it("uses default variant", () => {
    const { container } = render(<ProgressBar value={50} />);
    const inner = container.querySelector("[class*='bg-blue-600']");
    expect(inner).not.toBeNull();
  });

  it("uses error variant", () => {
    const { container } = render(<ProgressBar value={50} variant="error" />);
    const inner = container.querySelector("[class*='bg-red-600']");
    expect(inner).not.toBeNull();
  });
});
