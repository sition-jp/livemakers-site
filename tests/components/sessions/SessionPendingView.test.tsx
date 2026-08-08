/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SessionPendingView } from "@/components/sessions/SessionPendingView";
import type { SessionRecord } from "@/lib/sessions/session-content";

const record: SessionRecord = {
  sessionId: "2026-08-09-asia-open",
  date: "2026-08-09",
  sessionSlug: "asia-open",
  liveStatus: "live",
  articleStatus: "pending",
  currentUrl: "/sessions/2026-08-09-asia-open",
  canonicalArticleUrl: null,
  publishedAt: null,
  publishLogId: null,
  packetId: "sess_20260809_asia",
  asOfJst: "2026-08-09T07:30:00+09:00",
  focusInstruments: ["btc_usd", "usd_jpy"],
  titleJa: "Asia Open Terminal",
  bullets: ["BTC $63,299", "USD/JPY 162.343"],
  focusFallbackApplied: false,
  bodyJa: null,
  editorial: {
    digestId: "dig_20260809_0712_ab12cd34",
    crawlAnchorJst: "2026-08-09T05:03:00+09:00",
    writtenAtJst: "2026-08-09T07:12:00+09:00",
    lead: "市場は方向感を探っている。一次情報では判断材料が示された。",
    items: [
      {
        headline: "一次情報で確認された主要な動き",
        note: "発表主体は次の対応方針を示した。",
        sourceUrl: "https://primary.example.org/news/123",
      },
    ],
    watch: ["次の公式発表を確認する。"],
  },
};

const copy = {
  snapshotHeading: "数値スナップショット",
  highlightsHeading: "一次情報ハイライト",
  watchHeading: "次の見どころ",
  crystallizeNote: "このページは次のセッション切替時に記事になります。",
};

describe("SessionPendingView", () => {
  it("renders the full Japanese editorial in lead → snapshot → every source → watch order", () => {
    const { container } = render(
      <SessionPendingView record={record} locale="ja" copy={copy} />,
    );
    const text = container.textContent ?? "";
    expect(text.indexOf(record.editorial!.lead)).toBeLessThan(
      text.indexOf(copy.snapshotHeading),
    );
    expect(text.indexOf(copy.snapshotHeading)).toBeLessThan(
      text.indexOf(copy.highlightsHeading),
    );
    expect(text.indexOf(copy.highlightsHeading)).toBeLessThan(
      text.indexOf(copy.watchHeading),
    );
    expect(screen.getByText("BTC $63,299")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /一次情報で確認された主要な動き/ }),
    ).toHaveAttribute("href", "https://primary.example.org/news/123");
    expect(screen.getByText("次の公式発表を確認する。")).toBeInTheDocument();
  });

  it("hides editorial on English and keeps only the mechanical snapshot", () => {
    render(<SessionPendingView record={record} locale="en" copy={copy} />);
    expect(screen.queryByText(record.editorial!.lead)).toBeNull();
    expect(screen.queryByText(copy.highlightsHeading)).toBeNull();
    expect(screen.getByText("BTC $63,299")).toBeInTheDocument();
  });
});
