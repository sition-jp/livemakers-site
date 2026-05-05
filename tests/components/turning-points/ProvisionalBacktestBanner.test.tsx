/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, test } from "vitest";

import enMessages from "@/messages/en.json";

import { ProvisionalBacktestBanner } from "@/components/turning-points/ProvisionalBacktestBanner";

describe("<ProvisionalBacktestBanner>", () => {
  test("renders title and body with localized copy", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ProvisionalBacktestBanner />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/provisional v0\.1 backtest metrics/i)).toBeInTheDocument();
    expect(screen.getByText(/pipeline validation/i)).toBeInTheDocument();
  });

  test("uses role=note semantics for advisory non-blocking copy", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ProvisionalBacktestBanner />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("note")).toBeInTheDocument();
  });
});
