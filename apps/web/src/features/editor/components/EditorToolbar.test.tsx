import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditorToolbar } from "./EditorToolbar";

describe("EditorToolbar", () => {
  const mockOnGenerate = vi.fn();
  const mockOnBold = vi.fn();
  const mockOnItalic = vi.fn();
  const mockOnHeading = vi.fn();
  const mockOnBulletList = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all formatting buttons", () => {
    render(<EditorToolbar onGenerate={mockOnGenerate} />);

    expect(screen.getByRole("button", { name: /bold/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /italic/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /heading/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /bullet list/i }),
    ).toBeInTheDocument();
  });

  it("renders Generate button", () => {
    render(<EditorToolbar onGenerate={mockOnGenerate} />);

    expect(
      screen.getByRole("button", { name: /generate/i }),
    ).toBeInTheDocument();
  });

  it("calls onGenerate when Generate button is clicked", () => {
    render(<EditorToolbar onGenerate={mockOnGenerate} />);

    fireEvent.click(screen.getByRole("button", { name: /generate/i }));
    expect(mockOnGenerate).toHaveBeenCalledTimes(1);
  });

  it("calls formatting handlers when buttons clicked", () => {
    render(
      <EditorToolbar
        onGenerate={mockOnGenerate}
        onBold={mockOnBold}
        onItalic={mockOnItalic}
        onHeading={mockOnHeading}
        onBulletList={mockOnBulletList}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /bold/i }));
    expect(mockOnBold).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /italic/i }));
    expect(mockOnItalic).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /heading/i }));
    expect(mockOnHeading).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /bullet list/i }));
    expect(mockOnBulletList).toHaveBeenCalledTimes(1);
  });

  it("shows spinner when generating", () => {
    render(<EditorToolbar onGenerate={mockOnGenerate} isGenerating={true} />);

    expect(screen.getByText(/generating/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("disables buttons when disabled prop is true", () => {
    render(<EditorToolbar onGenerate={mockOnGenerate} disabled={true} />);

    expect(screen.getByRole("button", { name: /bold/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /generate/i })).toBeDisabled();
  });

  it("has accessible toolbar role", () => {
    render(<EditorToolbar onGenerate={mockOnGenerate} />);

    expect(
      screen.getByRole("toolbar", { name: /editor toolbar/i }),
    ).toBeInTheDocument();
  });
});
