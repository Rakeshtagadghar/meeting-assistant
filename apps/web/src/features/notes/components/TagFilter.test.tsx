import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TagFilter } from "./TagFilter";

describe("TagFilter", () => {
  const tags = ["work", "personal", "meeting"];
  const mockOnTagSelect = vi.fn();

  it("renders the All button and all tags", () => {
    render(
      <TagFilter
        tags={tags}
        selectedTag={null}
        onTagSelect={mockOnTagSelect}
      />,
    );

    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("work")).toBeInTheDocument();
    expect(screen.getByText("personal")).toBeInTheDocument();
    expect(screen.getByText("meeting")).toBeInTheDocument();
  });

  it("marks All as selected when selectedTag is null", () => {
    render(
      <TagFilter
        tags={tags}
        selectedTag={null}
        onTagSelect={mockOnTagSelect}
      />,
    );

    const allButton = screen.getByText("All");
    expect(allButton).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onTagSelect with null when All is clicked", () => {
    render(
      <TagFilter
        tags={tags}
        selectedTag="work"
        onTagSelect={mockOnTagSelect}
      />,
    );

    fireEvent.click(screen.getByText("All"));
    expect(mockOnTagSelect).toHaveBeenCalledWith(null);
  });

  it("calls onTagSelect with tag name when a tag is clicked", () => {
    render(
      <TagFilter
        tags={tags}
        selectedTag={null}
        onTagSelect={mockOnTagSelect}
      />,
    );

    fireEvent.click(screen.getByText("work"));
    expect(mockOnTagSelect).toHaveBeenCalledWith("work");
  });

  it("renders empty when no tags provided", () => {
    render(
      <TagFilter tags={[]} selectedTag={null} onTagSelect={mockOnTagSelect} />,
    );

    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("has accessible group role", () => {
    render(
      <TagFilter
        tags={tags}
        selectedTag={null}
        onTagSelect={mockOnTagSelect}
      />,
    );

    expect(
      screen.getByRole("group", { name: /filter by tag/i }),
    ).toBeInTheDocument();
  });
});
