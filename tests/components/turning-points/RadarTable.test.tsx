/* @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import React from "react";

// next-intl's createNavigation imports `next/navigation` without an `.js`
// extension, which Vitest's ESM resolver rejects under Next 16. Mock the
// locale-aware Link with a plain anchor so the test focuses on RadarTable
// behavior rather than next-intl plumbing.
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
import en from "@/messages/en.json";
import { RadarTable } from "@/components/turning-points/RadarTable";
import type { RadarAsset } from "@/lib/pivots/types";

function withIntl(node: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      {node}
    </NextIntlClientProvider>
  );
}

const sampleAssets: RadarAsset[] = [
  {
    symbol: "BTC",
    scores: {
      "7D": {
        overall: 74,
        price_pivot: 61,
        volatility_pivot: 82,
        confidence_grade: "B+",
        main_signal: "volatility",
      },
      "30D": {
        overall: 78,
        price_pivot: 64,
        volatility_pivot: 83,
        confidence_grade: "B+",
        main_signal: "volatility",
      },
      "90D": {
        overall: 71,
        price_pivot: 59,
        volatility_pivot: 68,
        confidence_grade: "B",
        main_signal: "price",
      },
    },
  },
];

describe("RadarTable", () => {
  it("renders one row per asset with three horizon score cells", () => {
    render(withIntl(<RadarTable assets={sampleAssets} />));
    const row = screen.getByTestId("radar-row-BTC");
    const cells = within(row).getAllByTestId("score-value");
    expect(cells.length).toBe(3);
    expect(cells[0]).toHaveTextContent("74");
    expect(cells[1]).toHaveTextContent("78");
    expect(cells[2]).toHaveTextContent("71");
  });

  it("links the asset symbol to /turning-points/<asset>", () => {
    render(withIntl(<RadarTable assets={sampleAssets} />));
    const link = screen.getByRole("link", { name: "BTC" });
    expect(link).toHaveAttribute("href", "/turning-points/btc");
  });

  it("renders empty-state when assets list is empty", () => {
    render(withIntl(<RadarTable assets={[]} />));
    expect(screen.getByTestId("radar-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("radar-table")).toBeNull();
  });

  it("surfaces dominant horizon's state label + driver and confidence", () => {
    render(withIntl(<RadarTable assets={sampleAssets} previous={null} />));
    const row = screen.getByTestId("radar-row-BTC");
    // 30D has the highest overall (78) → level High ("Conditions aligning")
    // with main_signal=volatility ("Vol") should appear in the state cell,
    // and confidence_grade=B+ should appear in the confidence cell.
    const stateCell = within(row).getByTestId("radar-state-BTC");
    expect(stateCell).toHaveTextContent("Conditions aligning");
    expect(stateCell).toHaveTextContent("Vol");
    expect(row.textContent ?? "").toMatch(/B\+/);
  });
});

describe("RadarTable (確率の列)", () => {
  const forecast = {
    BTC: [
      { event: "turn", horizon: "30D", today_pct: 50.9, usual_pct: 48.3, prev_today_pct: 48.9 },
      { event: "turn", horizon: "90D", today_pct: 19.3, usual_pct: 15.0 },
      { event: "turn", horizon: "7D", today_pct: 44.6, usual_pct: 47.3 },
      { event: "move", horizon: "30D", today_pct: 77.2, usual_pct: 70.8, prev_today_pct: 80.6 },
    ],
  } as const;

  it("forecast を渡すと 4 つの問いの列に切り替わる", () => {
    render(withIntl(<RadarTable assets={sampleAssets} forecast={forecast as never} />));
    const row = screen.getByTestId("radar-row-BTC");
    expect(within(row).queryAllByTestId("score-value").length).toBe(0);
    expect(within(row).queryByTestId("radar-state-BTC")).toBeNull();
    const cell = screen.getByTestId("radar-forecast-BTC-turn30");
    expect(cell).toHaveTextContent("50.9%");
    expect(cell).toHaveTextContent("Usual 48.3%");
    expect(cell).toHaveTextContent("vs. yesterday +2.0");
    expect(screen.getByTestId("radar-forecast-BTC-turn90")).not.toHaveTextContent("yesterday");
    expect(screen.getByTestId("radar-forecast-BTC-move30")).toHaveTextContent("−3.4");
    const heads = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(heads).toEqual(["Asset", "Top/bottom · 30d", "Top/bottom · 90d", "Small peak/trough · 7d", "Big move · 30d"]);
    expect(screen.getByRole("link", { name: "BTC" })).toHaveAttribute("href", "/turning-points/btc");
  });

  it("forecast を渡さなければ今の列のまま", () => {
    render(withIntl(<RadarTable assets={sampleAssets} />));
    expect(screen.queryByTestId("radar-forecast-BTC-turn30")).toBeNull();
    expect(screen.getByTestId("radar-state-BTC")).toBeInTheDocument();
  });
});
