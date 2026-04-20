/* @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import jaMessages from "@/messages/ja.json";
import { IntentCardExpanded } from "@/components/terminal/IntentCardExpanded";
import type { TradeIntent } from "@/lib/intents";

function baseIntent(overrides: Partial<TradeIntent> = {}): TradeIntent {
  return {
    intent_id: "int_0000000000000001",
    trace_id: "00000000-0000-4000-8000-000000000001",
    schema_version: "0.1-alpha",
    created_at: "2026-04-20T09:30:00Z",
    updated_at: "2026-04-20T09:30:00Z",
    status: "approved",
    source_signal_ids: ["sig_001"],
    title: "ADA accumulation — epoch 622",
    description: "Accumulate ADA during epoch 622 bonus window.",
    side: "accumulate",
    target_assets: ["ADA"],
    thesis:
      "Cardano epoch 622 transition coincides with Treasury Fit endorsement.",
    why_now: "Bonus window opens for 5 days starting epoch 622 boundary.",
    invalidation_thesis: "Cancel if BTC weekly close < $55k.",
    thesis_conviction: 0.72,
    execution_confidence: 0.45,
    priority: 0.6,
    preferred_horizon: "swing",
    portfolio_context: { bucket: "tactical" },
    human_review: {
      required: true,
      approved_by: "LiveMakers Terminal",
      approved_at: "2026-04-20T09:30:00Z",
    },
    display: {
      headline_en: "ADA accumulation — Epoch 622",
      headline_ja: "ADA 段階買い — エポック 622",
      summary_en: "Stakers receive bonus for 5 days; size conservative.",
      summary_ja:
        "ステーキング報酬ボーナスが 5 日間開放。ポジションは保守的に。",
    },
    visibility: "public",
    authored_via: "claude_code_dialogue",
    ...overrides,
  } as TradeIntent;
}

function renderExpanded(locale: "en" | "ja", intent = baseIntent()) {
  const messages = locale === "ja" ? jaMessages : enMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages as any}>
      <IntentCardExpanded intent={intent} locale={locale} />
    </NextIntlClientProvider>,
  );
}

describe("IntentCardExpanded", () => {
  it("CE-1: renders EN headline + summary + thesis", () => {
    renderExpanded("en");
    expect(
      screen.getByText("ADA accumulation — Epoch 622"),
    ).toBeDefined();
    expect(screen.getByText(/Stakers receive bonus/)).toBeDefined();
    expect(screen.getByText(/Treasury Fit endorsement/)).toBeDefined();
  });

  it("CE-2: renders 3 section headings (Thesis / Why now / Invalidation)", () => {
    renderExpanded("en");
    expect(screen.getByText("Thesis")).toBeDefined();
    expect(screen.getByText("Why now")).toBeDefined();
    expect(screen.getByText("Invalidation condition")).toBeDefined();
  });

  it("CE-3: JA section headings", () => {
    renderExpanded("ja");
    expect(screen.getByText("仮説")).toBeDefined();
    expect(screen.getByText("なぜ今か")).toBeDefined();
    expect(screen.getByText("無効化条件")).toBeDefined();
  });

  it("CE-4: renders target_assets", () => {
    renderExpanded("en");
    expect(screen.getByText("ADA")).toBeDefined();
  });

  it("CE-5: renders why_now body text", () => {
    renderExpanded("en");
    expect(screen.getByText(/Bonus window opens/)).toBeDefined();
  });

  it("CE-6: renders invalidation_thesis body", () => {
    renderExpanded("en");
    expect(
      screen.getByText(/BTC weekly close/),
    ).toBeDefined();
  });
});
