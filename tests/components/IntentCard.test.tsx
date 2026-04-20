/* @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import jaMessages from "@/messages/ja.json";
import { IntentCard } from "@/components/terminal/IntentCard";
import type { TradeIntentSummary } from "@/lib/intents-reader";

function baseSummary(
  overrides: Partial<TradeIntentSummary> = {},
): TradeIntentSummary {
  return {
    intent_id: "int_0000000000000001",
    trace_id: "00000000-0000-4000-8000-000000000001",
    schema_version: "0.1-alpha",
    status: "approved",
    side: "accumulate",
    target_assets: ["ADA"],
    preferred_horizon: "swing",
    priority: 0.6,
    thesis_conviction: 0.72,
    execution_confidence: 0.45,
    created_at: "2026-04-20T09:30:00Z",
    updated_at: "2026-04-20T09:30:00Z",
    display: {
      headline_en: "ADA accumulation — Epoch 622",
      headline_ja: "ADA 段階買い — エポック 622",
      summary_en: "Stakers receive bonus for 5 days; size conservative.",
      summary_ja:
        "ステーキング報酬ボーナスが 5 日間開放。ポジションは保守的に。",
    },
    source_signal_ids: ["sig_001"],
    ...overrides,
  };
}

function renderCard(props: {
  summary: TradeIntentSummary;
  locale: "en" | "ja";
}) {
  const messages = props.locale === "ja" ? jaMessages : enMessages;
  return render(
    <NextIntlClientProvider locale={props.locale} messages={messages as any}>
      <IntentCard summary={props.summary} locale={props.locale} />
    </NextIntlClientProvider>,
  );
}

describe("IntentCard", () => {
  it("IC1-1: renders EN headline when locale=en", () => {
    renderCard({ summary: baseSummary(), locale: "en" });
    expect(
      screen.getByText("ADA accumulation — Epoch 622"),
    ).toBeDefined();
  });

  it("IC1-2: renders JA headline when locale=ja", () => {
    renderCard({ summary: baseSummary(), locale: "ja" });
    expect(screen.getByText("ADA 段階買い — エポック 622")).toBeDefined();
  });

  it("IC1-3: renders a Link with href /{locale}/intents/{id}", () => {
    renderCard({ summary: baseSummary(), locale: "en" });
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe(
      "/en/intents/int_0000000000000001",
    );
  });

  it("IC1-4: shows side badge + target assets", () => {
    renderCard({ summary: baseSummary(), locale: "en" });
    expect(screen.getByText("accumulate")).toBeDefined();
    expect(screen.getByText("ADA")).toBeDefined();
  });

  it("IC1-5: shows source_signal_count with interpolation", () => {
    renderCard({
      summary: baseSummary({ source_signal_ids: ["sig_001", "sig_002"] }),
      locale: "en",
    });
    expect(screen.getByText(/2 source signals/)).toBeDefined();
  });
});
