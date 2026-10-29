/* @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import React from "react";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ja from "@/messages/ja.json";
import en from "@/messages/en.json";
import { ProbabilityTimeline } from "@/components/turning-points/ProbabilityTimeline";
import type { ForecastHistoryEntry, ForecastItem, TurnEntry } from "@/lib/pivots/types";

function wrap(locale: "ja" | "en", ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ja" ? ja : en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

type Out = "hit" | "miss" | "pending";
function day(date: string, pct: number | null, o: { out?: Out; bf?: boolean; close?: number } = {}): ForecastHistoryEntry {
  if (pct === null) return { date, close: o.close, backfilled: false };
  return {
    date,
    close: o.close,
    forecast: { turn: { "30D": pct } },
    outcome: o.out ? { turn: { "30D": o.out } } : undefined,
    backfilled: o.bf ?? false,
  };
}

// 2026-10-10 .. 10-29 (20 days). 10-15 and 10-16 are a two-day gap; 10-17 on is recorded.
const history: ForecastHistoryEntry[] = [
  day("2026-10-10", 40, { out: "hit", bf: true, close: 100 }),
  day("2026-10-11", 45, { out: "miss", bf: true, close: 102 }),
  day("2026-10-12", 50, { out: "hit", bf: true, close: 105 }),
  day("2026-10-13", 52, { out: "miss", bf: true, close: 103 }),
  day("2026-10-14", 55, { out: "pending", bf: true, close: 101 }),
  day("2026-10-15", null),
  day("2026-10-16", null),
  day("2026-10-17", 48, { out: "miss", close: 104 }),
  day("2026-10-18", 47, { out: "pending", close: 106 }),
  day("2026-10-19", 46, { out: "pending", close: 108 }),
  day("2026-10-20", 45, { out: "pending", close: 107 }),
  day("2026-10-21", 44, { out: "pending", close: 109 }),
  day("2026-10-22", 43, { out: "pending", close: 111 }),
  day("2026-10-23", 42, { out: "pending", close: 110 }),
  day("2026-10-24", 41, { out: "pending", close: 112 }),
  day("2026-10-25", 40, { out: "pending", close: 113 }),
  day("2026-10-26", 39, { out: "pending", bf: true, close: 114 }),
  day("2026-10-27", 38, { out: "pending", close: 115 }),
  day("2026-10-28", 37, { out: "pending", close: 116 }),
  day("2026-10-29", 55, { close: 117 }),
];
const turns: TurnEntry[] = [
  { date: "2026-10-12", kind: "top", close: 105, strength: "medium" },
  { date: "2026-10-14", kind: "bottom", close: 101, strength: "large" },
];
const item: ForecastItem = { event: "turn", horizon: "30D", today_pct: 55, usual_pct: 40 };

describe("ProbabilityTimeline full", () => {
  it("draws one bar per day with a forecast, hatches backfilled, one today bar", () => {
    wrap("ja", <ProbabilityTimeline asset="BTC" history={history} turns={turns} item={item} variant="full" />);
    const bars = screen.getAllByTestId("probability-bar");
    expect(bars).toHaveLength(18);
    expect(screen.getAllByTestId("probability-hatch")).toHaveLength(6);
    expect(bars.filter((b) => b.getAttribute("data-backfilled") === "true")).toHaveLength(6);
    expect(bars.filter((b) => b.getAttribute("data-status") === "today")).toHaveLength(1);
    expect(bars.filter((b) => b.getAttribute("data-status") === "hit")).toHaveLength(2);
    expect(bars.filter((b) => b.getAttribute("data-status") === "miss")).toHaveLength(3);
    expect(bars[0].parentElement?.getAttribute("class")).toContain("text-status-live");
  });

  it("uses a per-instance hatch pattern id", () => {
    const { container } = wrap("ja", <ProbabilityTimeline asset="BTC" history={history} turns={turns} item={item} variant="full" />);
    expect(container.querySelector("pattern#pt-hatch-BTC-full")).not.toBeNull();
    expect(screen.getAllByTestId("probability-hatch")[0].getAttribute("fill")).toBe("url(#pt-hatch-BTC-full)");
    expect(container.querySelector("pattern#pt-hatch-BTC-full")?.getAttribute("class")).toContain("text-text-primary");
    expect(container.innerHTML).not.toMatch(/status-up|status-down/);
  });

  it("labels each gap run once", () => {
    wrap("ja", <ProbabilityTimeline asset="BTC" history={history} turns={turns} item={item} variant="full" />);
    const labels = screen.getAllByTestId("probability-gap-label");
    expect(labels).toHaveLength(1);
    expect(labels[0].textContent).toBe("記録なし");
  });

  it("shows heading, notes, legend and future band labels (ja)", () => {
    wrap("ja", <ProbabilityTimeline asset="BTC" history={history} turns={turns} item={item} variant="full" />);
    const root = screen.getByTestId("probability-full-BTC");
    expect(root.textContent).toContain("30 日以内に中以上の天井か底が来る確率 ― 毎朝の推移と答え合わせ");
    expect(root.textContent).toContain("右端 = 30 日後");
    expect(screen.getByTestId("probability-legend-hit").textContent).toContain("来た日");
    expect(screen.getByTestId("probability-legend-backfilled").textContent).toContain("さかのぼり計算");
    const fut = screen.getByTestId("probability-future").textContent ?? "";
    expect(fut).toContain("この先 30 日の窓");
    expect(fut).toContain("55.0%");
    expect(root.textContent).toContain("ふだん 40.0%");
    const todayText = screen.getByText("55.0%");
    const usualText = screen.getByText("ふだん 40.0%");
    expect(usualText.getAttribute("y")).not.toBe(todayText.getAttribute("y"));
    expect(usualText.getAttribute("x")).toBe(todayText.getAttribute("x"));
  });

  it("draws price line, markers, usual line, today line, ticks", () => {
    wrap("ja", <ProbabilityTimeline asset="BTC" history={history} turns={turns} item={item} variant="full" />);
    expect(screen.getByTestId("probability-price")).toBeTruthy();
    const markers = screen.getAllByTestId("probability-marker");
    expect(markers.map((m) => m.textContent)).toEqual(["▼", "▲"]);
    expect(markers[0].getAttribute("class")).toContain("text-pillar-risk");
    expect(markers[1].getAttribute("class")).toContain("text-status-live");
    expect(Number(markers[1].getAttribute("font-size"))).toBeGreaterThan(Number(markers[0].getAttribute("font-size")));
    expect(screen.getByTestId("probability-usual-line")).toBeTruthy();
    expect(screen.getByTestId("probability-today-line")).toBeTruthy();
    expect(screen.getAllByTestId("probability-tick").length).toBeGreaterThan(0);
  });

  it("puts a count summary on the svg aria-label", () => {
    const { container } = wrap("ja", <ProbabilityTimeline asset="BTC" history={history} turns={turns} item={item} variant="full" />);
    expect(container.querySelector("svg")?.getAttribute("aria-label")).toBe(
      "BTC・過去 20 日・来た日 2 日・来なかった日 3 日・結果待ち 12 日",
    );
  });

  it("puts the price caption in HTML, not inside the svg", () => {
    const { container } = wrap("ja", <ProbabilityTimeline asset="BTC" history={history} turns={turns} item={item} variant="full" />);
    const cap = screen.getByTestId("probability-price-caption");
    expect(cap.textContent).toContain("価格（日足の終値）");
    expect(container.querySelector("svg")?.contains(cap)).toBe(false);
    expect(container.querySelector("svg")?.textContent).not.toContain("価格（日足の終値）");
  });

  it("falls back to turn/30D without an item and omits usual line", () => {
    wrap("ja", <ProbabilityTimeline asset="BTC" history={history} item={null} variant="full" />);
    expect(screen.getAllByTestId("probability-bar")).toHaveLength(18);
    expect(screen.queryByTestId("probability-usual-line")).toBeNull();
  });
});

describe("ProbabilityTimeline mini", () => {
  it("has testid, link, no heading/legend/gap label, and limits to 60 days", () => {
    wrap("ja", <ProbabilityTimeline asset="BTC" history={history} turns={turns} item={item} variant="mini" />);
    const root = screen.getByTestId("probability-mini-BTC");
    expect(root.querySelector("a")?.getAttribute("href")).toBe("/turning-points/btc");
    expect(root.textContent).not.toContain("毎朝の推移");
    expect(screen.queryByTestId("probability-legend-hit")).toBeNull();
    expect(screen.queryByTestId("probability-gap-label")).toBeNull();
    expect(screen.queryByText("10/12")).toBeNull();
  });

  it("keeps only the last 60 calendar days of a long history", () => {
    const long: ForecastHistoryEntry[] = [];
    const start = Date.parse("2026-07-01T00:00:00Z");
    for (let i = 0; i < 120; i++) {
      const d = new Date(start + i * 86400000).toISOString().slice(0, 10);
      long.push(day(d, 30 + (i % 10), { out: i === 119 ? undefined : "miss", close: 100 + i }));
    }
    const today = long[119].date;
    wrap("ja", <ProbabilityTimeline asset="BTC" history={long} item={item} variant="mini" />);
    const bars = screen.getAllByTestId("probability-bar");
    expect(bars).toHaveLength(60);
    const expectedFirst = new Date(Date.parse(`${today}T00:00:00Z`) - 59 * 86400000).toISOString().slice(0, 10);
    expect(bars[0].getAttribute("data-date")).toBe(expectedFirst);
  });

  it("names the asset in the heading and aria, and does not mix BTC and ETH", () => {
    const { container } = wrap(
      "ja",
      <>
        <ProbabilityTimeline asset="BTC" history={history} turns={turns} item={item} variant="mini" />
        <ProbabilityTimeline asset="ETH" history={history} turns={turns} item={item} variant="mini" />
      </>,
    );
    const btc = screen.getByTestId("probability-mini-BTC");
    const eth = screen.getByTestId("probability-mini-ETH");
    expect(btc.textContent).toContain("BTC・30 日以内に中以上の天井か底の確率（直近 60 日）");
    expect(btc.textContent).not.toContain("ETH");
    expect(eth.textContent).toContain("ETH・30 日以内");
    expect(eth.textContent).not.toContain("BTC");
    expect(btc.querySelector("svg")?.getAttribute("aria-label")).toContain("BTC・");
    expect(eth.querySelector("svg")?.getAttribute("aria-label")).toContain("ETH・");
    expect(container).toBeTruthy();
  });

  it("renders a notice when there is no history", () => {
    wrap("ja", <ProbabilityTimeline asset="BTC" history={[]} item={item} variant="mini" />);
    expect(screen.getByTestId("probability-mini-BTC").textContent).toContain("記録がまだありません");
    expect(screen.getByTestId("probability-mini-BTC").textContent).toContain("BTC・30 日以内");
  });
});

describe("banned words (T6)", () => {
  const BANNED = [/予測/, /上がる/, /下がる/, /反転幅/, /predict/i, /goes up/i, /goes down/i];
  for (const locale of ["ja", "en"] as const) {
    it(`no banned word in ${locale} messages or output`, () => {
      const msgs = JSON.stringify((locale === "ja" ? ja : en).turningPoints.probability);
      const { container } = wrap(locale, <ProbabilityTimeline asset="BTC" history={history} turns={turns} item={item} variant="full" />);
      const text = `${msgs} ${container.textContent}`;
      for (const re of BANNED) expect(text).not.toMatch(re);
    });
  }
  it("en renders heading and gap label", () => {
    wrap("en", <ProbabilityTimeline asset="BTC" history={history} turns={turns} item={item} variant="full" />);
    expect(screen.getByTestId("probability-full-BTC").textContent).toContain("daily record");
    expect(screen.getAllByTestId("probability-gap-label")[0].textContent).toBe("No record");
  });
});
