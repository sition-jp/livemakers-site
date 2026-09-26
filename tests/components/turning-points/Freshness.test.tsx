/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, test } from "vitest";

import enMessages from "@/messages/en.json";

import { Freshness } from "@/components/turning-points/Freshness";

const NOW = new Date("2026-05-05T00:00:00Z");

function renderFreshness(generatedAt: string | null) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages} now={NOW}>
      <Freshness generatedAt={generatedAt} now={NOW} />
    </NextIntlClientProvider>,
  );
}

describe("<Freshness>", () => {
  test("renders fresh badge with localized label, JST timestamp, raw ISO in title, and schedule line", () => {
    const generatedAt = new Date(NOW.getTime() - 6 * 3_600_000).toISOString();
    renderFreshness(generatedAt);
    expect(screen.getByText(/last updated/i)).toBeInTheDocument();
    expect(screen.getByText(/fresh/i)).toBeInTheDocument();
    // generatedAt is 2026-05-04T18:00:00.000Z, i.e. 2026-05-05 03:00 JST (UTC+9).
    expect(screen.getByText("2026-05-05 03:00 JST")).toBeInTheDocument();
    expect(screen.getByTitle(generatedAt)).toBeInTheDocument();
    expect(screen.getByText("Updated every morning at 08:00 JST")).toBeInTheDocument();
  });

  test("renders stale tier when age between 36h and 72h", () => {
    const generatedAt = new Date(NOW.getTime() - 50 * 3_600_000).toISOString();
    renderFreshness(generatedAt);
    expect(screen.getByText(/^stale$/i)).toBeInTheDocument();
  });

  test("renders very_stale tier when age over 72h", () => {
    const generatedAt = new Date(NOW.getTime() - 96 * 3_600_000).toISOString();
    renderFreshness(generatedAt);
    expect(screen.getByText(/very stale/i)).toBeInTheDocument();
  });

  test("renders unknown tier when generatedAt is null", () => {
    renderFreshness(null);
    expect(screen.getByText(/timestamp unavailable/i)).toBeInTheDocument();
  });

  test("uses role=status for accessibility (non-blocking advisory)", () => {
    renderFreshness(new Date().toISOString());
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
