/* @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import React from "react";

// next-intl's createNavigation imports `next/navigation` without an `.js`
// extension, which Vitest's ESM resolver rejects under Next 16. Mock the
// locale-aware Link with a plain anchor so the test focuses on component
// behavior rather than next-intl plumbing. (Same mock shape as
// RadarTable.test.tsx / readability.test.tsx.)
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

import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import ja from "@/messages/ja.json";
import { BacktestPanel, LOW_SAMPLE_THRESHOLD } from "@/components/turning-points/BacktestPanel";
import { BacktestProvenanceBanner } from "@/components/turning-points/BacktestProvenanceBanner";
import type { BacktestEntry, DataProvenance } from "@/lib/pivots/types";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="ja" messages={ja}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const baseMetrics = {
  precision: 0.5,
  recall: 0.4,
  avg_lead_time_days: 3,
  false_positive_rate: 0.3,
  false_negative_rate: 0.4,
  average_move: 0.05,
};

const lowSampleEntry: BacktestEntry = {
  asset: "BTC",
  horizon: "7D",
  score_type: "overall",
  threshold: 70,
  period: { start: "2021-01-01", end: "2026-05-04" },
  metrics: { ...baseMetrics, worst_forward_return: -0.09, sample_size: 3 },
};

const normalSampleEntry: BacktestEntry = {
  asset: "ETH",
  horizon: "30D",
  score_type: "price_pivot",
  threshold: 70,
  period: { start: "2021-01-01", end: "2026-05-04" },
  metrics: { ...baseMetrics, worst_forward_return: -0.07, sample_size: 12 },
};

describe("BacktestPanel low-sample dimming", () => {
  it("exports LOW_SAMPLE_THRESHOLD = 5", () => {
    expect(LOW_SAMPLE_THRESHOLD).toBe(5);
  });

  it("dims the sample_size=3 row with the low-sample testid and 参考値 badge, but not the sample_size=12 row", () => {
    wrap(<BacktestPanel entries={[lowSampleEntry, normalSampleEntry]} />);

    const lowSampleRows = screen.getAllByTestId("backtest-row-low-sample");
    expect(lowSampleRows.length).toBe(1);
    expect(lowSampleRows[0]).toHaveTextContent("参考値");
    expect(lowSampleRows[0].className).toContain("opacity-50");
    expect(within(lowSampleRows[0]).queryByText("BTC")).toBeTruthy();

    const normalRows = screen.getAllByTestId("backtest-row");
    expect(normalRows.length).toBe(1);
    expect(within(normalRows[0]).queryByText("ETH")).toBeTruthy();
    expect(normalRows[0]).not.toHaveTextContent("参考値");
  });
});

describe("BacktestPanel worst_forward_return display", () => {
  it("renders worst_forward_return: -0.12 as -12.0%", () => {
    const entry: BacktestEntry = {
      ...normalSampleEntry,
      metrics: { ...baseMetrics, worst_forward_return: -0.12, sample_size: 12 },
    };
    wrap(<BacktestPanel entries={[entry]} />);
    expect(screen.getByTestId("backtest-row")).toHaveTextContent("-12.0%");
  });

  it("renders legacy max_drawdown: -0.12 as -12.0% too", () => {
    const entry: BacktestEntry = {
      ...normalSampleEntry,
      metrics: { ...baseMetrics, max_drawdown: -0.12, sample_size: 12 },
    };
    wrap(<BacktestPanel entries={[entry]} />);
    expect(screen.getByTestId("backtest-row")).toHaveTextContent("-12.0%");
  });
});

describe("BacktestPanel plain-language footnotes", () => {
  it("renders the four explain_* footnotes below the table", () => {
    wrap(<BacktestPanel entries={[normalSampleEntry]} />);
    expect(screen.getByText(ja.turningPoints.backtest.explain_precision)).toBeInTheDocument();
    expect(screen.getByText(ja.turningPoints.backtest.explain_recall)).toBeInTheDocument();
    expect(screen.getByText(ja.turningPoints.backtest.explain_lead)).toBeInTheDocument();
    expect(screen.getByText(ja.turningPoints.backtest.explain_worst)).toBeInTheDocument();
  });

  it("uses the plain-language col_worst header for the worst-forward-return column", () => {
    wrap(<BacktestPanel entries={[normalSampleEntry]} />);
    expect(screen.getByText(ja.turningPoints.backtest.col_worst)).toBeInTheDocument();
  });
});

describe("BacktestProvenanceBanner", () => {
  const provenance: DataProvenance = {
    source: "binance_public_bulk_metrics+fapi_funding",
    start: "2021-12-01",
    end: "2026-10-01",
    coverage_pct: 99.4,
  };

  it("shows the real-provenance banner with source/start/end when provenance is present", () => {
    wrap(<BacktestProvenanceBanner provenance={provenance} />);
    const banner = screen.getByTestId("backtest-provenance");
    expect(banner).toHaveTextContent("2021-12-01");
    expect(banner).toHaveAttribute("role", "note");
    expect(screen.queryByTestId("backtest-provisional")).toBeNull();
  });

  it("shows the provisional banner when provenance is null", () => {
    wrap(<BacktestProvenanceBanner provenance={null} />);
    expect(screen.getByTestId("backtest-provisional")).toBeInTheDocument();
    expect(screen.queryByTestId("backtest-provenance")).toBeNull();
  });
});
