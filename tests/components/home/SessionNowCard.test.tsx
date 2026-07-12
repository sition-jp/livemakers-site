/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { SessionNowCard } from "@/components/home/SessionNowCard";
import type { SessionRecord } from "@/lib/sessions/session-content";

const record: SessionRecord = {
  sessionId: "2026-07-10-asia-open",
  date: "2026-07-10",
  sessionSlug: "asia-open",
  liveStatus: "live",
  articleStatus: "pending",
  currentUrl: "/sessions/2026-07-10-asia-open",
  canonicalArticleUrl: null,
  publishedAt: null,
  publishLogId: null,
  packetId: "sess_20260710_asia",
  asOfJst: "2026-07-10T05:03:00+09:00",
  focusInstruments: ["nikkei_futures", "usd_jpy"],
  titleJa: "Asia Open Terminal",
  bullets: [
    "米CPI通過後、最初のアジア時間。円と日経先物の初動が焦点",
    "BTCは63K台で続伸。アジア時間の現物フローは薄く、方向感は米時間持ち越し",
  ],
  focusFallbackApplied: false,
  bodyJa: null,
};

const copy = {
  sessionBadgeSuffix: "JST 更新",
  freshnessPrefix: "スナップショット",
  nextUpdateLine: "次の更新: Europe Bridge Terminal 12:03 JST",
  readFull: "セッション全文を読む →",
  provenance: {
    review: "審査状態",
    source: "ソース",
    asOf: "as-of",
    packet: "パケットID",
  },
};
const provenance = {
  packetId: "sess_20260710_asia",
  sourceMode: "fixture_only" as const,
  reviewStatus: "reviewed_fixture" as const,
  asOfJst: "05:03 JST",
};

describe("SessionNowCard", () => {
  it("promotes bullets[0] to the headline and keeps nameEn + registry nameJa", () => {
    render(
      <SessionNowCard record={record} provenance={provenance} copy={copy} />,
    );
    expect(screen.getByRole("heading", { level: 3 }).textContent).toContain(
      "米CPI通過後、最初のアジア時間",
    );
    expect(screen.getByText("Asia Open Terminal")).toBeInTheDocument();
    expect(
      screen.getByText("朝 · 日本/アジア向け始動マップ"),
    ).toBeInTheDocument();
  });

  it("shows a dated snapshot freshness line and never a live-now token", () => {
    const { container } = render(
      <SessionNowCard record={record} provenance={provenance} copy={copy} />,
    );
    // スナップショット と 2026-07-10 はそれぞれ鮮度行のみに現れる一意テキスト。
    expect(screen.getByText(/スナップショット/)).toBeInTheDocument();
    expect(screen.getByText(/2026-07-10/)).toBeInTheDocument();
    expect(container.textContent).not.toContain("更新中");
    expect(container.textContent).not.toMatch(/\bLIVE\b/);
  });
});
