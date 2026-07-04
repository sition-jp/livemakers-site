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
  laneMacro: "Macro",
  laneCrypto: "Crypto",
  laneRwa: "RWA",
  fixtureLabel: "FIXTURE",
  titleOnlyBadge: "Title only · no link",
  archiveLinkLabel: "Intelligence archive (incl. past Weekly Briefs)",
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
  laneMacro: "マクロ",
  laneCrypto: "暗号資産",
  laneRwa: "RWA",
  fixtureLabel: "FIXTURE",
  titleOnlyBadge: "タイトルのみ・非リンク",
  archiveLinkLabel: "過去のインテリジェンス一覧(旧 Weekly Brief 含む)",
  sourceStatusTitle: "ソース状態",
  sourceStatusReviewed: "確認済みフィクスチャ",
  sourceStatusFixtureOnly: "フィクスチャのみ",
  sourceStatusReviewedAt: "確認日時",
  sourceStatusPacket: "パケット",
};

const provenance = {
  packetId: "fixture.reader_terminal_public_topology.2026_07_01.g31",
  sourceMode: "fixture_only" as const,
  reviewStatus: "reviewed_fixture" as const,
  reviewedAt: "2026-07-01T21:30:00+09:00",
};

describe("ReaderIntelligenceTerminal", () => {
  const terminalData = getReviewedReaderTerminalSource().data;

  it("renders the terminal windows from the reader topology and market lanes", () => {
    render(
      <ReaderIntelligenceTerminal
        locale="en"
        data={terminalData}
        copy={copy}
        sourceProvenance={provenance}
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

    // Market-lane windows replace the old current-state strip (doctrine §2)
    expect(
      screen.getByRole("heading", { level: 3, name: "Macro" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Crypto" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "RWA" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("FIXTURE").length).toBeGreaterThan(0);
    expect(screen.getByText("BTC / USD")).toBeInTheDocument();
    // Cardano stays a lane member, not a pillar
    expect(screen.getByText("ADA / USD")).toBeInTheDocument();

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

  it("orders the windows by the doctrine §4 ledger in DOM order", () => {
    const { container } = render(
      <ReaderIntelligenceTerminal
        locale="en"
        data={terminalData}
        copy={copy}
      />,
    );

    const windowIds = Array.from(
      container.querySelectorAll('h3[id^="window-"]'),
    ).map((el) => el.id);

    expect(windowIds).toEqual([
      "window-live-radar",
      "window-lane-macro",
      "window-lane-crypto",
      "window-lane-rwa",
      "window-published",
    ]);
  });

  it("renders unavailable lane values as an em dash, never zero", () => {
    render(
      <ReaderIntelligenceTerminal
        locale="en"
        data={terminalData}
        copy={copy}
      />,
    );

    expect(screen.getByText("TOKENIZED STOCKS")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders the Japanese provenance row with exact payload values", () => {
    render(
      <ReaderIntelligenceTerminal
        locale="ja"
        data={terminalData}
        copy={jaCopy}
        sourceProvenance={provenance}
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
        sourceProvenance={provenance}
      />,
    );

    const terminal = screen
      .getByRole("heading", {
        name: "速報レーダーと公開済みインテリジェンス",
      })
      .closest("section");

    expect(terminal).toHaveClass("box-border");
    expect(terminal).toHaveClass("w-full");

    // §4 window grid: container-width auto-fit columns, min() guard so a
    // sub-300px container can never overflow horizontally.
    const windowGrid = terminal?.querySelector('[class*="auto-fit"]');
    expect(windowGrid).not.toBeNull();
    expect(windowGrid?.className).toContain("min(100%,300px)");

    windowGrid?.querySelectorAll(":scope > section").forEach((win) => {
      expect(win.className).toContain("min-w-0");
    });

    const headerGrid = terminal?.querySelector(".grid.gap-4");
    expect(headerGrid).toHaveClass("min-w-0");
  });

  it("keeps Live Radar title-only while published items are clickable", () => {
    const { container } = render(
      <ReaderIntelligenceTerminal
        locale="en"
        data={terminalData}
        copy={copy}
      />,
    );

    const sessionTitle = screen.getByText("Bank capital check");
    expect(sessionTitle.closest("a")).toBeNull();

    const radarTitle = screen.getByText(
      "AI model policy headlines are rising on X",
    );
    expect(radarTitle.closest("a")).toBeNull();

    // Every radar item carries the reader-facing non-link badge
    expect(screen.getAllByText("Title only · no link").length).toBeGreaterThan(
      0,
    );

    const feedLink = screen.getByRole("link", {
      name: /The Window That Didn't Open/i,
    });
    expect(feedLink).toHaveAttribute("href", "/brief/2026-W26-brief");

    const archiveLink = screen.getByRole("link", {
      name: /Intelligence archive/i,
    });
    expect(archiveLink).toHaveAttribute("href", "/brief");

    expect(container.querySelector('a[href="/terminal-preview"]')).toBeNull();
    expect(container.querySelector('a[href^="file:"]')).toBeNull();
    expect(container.textContent).not.toContain("raw X recommendation body");
    expect(container.textContent).not.toContain("site_publish_log");
    expect(container.textContent).not.toContain("article_queue");
  });
});
