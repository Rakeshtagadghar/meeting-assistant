import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./Card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Content</Card>);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("applies base card classes", () => {
    render(<Card data-testid="card">Content</Card>);
    expect(screen.getByTestId("card").className).toContain("rounded-lg");
    expect(screen.getByTestId("card").className).toContain("shadow-sm");
  });

  it("applies hover classes when hoverable", () => {
    render(
      <Card hoverable data-testid="card">
        Content
      </Card>,
    );
    expect(screen.getByTestId("card").className).toContain("hover:shadow-md");
  });

  it("does not apply hover classes by default", () => {
    render(<Card data-testid="card">Content</Card>);
    expect(screen.getByTestId("card").className).not.toContain(
      "hover:shadow-md",
    );
  });
});
