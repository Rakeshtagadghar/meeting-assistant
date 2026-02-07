import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TagManager } from "./TagManager";

describe("TagManager", () => {
  const mockOnTagsChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders existing tags as removable badges", () => {
    render(
      <TagManager tags={["work", "meeting"]} onTagsChange={mockOnTagsChange} />,
    );

    expect(screen.getByText("work")).toBeInTheDocument();
    expect(screen.getByText("meeting")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /remove/i })).toHaveLength(2);
  });

  it("renders input for adding new tags", () => {
    render(<TagManager tags={[]} onTagsChange={mockOnTagsChange} />);

    expect(screen.getByPlaceholderText(/add tag/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add/i })).toBeInTheDocument();
  });

  it("adds a new tag when Add button is clicked", () => {
    render(<TagManager tags={["existing"]} onTagsChange={mockOnTagsChange} />);

    const input = screen.getByPlaceholderText(/add tag/i);
    fireEvent.change(input, { target: { value: "newtag" } });
    fireEvent.click(screen.getByRole("button", { name: /add/i }));

    expect(mockOnTagsChange).toHaveBeenCalledWith(["existing", "newtag"]);
  });

  it("adds a new tag when Enter is pressed", () => {
    render(<TagManager tags={[]} onTagsChange={mockOnTagsChange} />);

    const input = screen.getByPlaceholderText(/add tag/i);
    fireEvent.change(input, { target: { value: "entertag" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockOnTagsChange).toHaveBeenCalledWith(["entertag"]);
  });

  it("removes a tag when remove button is clicked", () => {
    render(
      <TagManager tags={["work", "meeting"]} onTagsChange={mockOnTagsChange} />,
    );

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    fireEvent.click(removeButtons[0]!);

    expect(mockOnTagsChange).toHaveBeenCalledWith(["meeting"]);
  });

  it("prevents duplicate tags", () => {
    render(<TagManager tags={["work"]} onTagsChange={mockOnTagsChange} />);

    const input = screen.getByPlaceholderText(/add tag/i);
    fireEvent.change(input, { target: { value: "work" } });
    fireEvent.click(screen.getByRole("button", { name: /add/i }));

    expect(mockOnTagsChange).not.toHaveBeenCalled();
  });

  it("shows max tags message when limit reached", () => {
    render(
      <TagManager
        tags={["a", "b", "c"]}
        onTagsChange={mockOnTagsChange}
        maxTags={3}
      />,
    );

    expect(screen.getByText(/maximum 3 tags reached/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/add tag/i)).not.toBeInTheDocument();
  });

  it("normalizes tag input to lowercase", () => {
    render(<TagManager tags={[]} onTagsChange={mockOnTagsChange} />);

    const input = screen.getByPlaceholderText(/add tag/i);
    fireEvent.change(input, { target: { value: "UPPERCASE" } });
    fireEvent.click(screen.getByRole("button", { name: /add/i }));

    expect(mockOnTagsChange).toHaveBeenCalledWith(["uppercase"]);
  });

  it("has accessible list role", () => {
    render(<TagManager tags={["a", "b"]} onTagsChange={mockOnTagsChange} />);

    expect(screen.getByRole("list", { name: /tags/i })).toBeInTheDocument();
  });
});
