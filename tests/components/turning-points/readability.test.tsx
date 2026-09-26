/* @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import React from "react";

// next-intl's createNavigation imports `next/navigation` without an `.js`
// extension, which Vitest's ESM resolver rejects under Next 16. Mock the
// locale-aware Link with a plain anchor so the test focuses on component
// behavior rather than next-intl plumbing. (Same mock shape as
// RadarTable.test.tsx.)
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

import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import ja from "@/messages/ja.json";
import { AssetDetail } from "@/components/turning-points/AssetDetail";
import { RadarTable } from "@/components/turning-points/RadarTable";
import { ReadingGuide } from "@/components/turning-points/ReadingGuide";
import type { PivotDetail, RadarAsset } from "@/lib/pivots/types";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="ja" messages={ja}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const scores = (overall: number, pp: number, vp: number) => ({
  overall,
  price_pivot: pp,
  volatility_pivot: vp,
  confidence_grade: "A" as const,
  main_signal: "price" as const,
});
const btc: RadarAsset = {
  symbol: "BTC",
  scores: { "7D": scores(16, 15, 0), "30D": scores(16, 15, 0), "90D": scores(15, 15, 0) },
};
const btcPrev: RadarAsset = {
  symbol: "BTC",
  scores: { "7D": scores(27, 20, 0), "30D": scores(16, 15, 0), "90D": scores(15, 15, 0) },
};

const detail: PivotDetail = {
  asset: { symbol: "BTC", name: "Bitcoin" },
  horizon: "30D",
  timestamp: "2026-09-25T23:00:17Z",
  scores: { overall: 16, price_pivot: 15, volatility_pivot: 0, confidence: { grade: "A", score: 88 } },
  direction_bias: { bullish: 0, bearish: 100, neutral: 0 },
  evidence: [
    { category: "price", direction: "bearish", weight: 0.15, message: "MACD momentum is weakening" },
    {
      category: "volatility",
      direction: "volatility",
      weight: 0.2,
      message: "Top trader positioning diverges from broader account positioning",
    },
    { category: "price", direction: "neutral", weight: 0.1, message: "Some future message the UI does not know" },
  ],
  summary: {
    level: "Low",
    headline: "Low turning point conditions in BTC 30D",
    explanation: "Direction bias leans bearish; main driver appears to be price reversal. Evidence count: 2.",
  },
};

describe("RadarTable readability", () => {
  it("shows the Japanese state label and hides direction while quiet", () => {
    wrap(<RadarTable assets={[btc]} previous={null} />);
    expect(screen.getByTestId("radar-state-BTC")).toHaveTextContent("静か");
    expect(screen.getByTestId("radar-state-BTC")).toHaveTextContent("価格");
    expect(screen.queryByText("傾き: 下方向")).toBeNull();
    expect(screen.getByText("データ整合度")).toBeTruthy();
  });
  it("shows day-over-day deltas when previous is supplied", () => {
    wrap(<RadarTable assets={[btc]} previous={{ generated_at: "2026-09-24T23:00:17Z", radar: [btcPrev] }} />);
    expect(screen.getByTestId("radar-delta-BTC-7D")).toHaveTextContent("−11");
    expect(screen.getByTestId("radar-delta-BTC-30D")).toHaveTextContent("±0");
  });
  it("shows no delta cell when previous is absent", () => {
    wrap(<RadarTable assets={[btc]} previous={null} />);
    expect(screen.queryByTestId("radar-delta-BTC-7D")).toBeNull();
  });
});

describe("AssetDetail readability", () => {
  it("renders state block, Japanese summary, translated evidence with meaning, and falls back for unknown text", () => {
    wrap(<AssetDetail detail={detail} asset="BTC" selectedHorizon="30D" previous={null} />);
    expect(screen.getByTestId("state-block")).toHaveTextContent("静か");
    expect(screen.getByTestId("state-summary")).toHaveTextContent("根拠 3 件");
    expect(screen.queryByText("Low turning point conditions in BTC 30D")).toBeNull();
    expect(screen.getByText("MACD の勢いが減速")).toBeTruthy();
    expect(screen.getByText("上昇の勢いが弱まっている")).toBeTruthy();
    expect(screen.getByText("Some future message the UI does not know")).toBeTruthy();
    expect(screen.getAllByText(/重み 0\.15/).length).toBeGreaterThan(0);
    expect(screen.getByText("データ整合度")).toBeTruthy();
    expect(screen.getByText(/的中率ではありません/)).toBeTruthy();
  });
  it("shows deltas on the three scores when previous is supplied", () => {
    wrap(
      <AssetDetail
        detail={detail}
        asset="BTC"
        selectedHorizon="30D"
        previous={{ overall: 20, price_pivot: 18, volatility_pivot: 0 }}
      />,
    );
    expect(screen.getByTestId("delta-overall")).toHaveTextContent("−4");
  });
});

describe("ReadingGuide", () => {
  it("renders the radar guide collapsed with all eight lines", () => {
    wrap(<ReadingGuide variant="radar" />);
    const details = screen.getByTestId("reading-guide");
    expect(details.tagName).toBe("DETAILS");
    expect(details).toHaveTextContent("このページの読み方");
    expect(details.querySelectorAll("li").length).toBe(8);
  });
  it("renders the backtest variant", () => {
    wrap(<ReadingGuide variant="backtest" />);
    expect(screen.getByTestId("reading-guide")).toHaveTextContent("この表の読み方");
  });
});
