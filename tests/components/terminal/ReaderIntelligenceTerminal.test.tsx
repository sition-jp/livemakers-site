/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ReaderIntelligenceTerminal } from "@/components/terminal/ReaderIntelligenceTerminal";
import { terminalPreviewAdapterFixtureMock } from "@/lib/livemakers-terminal-preview/adapter-fixture-data";

const copy = {
  eyebrow: "Reader Intelligence Terminal",
  title: "Live Radar and Published Intelligence",
  subtitle:
    "A compact terminal surface for breaking candidates, current state, and published research.",
  currentStateTitle: "Current-state strip",
};

describe("ReaderIntelligenceTerminal", () => {
  it("renders a compact public terminal from the G31 reader topology", () => {
    render(
      <ReaderIntelligenceTerminal
        locale="en"
        data={terminalPreviewAdapterFixtureMock}
        copy={copy}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Live Radar and Published Intelligence",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Live Radar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Published Intelligence",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Current-state strip",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("AI model policy headlines are rising on X"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "On-chain state remains a Terminal data point, not a headline claim",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("On-chain")).toBeInTheDocument();
    expect(screen.getByText("sde review pending")).toBeInTheDocument();
  });

  it("keeps Live Radar title-only while article feed items are clickable", () => {
    const { container } = render(
      <ReaderIntelligenceTerminal
        locale="en"
        data={terminalPreviewAdapterFixtureMock}
        copy={copy}
      />,
    );

    const radarTitle = screen.getByText("AI model policy headlines are rising on X");
    expect(radarTitle.closest("a")).toBeNull();

    const feedLink = screen.getByRole("link", {
      name: /The Window That Didn't Open/i,
    });
    expect(feedLink).toHaveAttribute("href", "/brief/2026-W26-brief");

    expect(container.querySelector('a[href="/terminal-preview"]')).toBeNull();
    expect(container.querySelector('a[href^="file:"]')).toBeNull();
    expect(container.textContent).not.toContain("site_publish_log");
    expect(container.textContent).not.toContain("article_queue");
  });
});
