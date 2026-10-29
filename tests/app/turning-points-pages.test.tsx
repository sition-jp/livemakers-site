/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import fs from "node:fs";
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

// コミット済みの配信データ (forecast / forecast_history / detail 入り) を土台にする
function load(): PivotAssetsSnapshot {
  const raw = JSON.parse(fs.readFileSync("data/pivot_assets.live.json", "utf8"));
  return PivotAssetsSnapshotSchema.parse(raw);
}
function withoutForecast(s: PivotAssetsSnapshot, asset: "BTC" | "ETH"): PivotAssetsSnapshot {
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
