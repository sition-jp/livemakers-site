/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ja from "@/messages/ja.json";
import { PivotAssetsSnapshotSchema, type PivotAssetsSnapshot } from "@/lib/pivots/types";

const mocks = vi.hoisted(() => ({
  assets: null as unknown,
  backtest: null as unknown,
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/pivots/pivots-reader", () => ({
  readAssetsSnapshot: async () => mocks.assets,
  readBacktestSnapshot: async () => mocks.backtest,
}));

import ListPage from "@/app/[locale]/turning-points/page";
import DetailPage from "@/app/[locale]/turning-points/[asset]/page";

// 小さな明示フィクスチャ。data/*.live.json は毎朝の自動 PR で書き換わり、失敗日には forecast が
// 無いことがあるので、テストは配信データを一切読まない。
type Sym = "BTC" | "ETH";
const SYMS: Sym[] = ["BTC", "ETH"];
const HS = ["7D", "30D", "90D"] as const;

function detailOf(symbol: Sym, horizon: string) {
  return {
    asset: { symbol, name: symbol === "BTC" ? "Bitcoin" : "Ethereum" },
    horizon,
    timestamp: "2026-10-28T23:00:00Z",
    scores: { overall: 35, price_pivot: 15, volatility_pivot: 45, confidence: { grade: "B+", score: 82 } },
    direction_bias: { bullish: 100, bearish: 0, neutral: 0 },
    evidence: [{ category: "price", direction: "bullish", weight: 0.15, message: "MACD momentum is improving" }],
    summary: { level: "Low", headline: "headline", explanation: "explanation" },
  };
}
const score = { overall: 35, price_pivot: 15, volatility_pivot: 45, confidence_grade: "B+", main_signal: "volatility" };

function forecastFor() {
  return [
    { event: "turn", horizon: "7D", today_pct: 44.6, usual_pct: 47.3, prev_today_pct: 44.6 },
    { event: "turn", horizon: "30D", today_pct: 50.9, usual_pct: 48.3, prev_today_pct: 48.9 },
    { event: "turn", horizon: "90D", today_pct: 19.3, usual_pct: 15.0 },
    { event: "move", horizon: "30D", today_pct: 77.2, usual_pct: 70.8 },
  ];
}
const historyFor = () => [
  { date: "2026-10-27", close: 80000, backfilled: false },
  { date: "2026-10-28", close: 81174.45, forecast: { turn: { "30D": 50.9 } }, backfilled: false },
];
const ladderFor = () => [
  {
    strength: "small",
    decided: true,
    last_confirmed: { date: "2026-10-01", kind: "top", close: 90000 },
    candidate: { date: "2026-10-20", kind: "bottom", close: 80000 },
    confirm_at: 84000,
  },
];

function load(): PivotAssetsSnapshot {
  const detail: Record<string, unknown> = {};
  for (const s of SYMS) for (const h of HS) detail[`${s}__${h}`] = detailOf(s, h);
  return PivotAssetsSnapshotSchema.parse({
    schema_version: "v0.1",
    generated_at: "2026-10-29T08:00:00+09:00",
    radar: SYMS.map((symbol) => ({ symbol, scores: { "7D": score, "30D": score, "90D": score } })),
    detail,
    forecast: { BTC: forecastFor(), ETH: forecastFor() },
    trend: { BTC: { ret_30d_pct: -2.8, ret_90d_pct: 25.3 }, ETH: { ret_30d_pct: -12.4, ret_90d_pct: 22.8 } },
    ladder: { BTC: ladderFor(), ETH: ladderFor() },
    turns: { BTC: [], ETH: [] },
    forecast_history: { BTC: historyFor(), ETH: historyFor() },
  });
}
function withoutForecast(s: PivotAssetsSnapshot, asset: Sym): PivotAssetsSnapshot {
  const forecast = { ...s.forecast };
  delete forecast[asset];
  return { ...s, forecast };
}
function setAssets(snapshot: PivotAssetsSnapshot) {
  mocks.assets = { fileExists: true, snapshot, mtimeMs: 0, parseError: null };
}
function ui(node: ReactNode) {
  return render(
    <NextIntlClientProvider locale="ja" messages={ja}>
      {node}
    </NextIntlClientProvider>,
  );
}
const detailProps = (asset: string, h?: string) => ({
  params: Promise.resolve({ locale: "ja", asset }),
  searchParams: Promise.resolve({ h }),
});
const listProps = { params: Promise.resolve({ locale: "ja" }) };

beforeEach(() => {
  mocks.backtest = { fileExists: false, snapshot: null, mtimeMs: null, parseError: null };
});

describe("detail page", () => {
  it("fixture sanity: 土台に両資産の forecast がある", () => {
    const s = load();
    expect(s.forecast?.BTC?.length).toBeGreaterThan(0);
    expect(s.forecast?.ETH?.length).toBeGreaterThan(0);
  });

  it("forecast が無い資産は今の画面・?h=7D が効く", async () => {
    setAssets(withoutForecast(load(), "BTC"));
    ui(await DetailPage(detailProps("btc", "7D")));
    expect(screen.getByTestId("horizon-link-30D")).toBeInTheDocument();
    expect(screen.queryByTestId("strength-ladder")).toBeNull();
    expect(screen.queryByTestId("asset-forecast-view")).toBeNull();
    const active = screen.getByTestId("horizon-link-7D");
    expect(active.className).toContain("bg-pillar-market/10");
    expect(screen.getByTestId("horizon-link-30D").className).not.toContain("bg-pillar-market/10");
  });

  it("forecast がある資産は新しい画面 (期間の切り替え無し)・?h= は無視", async () => {
    setAssets(load());
    ui(await DetailPage(detailProps("btc", "7D")));
    expect(screen.getByTestId("strength-ladder")).toBeInTheDocument();
    expect(screen.getByTestId("forecast-card-turn30")).toBeInTheDocument();
    expect(screen.queryByTestId("horizon-link-30D")).toBeNull();
  });

  it("資産ごとに判定する: BTC は今の画面でも ETH は新しい画面", async () => {
    setAssets(withoutForecast(load(), "BTC"));
    ui(await DetailPage(detailProps("eth")));
    expect(screen.getByTestId("strength-ladder")).toBeInTheDocument();
  });
});

describe("list page", () => {
  it("1 資産でも forecast が欠けたら今の表と TimelineMini", async () => {
    setAssets(withoutForecast(load(), "ETH"));
    ui(await ListPage(listProps));
    expect(screen.getByTestId("radar-state-BTC")).toBeInTheDocument();
    expect(document.querySelector("[data-testid^='radar-forecast-']")).toBeNull();
    expect(document.querySelector("[data-testid^='probability-mini-']")).toBeNull();
    expect(screen.getByTestId("timeline-mini-BTC")).toBeInTheDocument();
  });

  it("全資産に forecast があれば新しい列と mini", async () => {
    setAssets(load());
    ui(await ListPage(listProps));
    expect(screen.getByTestId("radar-forecast-BTC-turn30")).toBeInTheDocument();
    expect(screen.getByTestId("radar-forecast-ETH-move30")).toBeInTheDocument();
    expect(screen.queryByTestId("radar-state-BTC")).toBeNull();
    expect(screen.getByTestId("probability-mini-BTC")).toBeInTheDocument();
    expect(screen.queryByTestId("timeline-mini-BTC")).toBeNull();
  });
});
