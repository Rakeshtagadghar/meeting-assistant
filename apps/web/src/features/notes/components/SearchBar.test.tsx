import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
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

  it("calls onChange with debounced value after typing", () => {
    const handleChange = vi.fn();

    render(<SearchBar value="" onChange={handleChange} />);

    const input = screen.getByPlaceholderText("Search notes...");

    // Simulate typing by firing change events directly
    act(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        globalThis.HTMLInputElement.prototype,
        "value",
      )?.set;
      nativeInputValueSetter?.call(input, "meeting");
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Advance past the debounce
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(handleChange).toHaveBeenLastCalledWith("meeting");
  });

  it("displays the controlled value", () => {
    render(<SearchBar value="test" onChange={vi.fn()} />);

    const input = screen.getByPlaceholderText("Search notes...");
    expect(input).toHaveValue("test");
  });
});
