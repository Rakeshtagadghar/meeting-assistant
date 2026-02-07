import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchBar } from "./SearchBar";

describe("SearchBar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders an input with a search placeholder", () => {
    render(<SearchBar value="" onChange={vi.fn()} />);

    const input = screen.getByPlaceholderText("Search notes...");
    expect(input).toBeInTheDocument();
  });

  it("calls onChange with debounced value after typing", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<SearchBar value="" onChange={handleChange} />);

    const input = screen.getByPlaceholderText("Search notes...");
    await user.type(input, "meeting");

    // onChange should not have been called yet with the full value
    // (it fires debounced per character, so let's advance timers)
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(handleChange).toHaveBeenLastCalledWith("meeting");
  });

  it("updates the displayed value on type", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<SearchBar value="" onChange={vi.fn()} />);

    const input = screen.getByPlaceholderText("Search notes...");
    await user.type(input, "test");

    expect(input).toHaveValue("test");
  });
});
