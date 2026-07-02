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
import { getReviewedReaderTerminalSource } from "@/lib/livemakers-terminal-preview/reader-terminal-source";

const copy = {
  eyebrow: "Reader Intelligence Terminal",
  title: "Live Radar and Published Intelligence",
  subtitle:
    "A compact terminal surface for breaking candidates, current state, and published research.",
  sessionVisibilityTitle: "SDE session visibility",
  sessionVisibilityAsOf: "As of",
  sessionVisibilityPacket: "Packet",
  currentStateTitle: "Current-state strip",
  sourceStatusTitle: "Source status",
  sourceStatusReviewed: "Reviewed fixture",
  sourceStatusFixtureOnly: "Fixture only",
  sourceStatusReviewedAt: "Reviewed",
  sourceStatusPacket: "Packet",
};

const jaCopy = {
  eyebrow: "読者向けインテリジェンス・ターミナル",
  title: "速報レーダーと公開済みインテリジェンス",
  subtitle:
    "速報候補、現況データ、公開済みリサーチをひとつの小さなターミナル面にまとめます。",
  sessionVisibilityTitle: "SDEセッション可視化",
  sessionVisibilityAsOf: "基準時刻",
  sessionVisibilityPacket: "パケット",
  currentStateTitle: "現況ストリップ",
  sourceStatusTitle: "ソース状態",
  sourceStatusReviewed: "確認済みフィクスチャ",
  sourceStatusFixtureOnly: "フィクスチャのみ",
  sourceStatusReviewedAt: "確認日時",
  sourceStatusPacket: "パケット",
};

describe("ReaderIntelligenceTerminal", () => {
  const terminalData = getReviewedReaderTerminalSource().data;

  it("renders a compact public terminal from the G31 reader topology", () => {
    render(
      <ReaderIntelligenceTerminal
        locale="en"
        data={terminalData}
        copy={copy}
        sourceProvenance={{
          packetId: "fixture.reader_terminal_public_topology.2026_07_01.g31",
          sourceMode: "fixture_only",
          reviewStatus: "reviewed_fixture",
          reviewedAt: "2026-07-01T21:30:00+09:00",
        }}
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
        name: "SDE session visibility",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Asia Open Terminal")).toBeInTheDocument();
    expect(screen.getByText("surface_ready")).toBeInTheDocument();
    expect(screen.getByText("verify_next")).toBeInTheDocument();
    expect(screen.getByText("signal_seed")).toBeInTheDocument();
    expect(screen.getByText("already_covered")).toBeInTheDocument();
    expect(screen.getByText("Bank capital check")).toBeInTheDocument();
    expect(
      screen.getByText("Cardano status wording needs direct confirmation."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("deferred_to_signal_or_deep_dive"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Packet fixture\.scheduled_session_visibility\.2026_06_25_asia_open/,
      ),
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
    expect(screen.getByText("X News / Trends")).toBeInTheDocument();
    expect(screen.getByText("SDE Phase1 Breaking Radar")).toBeInTheDocument();
    expect(screen.getAllByText("title_only").length).toBeGreaterThan(0);
    expect(screen.getAllByText("not_authorized").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "On-chain state remains a Terminal data point, not a headline claim",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("On-chain")).toBeInTheDocument();
    expect(screen.getByText("sde_review_pending")).toBeInTheDocument();
    expect(screen.getByText("Source status")).toBeInTheDocument();
    expect(screen.getByText("Reviewed fixture")).toBeInTheDocument();
    expect(screen.getByText("Fixture only")).toBeInTheDocument();
    expect(
      screen.getByText("reviewed_fixture", { selector: ".font-mono" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("fixture_only", { selector: ".font-mono" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Reviewed 2026-07-01T21:30:00\+09:00/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Packet fixture\.reader_terminal_public_topology\.2026_07_01\.g31/,
      ),
    ).toBeInTheDocument();
  });

  it("renders the Japanese provenance row with exact payload values", () => {
    render(
      <ReaderIntelligenceTerminal
        locale="ja"
        data={terminalData}
        copy={jaCopy}
        sourceProvenance={{
          packetId: "fixture.reader_terminal_public_topology.2026_07_01.g31",
          sourceMode: "fixture_only",
          reviewStatus: "reviewed_fixture",
          reviewedAt: "2026-07-01T21:30:00+09:00",
        }}
      />,
    );

    expect(screen.getByText("ソース状態")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "SDEセッション可視化",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("銀行資本チェック")).toBeInTheDocument();
    expect(
      screen.getByText("Cardanoの状態表現は直接確認が必要です。"),
    ).toBeInTheDocument();
    expect(screen.getByText("確認済みフィクスチャ")).toBeInTheDocument();
    expect(
      screen.getByText("reviewed_fixture", { selector: ".font-mono" }),
    ).toBeInTheDocument();
    expect(screen.getByText("フィクスチャのみ")).toBeInTheDocument();
    expect(
      screen.getByText("fixture_only", { selector: ".font-mono" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("確認日時 2026-07-01T21:30:00+09:00"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "パケット fixture.reader_terminal_public_topology.2026_07_01.g31",
      ),
    ).toBeInTheDocument();
  });

  it("keeps the homepage terminal root within the mobile viewport padding box", () => {
    render(
      <ReaderIntelligenceTerminal
        locale="ja"
        data={terminalData}
        copy={jaCopy}
        sourceProvenance={{
          packetId: "fixture.reader_terminal_public_topology.2026_07_01.g31",
          sourceMode: "fixture_only",
          reviewStatus: "reviewed_fixture",
          reviewedAt: "2026-07-01T21:30:00+09:00",
        }}
      />,
    );

    const terminal = screen
      .getByRole("heading", {
        name: "速報レーダーと公開済みインテリジェンス",
      })
      .closest("section");

    expect(terminal).toHaveClass("box-border");
    expect(terminal).toHaveClass("w-full");

    const contentGrid = terminal?.querySelector(".grid.gap-8");
    expect(contentGrid).toHaveClass("grid-cols-[minmax(0,1fr)]");

    const headerGrid = terminal?.querySelector(".grid.gap-4");
    expect(headerGrid).toHaveClass("min-w-0");
  });

  it("keeps Live Radar title-only while article feed items are clickable", () => {
    const { container } = render(
      <ReaderIntelligenceTerminal
        locale="en"
        data={terminalData}
        copy={copy}
      />,
    );

    const sessionTitle = screen.getByText("Bank capital check");
    expect(sessionTitle.closest("a")).toBeNull();

    const radarTitle = screen.getByText("AI model policy headlines are rising on X");
    expect(radarTitle.closest("a")).toBeNull();

    const feedLink = screen.getByRole("link", {
      name: /The Window That Didn't Open/i,
    });
    expect(feedLink).toHaveAttribute("href", "/brief/2026-W26-brief");

    expect(container.querySelector('a[href="/terminal-preview"]')).toBeNull();
    expect(container.querySelector('a[href^="file:"]')).toBeNull();
    expect(container.textContent).not.toContain("raw X recommendation body");
    expect(container.textContent).not.toContain("site_publish_log");
    expect(container.textContent).not.toContain("article_queue");
  });
});
