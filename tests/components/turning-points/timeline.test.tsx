/* @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ja from "@/messages/ja.json";
import en from "@/messages/en.json";
import { TurningPointTimeline } from "@/components/turning-points/TurningPointTimeline";
import type { BacktestEntry, HistoryEntry, RadarScores } from "@/lib/pivots/types";

function wrap(locale: "ja" | "en", ui: React.ReactNode) {
  const messages = locale === "ja" ? ja : en;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const current: RadarScores = {
  overall: 62,
  price_pivot: 55,
  volatility_pivot: 70,
  confidence_grade: "B+",
  main_signal: "mixed",
};

const history: HistoryEntry[] = [
  { date: "2026-08-28", close: 59000, overall: { "7D": 75, "30D": 75, "90D": 75 }, lean: { "7D": 0, "30D": 0, "90D": 0 } },
  { date: "2026-08-29", close: 59200, overall: { "7D": 10, "30D": 10, "90D": 10 }, lean: { "7D": 0, "30D": 0, "90D": 0 } },
  { date: "2026-08-30", close: 59400, overall: { "7D": 10, "30D": 10, "90D": 10 }, lean: { "7D": 0, "30D": 0, "90D": 0 } },
  { date: "2026-08-31", close: 59600, overall: { "7D": 10, "30D": 10, "90D": 10 }, lean: { "7D": 0, "30D": 0, "90D": 0 } },
  { date: "2026-09-01", close: 59800, overall: { "7D": 10, "30D": 10, "90D": 10 }, lean: { "7D": 0, "30D": 0, "90D": 0 } },
  { date: "2026-09-02", close: 60000, overall: { "7D": 10, "30D": 10, "90D": 10 }, lean: { "7D": 0, "30D": 0, "90D": 0 } },
  { date: "2026-09-03", close: 60200, overall: { "7D": 10, "30D": 10, "90D": 10 }, lean: { "7D": 0, "30D": 0, "90D": 0 } },
  { date: "2026-09-04", close: 61890, overall: { "7D": 10, "30D": 10, "90D": 10 }, lean: { "7D": 0, "30D": 0, "90D": 0 } },
];

const backtest: BacktestEntry[] = [
  {
    asset: "BTC",
    horizon: "7D",
    score_type: "price_pivot",
    threshold: 70,
    period: { start: "2021-12-01", end: "2026-09-03" },
    metrics: {
      precision: 0.5,
      recall: 0.4,
      avg_lead_time_days: 3,
      false_positive_rate: 0.2,
      false_negative_rate: 0.3,
      average_move: 0.03,
      max_drawdown: -0.05,
      sample_size: 12,
    },
  },
];

describe("TurningPointTimeline", () => {
  it("renders with history: testid, title, and the past/example groups", () => {
    wrap(
      "ja",
      <TurningPointTimeline
        asset="BTC"
        horizon="7D"
        today="2026-09-04"
        current={current}
        directionBias={{ bullish: 60, bearish: 20, neutral: 20 }}
        history={history}
        backtest={backtest}
      />,
    );
    const section = screen.getByTestId("turning-point-timeline");
    expect(section).toBeTruthy();
    const svgTitle = section.querySelector("svg > title");
    expect(svgTitle).not.toBeNull();
    expect(svgTitle!.textContent).toBe("転換点のタイムライン");
    expect(screen.getByTestId("timeline-past")).toBeTruthy();
    expect(screen.getByTestId("timeline-example")).toBeTruthy();
    expect(screen.getByTestId("timeline-window-7D")).toBeTruthy();
    expect(screen.getByTestId("timeline-window-30D")).toBeTruthy();
    expect(screen.getByTestId("timeline-window-90D")).toBeTruthy();
  });

  it("renders without throwing when history is absent (T5)", () => {
    wrap(
      "ja",
      <TurningPointTimeline
        asset="BTC"
        horizon="30D"
        today="2026-09-04"
        current={current}
        directionBias={null}
        history={null}
        backtest={[]}
      />,
    );
    expect(screen.getByTestId("turning-point-timeline")).toBeTruthy();
    expect(screen.queryByTestId("timeline-past")).toBeNull();
    expect(screen.getByText("履歴は蓄積中")).toBeTruthy();
    // still renders all three future windows
    expect(screen.getByTestId("timeline-window-7D")).toBeTruthy();
    expect(screen.getByTestId("timeline-window-30D")).toBeTruthy();
    expect(screen.getByTestId("timeline-window-90D")).toBeTruthy();
  });

  it("renders without throwing when current scores are missing", () => {
    wrap(
      "en",
      <TurningPointTimeline
        asset="ETH"
        horizon="30D"
        today="2026-09-04"
        current={null}
        directionBias={null}
        history={null}
        backtest={[]}
      />,
    );
    expect(screen.getByTestId("turning-point-timeline")).toBeTruthy();
  });
});

describe("TurningPointTimeline copy never asserts a prediction or direction (T6)", () => {
  const BANNED = [/予測/, /上がる/, /下がる/, /predict/i, /goes up/i, /goes down/i];

  function walkStrings(node: unknown, path: string, out: { path: string; value: string }[]) {
    if (typeof node === "string") {
      out.push({ path, value: node });
      return;
    }
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        walkStrings(v, `${path}.${k}`, out);
      }
    }
  }

  it.each([
    ["ja", (ja as { turningPoints: { timeline: unknown } }).turningPoints.timeline],
    ["en", (en as { turningPoints: { timeline: unknown } }).turningPoints.timeline],
  ])("%s: no banned word anywhere under turningPoints.timeline", (locale, timeline) => {
    const strings: { path: string; value: string }[] = [];
    walkStrings(timeline, `${locale}.turningPoints.timeline`, strings);
    expect(strings.length).toBeGreaterThan(0);
    for (const { path, value } of strings) {
      for (const pattern of BANNED) {
        expect(pattern.test(value), `${path} = "${value}" matched ${pattern}`).toBe(false);
      }
    }
  });
});
