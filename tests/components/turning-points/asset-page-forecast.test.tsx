/* @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import React from "react";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ja from "@/messages/ja.json";
import en from "@/messages/en.json";
import { AssetForecastView } from "@/components/turning-points/AssetForecastView";
import { ReadingGuide } from "@/components/turning-points/ReadingGuide";
import { allForecastScreen, hasForecastScreen, nowCloseOf } from "@/lib/pivots/forecast-screen";
import type { PivotAssetsSnapshot } from "@/lib/pivots/types";

function wrap(locale: "ja" | "en", ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ja" ? ja : en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const detailOf = (h: string) => ({
  asset: { symbol: "BTC", name: "Bitcoin" },
  horizon: h,
  timestamp: "2026-10-28T23:00:00Z",
  scores: { overall: 50, price_pivot: 40, volatility_pivot: 60, confidence: { grade: "B+", score: 70 } },
  direction_bias: { level: "balanced", score: 50 },
  evidence: [{ category: "price", message: "rsi_neutral", weight: 0.5 }],
  summary: { level: "Low", headline: "h", explanation: "e" },
});

function snap(over: Record<string, unknown> = {}): PivotAssetsSnapshot {
  return {
    schema_version: "v0.1",
    generated_at: "2026-10-29T08:00:00+09:00",
    radar: [{ symbol: "BTC", scores: {} }],
    detail: { BTC__7D: detailOf("7D"), BTC__30D: detailOf("30D") }, // 90D 欠落
    forecast: {
      BTC: [
        { event: "turn", horizon: "30D", today_pct: 50.9, usual_pct: 48.3, prev_today_pct: 48.9 },
        { event: "turn", horizon: "90D", today_pct: 19.3, usual_pct: 15.0 },
        { event: "turn", horizon: "7D", today_pct: 44.6, usual_pct: 47.3 },
        { event: "move", horizon: "30D", today_pct: 77.2, usual_pct: 70.8 },
      ],
    },
    trend: { BTC: { ret_30d_pct: -2.8, ret_90d_pct: 25.3 } },
    ladder: {
      BTC: [
        { strength: "small", decided: true, last_confirmed: { date: "2026-10-01", kind: "top", close: 90000 }, candidate: { date: "2026-10-20", kind: "bottom", close: 80000 }, confirm_at: 84000 },
      ],
    },
    turns: { BTC: [] },
    forecast_history: {
      BTC: [
        { date: "2026-10-27", close: 80000, backfilled: false },
        { date: "2026-10-28", close: 81174.45, forecast: { turn: { "30D": 50.9 } }, backfilled: false },
        { date: "2026-10-29", backfilled: false },
      ],
    },
    ...over,
  } as unknown as PivotAssetsSnapshot;
}

describe("forecast-screen 判定", () => {
  it("forecast と forecast_history が揃う資産だけ新しい画面", () => {
    expect(hasForecastScreen(snap(), "BTC")).toBe(true);
    expect(hasForecastScreen(snap({ forecast_history: undefined }), "BTC")).toBe(false);
    expect(hasForecastScreen(snap({ forecast: { BTC: [] } }), "BTC")).toBe(false);
    expect(hasForecastScreen(snap(), "ETH")).toBe(false);
    expect(hasForecastScreen(null, "BTC")).toBe(false);
  });
  it("一覧は全資産が揃うときだけ", () => {
    expect(allForecastScreen(snap())).toBe(true);
    const two = snap({ radar: [{ symbol: "BTC", scores: {} }, { symbol: "ETH", scores: {} }] });
    expect(allForecastScreen(two)).toBe(false);
  });
  it("今の終値 = 最後の close", () => {
    expect(nowCloseOf(snap(), "BTC")).toBe(81174.45);
    expect(nowCloseOf(snap(), "ETH")).toBeNull();
  });
});

describe("AssetForecastView", () => {
  it("順番: はしご → カード → 予報文 → 棒グラフ → 根拠", () => {
    wrap("ja", <AssetForecastView asset="BTC" snapshot={snap()} />);
    const ids = ["strength-ladder", "forecast-cards", "forecast-text", "probability-full-BTC", "score-evidence"];
    const els = ids.map((id) => screen.getByTestId(id));
    for (let i = 0; i < els.length - 1; i++) {
      expect(els[i].compareDocumentPosition(els[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.getByTestId("forecast-card-turn30")).toBeInTheDocument();
  });

  it("期間切り替え・状態ブロック・旧タイムラインは出さない", () => {
    wrap("ja", <AssetForecastView asset="BTC" snapshot={snap()} />);
    expect(screen.queryByTestId("horizon-link-30D")).toBeNull();
    expect(screen.queryByTestId("state-block")).toBeNull();
    expect(screen.queryByTestId("delta-overall")).toBeNull();
  });

  it("根拠は horizon ごと・欠けた horizon は飛ばす", () => {
    wrap("ja", <AssetForecastView asset="BTC" snapshot={snap()} />);
    expect(screen.getByText("スコアの根拠（参考）")).toBeInTheDocument();
    expect(screen.getByTestId("score-evidence-7D")).toBeInTheDocument();
    expect(screen.getByTestId("score-evidence-30D")).toBeInTheDocument();
    expect(screen.queryByTestId("score-evidence-90D")).toBeNull();
    expect(screen.getAllByTestId("confidence-grade").length).toBe(2);
  });
});

describe("ReadingGuide (forecast)", () => {
  it("新しい項目を出し、今のガイドは変えない", () => {
    wrap("ja", <ReadingGuide variant="forecast" />);
    const g = screen.getByTestId("reading-guide");
    expect(g.querySelectorAll("li").length).toBe(9);
    expect(g).toHaveTextContent("ふだんの確率");
    expect(g).toHaveTextContent("結果待ち");
    expect(g).toHaveTextContent("値動きの予想ではありません");
    expect(g).toHaveTextContent("日足（UTC）");
    expect(g).toHaveTextContent("さかのぼって計算");
  });
  it("radar は 8 項目のまま", () => {
    wrap("ja", <ReadingGuide variant="radar" />);
    expect(screen.getByTestId("reading-guide").querySelectorAll("li").length).toBe(8);
  });
});

describe("新しい文言に禁止語が無い", () => {
  const BANNED = [/予測/, /上がる/, /下がる/, /反転幅/, /predict/i, /goes up/i, /goes down/i];
  for (const [name, m] of [["ja", ja], ["en", en]] as const) {
    it(`${name}: guide.forecast_* / forecast.question_short / evidence`, () => {
      const tp = m.turningPoints as Record<string, any>;
      const texts: string[] = [
        ...Object.entries(tp.guide).filter(([k]) => k.startsWith("forecast_")).map(([, v]) => String(v)),
        ...Object.values(tp.forecast.question_short).map(String),
        tp.forecast.evidence_heading,
        tp.forecast.evidence_horizon,
      ];
      expect(texts.length).toBe(9 + 4 + 2);
      for (const s of texts) for (const re of BANNED) expect(s).not.toMatch(re);
    });
  }
});
