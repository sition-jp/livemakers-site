/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, test } from "vitest";

import enMessages from "@/messages/en.json";

import { BacktestProvenanceBanner } from "@/components/turning-points/BacktestProvenanceBanner";
import type { DataProvenance } from "@/lib/pivots/types";

const provenance: DataProvenance = {
  source: "binance_public_bulk_metrics+fapi_funding",
  start: "2021-12-01",
  end: "2026-10-01",
  coverage_pct: 99.4,
};

describe("<BacktestProvenanceBanner>", () => {
  test("real provenance renders source/start/end/coverage and the provenance testid", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <BacktestProvenanceBanner provenance={provenance} />
      </NextIntlClientProvider>,
    );
    const banner = screen.getByTestId("backtest-provenance");
    expect(banner).toHaveTextContent("binance_public_bulk_metrics+fapi_funding");
    expect(banner).toHaveTextContent("2021-12-01");
    expect(banner).toHaveTextContent("2026-10-01");
    expect(banner).toHaveTextContent("99.4");
    expect(screen.queryByTestId("backtest-provisional")).toBeNull();
  });

  test("null provenance renders the provisional notice and testid", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <BacktestProvenanceBanner provenance={null} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/still a proxy/i)).toBeInTheDocument();
    expect(screen.getByTestId("backtest-provisional")).toBeInTheDocument();
    expect(screen.queryByTestId("backtest-provenance")).toBeNull();
  });

  test("uses role=note semantics for advisory non-blocking copy in both states", () => {
    const { rerender } = render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <BacktestProvenanceBanner provenance={null} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("note")).toBeInTheDocument();

    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <BacktestProvenanceBanner provenance={provenance} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("note")).toBeInTheDocument();
  });
});
