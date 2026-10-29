/* @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import React from "react";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ja from "@/messages/ja.json";
import en from "@/messages/en.json";
import { StrengthLadder } from "@/components/turning-points/StrengthLadder";
import { ForecastCards } from "@/components/turning-points/ForecastCards";
import { ForecastText } from "@/components/turning-points/ForecastText";
import type { BacktestEvent, ForecastItem, LadderRow } from "@/lib/pivots/types";

function wrap(locale: "ja" | "en", ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ja" ? ja : en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

// BTC 2026-10-28 (data/pivot_assets.live.json)
const items: ForecastItem[] = [
  { event: "turn", horizon: "7D", today_pct: 44.6, usual_pct: 47.3, prev_today_pct: 44.6 },
  { event: "turn", horizon: "30D", today_pct: 50.9, usual_pct: 48.3, prev_today_pct: 50.9 },
  { event: "turn", horizon: "90D", today_pct: 19.3, usual_pct: 15.0, prev_today_pct: 19.3 },
  { event: "move", horizon: "7D", today_pct: 55.8, usual_pct: 59.0, prev_today_pct: 53.0 },
  { event: "move", horizon: "30D", today_pct: 77.2, usual_pct: 70.8, prev_today_pct: 80.6 },
  { event: "move", horizon: "90D", today_pct: 71.4, usual_pct: 68.4, prev_today_pct: 78.5 },
];
// 全 Level / 前日比なし・ゼロ・正・負を通すための変形
const mixed: ForecastItem[] = [
  { event: "turn", horizon: "7D", today_pct: 70.0, usual_pct: 47.3 }, // above, no prev
  { event: "turn", horizon: "30D", today_pct: 30.0, usual_pct: 48.3, prev_today_pct: 30.0 }, // below, zero
  { event: "turn", horizon: "90D", today_pct: 19.3, usual_pct: 15.0, prev_today_pct: 17.3 }, // usual, +
  { event: "move", horizon: "30D", today_pct: 77.2, usual_pct: 70.8, prev_today_pct: 80.6 }, // usual, -
];
const trend = { ret_30d_pct: -2.8, ret_90d_pct: 25.3 };

const ev = (usual: number, rate: number | null | undefined): BacktestEvent => ({
  asset: "BTC",
  event: "turn",
  horizon: "90D",
  usual_pct: usual,
  long_run_usual_pct: null,
  calibration: [],
  holdout: { brier_skill: null, lift_pts: null, n_signal: 0, holdout_rate_pct: rate, judged: false, primary: null, secondary: null },
});
const bigGap = [ev(15.0, 46.5)];
const smallGap = [ev(15.0, 20.0)];

const ladder: LadderRow[] = [
  { strength: "cycle", decided: true, last_confirmed: { date: "2025-10-06", kind: "top", close: 124658.54 }, candidate: { date: "2026-06-30", kind: "bottom", close: 58624.71 }, confirm_at: 87937.065 },
  { strength: "large", decided: true, last_confirmed: { date: "2026-02-05", kind: "bottom", close: 62909.86 }, candidate: { date: "2026-09-21", kind: "top", close: 86620.0 }, confirm_at: 60633.99999999999 },
  { strength: "medium", decided: true, last_confirmed: { date: "2026-06-30", kind: "bottom", close: 58624.71 }, candidate: { date: "2026-09-21", kind: "top", close: 86620.0 }, confirm_at: 73627.0 },
  { strength: "small", decided: true, last_confirmed: { date: "2026-09-21", kind: "top", close: 86620.0 }, candidate: { date: "2026-10-26", kind: "bottom", close: 80150.56 }, confirm_at: 84158.088 },
];
const ladderUndecided: LadderRow[] = ladder.map((r) =>
  r.strength === "cycle" ? { strength: "cycle", decided: false, last_confirmed: null, candidate: null, confirm_at: null } : r,
);

const BANNED = [/予測/, /上がる/, /下がる/, /反転幅/, /predict/i, /goes up/i, /goes down/i];
function expectClean(text: string) {
  for (const re of BANNED) expect(text).not.toMatch(re);
}

describe("ForecastCards", () => {
  it("renders the four questions in order with badges", () => {
    wrap("ja", <ForecastCards items={items} asset="BTC" />);
    const ids = screen.getAllByTestId(/^forecast-card-/).map((e) => e.getAttribute("data-testid"));
    expect(ids).toEqual(["forecast-card-turn30", "forecast-card-turn90", "forecast-card-turn7", "forecast-card-move30"]);
    expect(within(screen.getByTestId("forecast-card-turn30")).getByText("主役")).toBeTruthy();
    expect(within(screen.getByTestId("forecast-card-turn7")).getByText("参考")).toBeTruthy();
    expect(within(screen.getByTestId("forecast-card-turn90")).queryByText("主役")).toBeNull();
    expect(within(screen.getByTestId("forecast-card-turn90")).queryByText("参考")).toBeNull();
    expect(screen.getByTestId("forecast-card-turn30").textContent).toContain("今日 50.9%");
    expect(screen.getByTestId("forecast-card-turn30").textContent).toContain("ふだん 48.3%");
  });

  it("omits a question with no data", () => {
    wrap("ja", <ForecastCards items={items.filter((i) => !(i.event === "move" && i.horizon === "30D"))} asset="BTC" />);
    expect(screen.queryByTestId("forecast-card-move30")).toBeNull();
    expect(screen.getAllByTestId(/^forecast-card-/)).toHaveLength(3);
  });

  it("level colours and prev delta (up / down / zero / absent)", () => {
    wrap("ja", <ForecastCards items={mixed} asset="BTC" />);
    const today = (id: string) => within(screen.getByTestId(`forecast-card-${id}`)).getByText(/^今日 /);
    expect(today("turn7").className).toContain("text-pillar-market");
    expect(today("turn30").className).toContain("text-text-tertiary");
    expect(today("turn90").className).toContain("text-text-secondary");
    // prev
    expect(screen.queryByTestId("forecast-prev-turn7")).toBeNull();
    expect(screen.getByTestId("forecast-prev-turn30").textContent).not.toMatch(/[▲▼]/);
    expect(screen.getByTestId("forecast-prev-turn90").textContent).toBe("▲ 前日比 +2.0");
    expect(screen.getByTestId("forecast-prev-move30").textContent).toBe("▼ 前日比 −3.4");
  });

  it("two aria-hidden bars carry percentage widths", () => {
    wrap("ja", <ForecastCards items={items} asset="BTC" />);
    const bars = screen.getByTestId("forecast-card-turn30").querySelector('[aria-hidden="true"]')!;
    const fills = Array.from(bars.querySelectorAll<HTMLElement>("div[style]"));
    expect(fills.map((f) => f.style.width)).toEqual(["50.9%", "48.3%"]);
  });

  it("90D card: note90 always; gap note only when |holdout - usual| >= 20", () => {
    const { unmount } = wrap("ja", <ForecastCards items={items} events={bigGap} asset="BTC" />);
    expect(screen.getByTestId("forecast-note90-turn90").textContent).toContain("合否を付けていません");
    expect(screen.getByTestId("forecast-note90-gap-turn90").textContent).toBe("直近 12 か月の実際の発生率は 46.5%（ふだん 15.0%）。");
    expect(screen.queryByTestId("forecast-note90-turn30")).toBeNull();
    unmount();
    wrap("ja", <ForecastCards items={items} events={smallGap} asset="BTC" />);
    expect(screen.getByTestId("forecast-note90-turn90")).toBeTruthy();
    expect(screen.queryByTestId("forecast-note90-gap-turn90")).toBeNull();
  });

  it("no gap note without events, null rate, or other asset", () => {
    const { unmount } = wrap("ja", <ForecastCards items={items} asset="BTC" />);
    expect(screen.queryByTestId("forecast-note90-gap-turn90")).toBeNull();
    unmount();
    const { unmount: u2 } = wrap("ja", <ForecastCards items={items} events={[ev(15, null)]} asset="BTC" />);
    expect(screen.queryByTestId("forecast-note90-gap-turn90")).toBeNull();
    u2();
    wrap("ja", <ForecastCards items={items} events={bigGap} asset="ETH" />);
    expect(screen.queryByTestId("forecast-note90-gap-turn90")).toBeNull();
  });
});

describe("ForecastText", () => {
  it("emits 4 lines + trend under 'today'; fewer when a question is missing", () => {
    const { unmount } = wrap("ja", <ForecastText items={items} trend={trend} />);
    const root = screen.getByTestId("forecast-text");
    expect(within(root).getAllByTestId(/^forecast-line-/)).toHaveLength(4);
    expect(screen.getByTestId("forecast-trend").textContent).toBe("30 日 −2.8%・90 日 +25.3% の上昇基調");
    expect(screen.getByTestId("forecast-line-d30").textContent).toContain("大きく動くのは");
    expect(root.textContent).toContain("今日の予報");
    unmount();
    wrap("ja", <ForecastText items={items.filter((i) => !(i.event === "turn" && i.horizon === "90D"))} />);
    expect(screen.getAllByTestId(/^forecast-line-/)).toHaveLength(3);
    expect(screen.queryByTestId("forecast-trend")).toBeNull();
  });

  it("uses the 30-day-only trend variant", () => {
    wrap("en", <ForecastText items={items} trend={{ ret_30d_pct: -2.8 }} />);
    expect(screen.getByTestId("forecast-trend").textContent).toBe("30 days −2.8%: sideways");
  });
});

describe("StrengthLadder", () => {
  it("renders four rows in cycle -> small order with thresholds, % from now and notes", () => {
    wrap("ja", <StrengthLadder rows={ladder} nowClose={81174.45} />);
    const rows = screen.getAllByTestId(/^ladder-row-/).map((e) => e.getAttribute("data-testid"));
    expect(rows).toEqual(["ladder-row-cycle", "ladder-row-large", "ladder-row-medium", "ladder-row-small"]);
    // 確定条件: 底の候補 (cycle) は「以上」・天井の候補 (large) は「以下」
    expect(screen.getByTestId("ladder-row-cycle").textContent).toContain("安値から 5 割 戻したら底と数える = 87,937 以上");
    expect(screen.getByTestId("ladder-row-large").textContent).toContain("高値から 3 割 下げたら天井と数える = 60,634 以下");
    expect(screen.getByTestId("ladder-row-cycle").textContent).toContain("2025/10/6 の天井 124,659");
    // Review Focus 5 の注記
    expect(screen.getByTestId("ladder-note-large").textContent).toContain("この強さの底とは数えない");
    expect(screen.queryByTestId("ladder-note-small")).toBeNull();
  });

  it("shows 'まだ確定なし' for an undecided row and no condition price", () => {
    wrap("ja", <StrengthLadder rows={ladderUndecided} nowClose={81174.45} />);
    const row = screen.getByTestId("ladder-row-cycle");
    expect(row.textContent).toContain("まだ確定なし");
    expect(row.textContent).not.toMatch(/以上|以下/);
  });

  it("drops the % from now without a price, and renders nothing without rows", () => {
    const { unmount } = wrap("en", <StrengthLadder rows={ladder} nowClose={null} />);
    expect(screen.getByTestId("ladder-row-small").textContent).not.toContain("from now");
    unmount();
    const r = wrap("ja", <StrengthLadder rows={[]} nowClose={1} />);
    expect(r.container.innerHTML).toBe("");
    r.unmount();
    const r2 = wrap("ja", <StrengthLadder nowClose={1} />);
    expect(r2.container.innerHTML).toBe("");
  });
});

describe("banned words (T6)", () => {
  for (const locale of ["ja", "en"] as const) {
    it(`no banned word in ${locale} output across all branches`, () => {
      const { container } = wrap(
        locale,
        <>
          <ForecastCards items={items} events={bigGap} asset="BTC" />
          <ForecastCards items={mixed} events={smallGap} asset="BTC" />
          <ForecastText items={items} trend={trend} />
          <ForecastText items={mixed} trend={{ ret_90d_pct: -20 }} />
          <ForecastText items={mixed} trend={{ ret_30d_pct: 1 }} />
          <StrengthLadder rows={ladder} nowClose={81174.45} />
          <StrengthLadder rows={ladderUndecided} nowClose={null} />
        </>,
      );
      expect(container.textContent!.length).toBeGreaterThan(500);
      expectClean(container.textContent!);
    });
  }
});
