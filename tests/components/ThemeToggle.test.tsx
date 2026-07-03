/* @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeToggle, THEME_STORAGE_KEY } from "@/components/ui/ThemeToggle";

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  window.localStorage.clear();
});

describe("ThemeToggle", () => {
  it("renders light as the default pressed option", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("switching to dark sets data-theme and persists the choice", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("switching back to light removes the attribute (light = no attribute)", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    fireEvent.click(screen.getByRole("button", { name: "Light" }));

    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("syncs its pressed state from a pre-paint dark attribute on mount", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
