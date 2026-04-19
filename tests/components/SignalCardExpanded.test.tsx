/* @vitest-environment jsdom */
/** Tests for components/terminal/SignalCardExpanded.tsx — spec §5.6 v0.3. */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import jaMessages from "@/messages/ja.json";
import { SignalCardExpanded } from "@/components/terminal/SignalCardExpanded";
import type { Signal } from "@/lib/signals";

function renderWith(locale: "en" | "ja", ui: React.ReactNode) {
  const messages = locale === "en" ? enMessages : jaMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

function fullSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: "sig_detail_test",
    event_key: "evt_test",
    status: "active",
    confidence: 0.82,
    pillar: "governance",
    direction: "positive",
    impact: "high",
    time_horizon: "short_term",
    urgency: "medium",
    type: "announcement",
    primary_asset: "ADA",
    headline_en: "Cardano DRep vote passes committee",
    headline_ja: "Cardano DRep 投票が委員会を通過",
    summary_en: "Full summary text that would be clamped to 3 lines in a normal Card but here renders in full.",
    summary_ja: "通常の Card では 3 行で clamp される全文がここでは省略なしで表示されます。",
    created_at: "2026-04-19T09:00:00+00:00",
    updated_at: "2026-04-19T09:00:00+00:00",
    evidence: [
      { source_type: "x_post", title: "Source 1", url: "https://x.com/1" },
      { source_type: "news", title: "Source 2", url: "https://news.example/2" },
      { source_type: "blog", title: "Source 3", url: "https://blog.example/3" },
      { source_type: "blog", title: "Source 4 (not shown in expanded)", url: "https://blog.example/4" },
    ],
    ...overrides,
  } as Signal;
}

describe("SignalCardExpanded (spec §5.6)", () => {
  it("renders headline in the selected locale", () => {
    renderWith("en", <SignalCardExpanded signal={fullSignal()} locale="en" />);
    expect(screen.getByText(/Cardano DRep vote passes committee/)).toBeInTheDocument();
  });

  it("renders full summary (no clamp)", () => {
    renderWith("en", <SignalCardExpanded signal={fullSignal()} locale="en" />);
    expect(screen.getByText(/Full summary text that would be clamped/)).toBeInTheDocument();
  });

  it("renders top 3 evidence items by default, hints at more via FieldGrid", () => {
    renderWith("en", <SignalCardExpanded signal={fullSignal()} locale="en" />);
    // Top 3 shown
    expect(screen.getByText(/Source 1/)).toBeInTheDocument();
    expect(screen.getByText(/Source 2/)).toBeInTheDocument();
    expect(screen.getByText(/Source 3/)).toBeInTheDocument();
    // 4th NOT in the expanded card (lives in FieldGrid)
    expect(screen.queryByText(/Source 4/)).not.toBeInTheDocument();
  });

  it("shows position_hint + conviction when present", () => {
    const sig = fullSignal({
      position_hint: "accumulate",
      conviction: 0.7,
    } as Partial<Signal>);
    renderWith("en", <SignalCardExpanded signal={sig} locale="en" />);
    expect(screen.getByText(/accumulate/)).toBeInTheDocument();
  });

  it("omits position row when position_hint absent", () => {
    const sig = fullSignal({ position_hint: undefined } as Partial<Signal>);
    renderWith("en", <SignalCardExpanded signal={sig} locale="en" />);
    expect(screen.queryByText(/accumulate/)).not.toBeInTheDocument();
  });

  it("renders JA locale headline when locale='ja'", () => {
    renderWith("ja", <SignalCardExpanded signal={fullSignal()} locale="ja" />);
    expect(screen.getByText(/Cardano DRep 投票が委員会を通過/)).toBeInTheDocument();
  });
});
