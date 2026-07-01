/* @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TerminalPreviewSurface } from "@/components/livemakers-terminal-preview/TerminalPreviewSurface";
import { terminalPreviewAdapterFixtureMock } from "@/lib/livemakers-terminal-preview/adapter-fixture-data";

const copy = {
  mockBadge: "MOCK",
  fixtureOnly: "Fixture only",
  unavailable: "Unavailable",
  boundaryTitle: "Boundary note",
  boundaryBody:
    "Static preview only. No real data connection, production publication, or site log mutation.",
  sourceLedgerTitle: "Source ledger",
};

describe("TerminalPreviewSurface", () => {
  it("renders the terminal-first sections from static mock data", () => {
    render(
      <TerminalPreviewSurface
        locale="en"
        data={terminalPreviewAdapterFixtureMock}
        copy={copy}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /breaking radar review queue/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /current-state strip/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /what happened/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /leading indicators/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /scenario radar/i })).toBeInTheDocument();
    expect(screen.getByText("Fixture only")).toBeInTheDocument();
    expect(screen.getByText(copy.boundaryBody)).toBeInTheDocument();
  });

  it("renders Breaking Radar body copy from the adapter fixture bridge", () => {
    render(
      <TerminalPreviewSurface
        locale="en"
        data={terminalPreviewAdapterFixtureMock}
        copy={copy}
      />,
    );

    expect(
      screen.getByText("Bank-capital commentary enters radar view"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("AI infrastructure capacity repeats across fixture notes"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Protocol status wording needs primary-source check"),
    ).toBeInTheDocument();
    expect(screen.getByText("Radar source discipline")).toBeInTheDocument();
    expect(
      screen.queryByText("Breaking Radar manual snapshot internal fixture"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Account-personalized raw capture is blocked"),
    ).not.toBeInTheDocument();
  });

  it("does not render navigation links from the hidden preview surface", () => {
    const { container } = render(
      <TerminalPreviewSurface
        locale="en"
        data={terminalPreviewAdapterFixtureMock}
        copy={copy}
      />,
    );

    expect(container.querySelector("nav")).toBeNull();
    expect(container.querySelector('a[href="/terminal-preview"]')).toBeNull();
  });

  it("switches the local visual theme between light and dark without adding navigation", () => {
    const { container } = render(
      <TerminalPreviewSurface
        locale="en"
        data={terminalPreviewAdapterFixtureMock}
        copy={copy}
      />,
    );

    const surface = screen.getByTestId("terminal-preview-surface");
    const lightButton = screen.getByRole("button", { name: "Light" });
    const darkButton = screen.getByRole("button", { name: "Dark" });

    expect(surface).toHaveAttribute("data-theme", "light");
    expect(lightButton).toHaveAttribute("aria-pressed", "true");
    expect(darkButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(darkButton);

    expect(surface).toHaveAttribute("data-theme", "dark");
    expect(lightButton).toHaveAttribute("aria-pressed", "false");
    expect(darkButton).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector("nav")).toBeNull();
  });
});
