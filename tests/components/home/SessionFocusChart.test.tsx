/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SessionFocusChart } from "@/components/home/SessionFocusChart";
import type { FocusSeries } from "@/lib/sessions/focus-series";

const series: FocusSeries[] = [
  {
    instrumentId: "btc_usd",
    seriesPacketId: "series.2026-07-10.btc_usd",
    points: [
      { atJst: "2026-07-09T12:03:00+09:00", value: 61520 },
      { atJst: "2026-07-10T07:30:00+09:00", value: 63299 },
    ],
    baseValue: 61520,
    lastValue: 63299,
    changeFromBasePct: 2.89,
    sourceMode: "fixture_only",
    reviewStatus: "reviewed_fixture",
  },
];
const copy = {
  title: "セッション・フォーカス",
  snapshotBadge: "SNAPSHOT",
  basePrefix: "起点",
  description: "Asia Open Terminal の注目指標",
  provenance: {
    review: "審査状態",
    source: "ソース",
    asOf: "as-of",
    packet: "パケットID",
  },
};

describe("SessionFocusChart", () => {
  it("shows the base to last numeric line under each sparkline", () => {
    render(
      <SessionFocusChart
        sessionName="Asia Open Terminal"
        series={series}
        unavailableLabel="—"
        copy={copy}
      />,
    );
    expect(screen.getByText(/起点/)).toBeInTheDocument();
    expect(screen.getByText(/61,520/)).toBeInTheDocument();
  });

  // 2026-10-09 田平氏 GO: セッションカードと同じ銘柄が並ぶので、騰落率の
  // 基準 (起点の時刻) と桁数をそろえる。起点は「24h 内で最も古い観測」で
  // 24h ちょうどとは限らない (10/9 実測: 前日同セッションが 0.2 秒差で窓外)
  // → 期間ではなく起点の時刻を書く。
  it("labels the base with its JST time and keeps the instrument's decimals", () => {
    const eurUsd: FocusSeries = {
      instrumentId: "eur_usd",
      seriesPacketId: "series.2026-10-09.eur_usd",
      points: [
        { atJst: "2026-10-08T18:03:02+09:00", value: 1.1195 },
        { atJst: "2026-10-09T05:03:02+09:00", value: 1.122 },
        { atJst: "2026-10-09T12:03:02+09:00", value: 1.123 },
      ],
      baseValue: 1.1195,
      lastValue: 1.123,
      changeFromBasePct: 0.3126,
      sourceMode: "reviewed_live",
      reviewStatus: "reviewed_snapshot",
    };
    const { container } = render(
      <SessionFocusChart
        sessionName="Europe Bridge Terminal"
        series={[eurUsd]}
        unavailableLabel="—"
        copy={copy}
      />,
    );
    const baseLine = container.querySelector("[data-focus-base-line]");
    expect(baseLine?.textContent).toBe("起点 10/8 18:03 · 1.1195 → 1.1230");
    expect(container.querySelector("[data-focus-last-value]")?.textContent).toBe(
      "1.1230",
    );
  });

  it("applies the instrument's prefix and suffix like the session card", () => {
    const us10y: FocusSeries = {
      instrumentId: "us10y",
      seriesPacketId: "series.2026-10-09.us10y",
      points: [
        { atJst: "2026-10-08T18:03:02+09:00", value: 5.28 },
        { atJst: "2026-10-09T12:03:02+09:00", value: 5.2 },
      ],
      baseValue: 5.28,
      lastValue: 5.2,
      changeFromBasePct: -1.52,
      sourceMode: "reviewed_live",
      reviewStatus: "reviewed_snapshot",
    };
    const { container } = render(
      <SessionFocusChart
        sessionName="Europe Bridge Terminal"
        series={[us10y, series[0]]}
        unavailableLabel="—"
        copy={copy}
      />,
    );
    const lines = [...container.querySelectorAll("[data-focus-base-line]")].map(
      (node) => node.textContent,
    );
    expect(lines).toEqual([
      "起点 10/8 18:03 · 5.28% → 5.20%",
      "起点 7/9 12:03 · $61,520 → $63,299",
    ]);
  });
});
