import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dropdown } from "./Dropdown";

const items = [
  { label: "Edit", onClick: vi.fn() },
  { label: "Delete", onClick: vi.fn() },
];

describe("Dropdown", () => {
  it("renders trigger", () => {
    render(<Dropdown trigger={<span>Menu</span>} items={items} />);
    expect(screen.getByText("Menu")).toBeInTheDocument();
  });

  it("does not show menu items initially", () => {
    render(<Dropdown trigger={<span>Menu</span>} items={items} />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("shows menu items when trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<Dropdown trigger={<span>Menu</span>} items={items} />);

    await user.click(screen.getByText("Menu"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Delete" }),
    ).toBeInTheDocument();
  });

  it("calls item onClick and closes menu", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Dropdown
        trigger={<span>Menu</span>}
        items={[{ label: "Action", onClick }]}
      />,
    );

    await user.click(screen.getByText("Menu"));
    await user.click(screen.getByRole("menuitem", { name: "Action" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on Escape key", async () => {
    const user = userEvent.setup();
    render(<Dropdown trigger={<span>Menu</span>} items={items} />);

    await user.click(screen.getByText("Menu"));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("renders disabled items", async () => {
    const user = userEvent.setup();
    render(
      <Dropdown
        trigger={<span>Menu</span>}
        items={[{ label: "Disabled", onClick: vi.fn(), disabled: true }]}
      />,
    );

    await user.click(screen.getByText("Menu"));
    expect(screen.getByRole("menuitem", { name: "Disabled" })).toBeDisabled();
  });

  it("has aria-expanded attribute", async () => {
    const user = userEvent.setup();
    render(<Dropdown trigger={<span>Menu</span>} items={items} />);

    const trigger = screen.getByRole("button");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});
