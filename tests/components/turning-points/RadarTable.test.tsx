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

  it("surfaces dominant horizon's main_signal + confidence", () => {
    render(withIntl(<RadarTable assets={sampleAssets} />));
    const row = screen.getByTestId("radar-row-BTC");
    // 30D has the highest overall (78) → its main_signal=volatility &
    // confidence_grade=B+ should appear.
    expect(row.textContent ?? "").toMatch(/B\+/);
  });
});
