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
import type { MarketLane } from "@/lib/terminal/market-lanes";

const copy = {
  eyebrow: "Reader Intelligence Terminal",
  title: "Live Radar and Published Intelligence",
  subtitle: "Terminal surface.",
  sessionVisibilityTitle: "SDE session visibility",
  sessionVisibilityAsOf: "As of",
  sessionVisibilityPacket: "Packet",
  laneMacro: "Macro",
  laneCrypto: "Crypto",
  laneRwa: "RWA",
  fixtureLabel: "FIXTURE",
  radarUpdatedLabel: "updated",
  radarNextSessionLabel: "next session",
  titleOnlyBadge: "Title only · no link",
  archiveLinkLabel: "Intelligence archive",
  sourceStatusTitle: "Source status",
  sourceStatusReviewed: "Reviewed fixture",
  sourceStatusFixtureOnly: "Fixture only",
  sourceStatusReviewedAt: "Reviewed",
  sourceStatusPacket: "Packet",
};

/** Lanes as produced by mapTerminalFeed: live macro/crypto + fixture RWA. */
const liveLanes: MarketLane[] = [
  {
    key: "macro",
    badge: "SNAPSHOT",
    tiles: [
      {
        id: "macro.dxy",
        label: "DXY",
        value: "100.86",
        deltaPct: -0.7,
        note: { en: "US dollar index", ja: "米ドル指数" },
        badge: "SNAPSHOT",
        asOfLabel: "2026-07-04 07:30 JST",
      },
    ],
  },
  {
    key: "crypto",
    badge: "SNAPSHOT",
    tiles: [
      {
        id: "crypto.total",
        label: "TOTAL MCAP",
        value: null,
        note: { en: "Awaiting data source", ja: "データソース準備中" },
        badge: "SNAPSHOT",
      },
    ],
  },
  {
    key: "rwa",
    tiles: [
      {
        id: "rwa.stocks",
        label: "TOKENIZED STOCKS",
        value: null,
        note: { en: "Awaiting data source selection", ja: "データソース選定待ち" },
      },
    ],
  },
];

describe("ReaderIntelligenceTerminal (G39-B B2 live market lanes)", () => {
  const terminalData = getReviewedReaderTerminalSource().data;

  it("shows freshness badges and as-of labels on live tiles, FIXTURE on fixture tiles", () => {
    render(
      <ReaderIntelligenceTerminal
        locale="en"
        data={terminalData}
        copy={copy}
        marketLanes={liveLanes}
      />,
    );

    expect(screen.getByText("100.86")).toBeInTheDocument();
    expect(screen.getByText("2026-07-04 07:30 JST")).toBeInTheDocument();
    // live macro window + tile carry SNAPSHOT (window heading + tile marks)
    expect(screen.getAllByText("SNAPSHOT").length).toBeGreaterThanOrEqual(2);
    // unavailable stays an em dash, never 0 (crypto.total + rwa.stocks)
    expect(screen.getAllByText("—")).toHaveLength(2);
    // the RWA fixture lane still declares itself FIXTURE
    expect(screen.getAllByText("FIXTURE").length).toBeGreaterThanOrEqual(1);
  });

  it("renders delivered radar items with the session header (B3)", () => {
    render(
      <ReaderIntelligenceTerminal
        locale="en"
        data={terminalData}
        copy={copy}
        marketLanes={liveLanes}
        liveRadar={{
          badge: "SESSION",
          asOfLabel: "2026-07-04 18:20 JST",
          items: [
            {
              id: "radar.a1",
              sourceLane: "x_news_trends",
              sourceLabel: { en: "X", ja: "X" },
              family: "market_news",
              title: {
                en: "Treasury tightens stablecoin oversight",
                ja: "Treasury tightens stablecoin oversight",
              },
              status: "breaking",
              freshnessLabel: { en: "as of 18:05 JST", ja: "18:05 JST 時点" },
              displayMode: "title_only",
              publishDecision: "not_authorized",
              href: null,
            },
          ],
        }}
        scheduledSession={{
          lastCompletedLabel: "2026-07-04 18:20 JST",
          nextScheduledLabel: "2026-07-04 22:33 JST",
        }}
      />,
    );

    expect(
      screen.getByText("Treasury tightens stablecoin oversight"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "SESSION · updated 2026-07-04 18:20 JST · next session 2026-07-04 22:33 JST",
      ),
    ).toBeInTheDocument();
    // fixture radar items are replaced, not appended
    expect(screen.getAllByText("Title only · no link").length).toBe(1);
  });

  it("keeps the reviewed fixture radar when the feed radar is absent (B3 degraded state)", () => {
    render(
      <ReaderIntelligenceTerminal
        locale="en"
        data={terminalData}
        copy={copy}
        marketLanes={liveLanes}
        liveRadar={null}
        scheduledSession={null}
      />,
    );
    const fixtureItems = terminalData.publicTopology.liveRadar.items;
    expect(fixtureItems.length).toBeGreaterThan(0);
    expect(
      screen.getByText(fixtureItems[0].title.en),
    ).toBeInTheDocument();
  });

  it("keeps the ledger window order macro → crypto → rwa", () => {
    render(
      <ReaderIntelligenceTerminal
        locale="en"
        data={terminalData}
        copy={copy}
        marketLanes={liveLanes}
      />,
    );
    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    const macroIndex = headings.indexOf("Macro");
    const cryptoIndex = headings.indexOf("Crypto");
    const rwaIndex = headings.indexOf("RWA");
    expect(macroIndex).toBeGreaterThan(-1);
    expect(cryptoIndex).toBeGreaterThan(macroIndex);
    expect(rwaIndex).toBeGreaterThan(cryptoIndex);
  });
});
