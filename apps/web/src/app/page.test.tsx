import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

describe("HomePage", () => {
  it("renders the heading", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "AINotes" }),
    ).toBeInTheDocument();
  });

  it("renders the tagline", () => {
    render(<HomePage />);
    expect(
      screen.getByText("AI-powered meeting notes, private by default."),
    ).toBeInTheDocument();
  });
});
