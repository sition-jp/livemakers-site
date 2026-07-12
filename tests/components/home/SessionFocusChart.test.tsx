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
});
