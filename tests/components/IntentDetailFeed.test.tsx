/* @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { IntentDetailFeed } from "@/components/terminal/IntentDetailFeed";
import type { IntentDetailResponse } from "@/lib/intents-reader";
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
    title: "ADA accumulation",
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
      summary_en: "Summary sufficiently long.",
      summary_ja: "十分長い要約の日本語サンプル。",
    },
    visibility: "public",
    authored_via: "claude_code_dialogue",
    ...overrides,
  } as TradeIntent;
}

function okResponse(): IntentDetailResponse {
  return {
    intent: baseIntent(),
    status: "ok",
    source_signals: [],
    source_signals_missing: [],
    meta: { found: true, source_freshness_sec: 0 },
  };
}

function notFoundResponse(): IntentDetailResponse {
  return {
    intent: null,
    status: "not_found",
    source_signals: [],
    source_signals_missing: [],
    meta: { found: false, source_freshness_sec: 0 },
  };
}

function renderFeed(initial: IntentDetailResponse, id = "int_0000000000000001") {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages as any}>
      <IntentDetailFeed id={id} locale="en" initialData={initial} />
    </NextIntlClientProvider>,
  );
}

describe("IntentDetailFeed", () => {
  it("IDF-1: renders disclaimer + expanded card when status=ok", () => {
    renderFeed(okResponse());
    expect(screen.getByRole("note").textContent).toContain(
      "LiveMakers Terminal",
    );
    expect(
      screen.getByText("ADA accumulation — Epoch 622"),
    ).toBeDefined();
  });

  it("IDF-2: renders not-found UI when status=not_found", () => {
    renderFeed(notFoundResponse(), "int_ghost");
    expect(screen.getByText(/TradeIntent not found/)).toBeDefined();
  });

  it("IDF-3: renders ConvictionGrid numeric values", () => {
    renderFeed(okResponse());
    expect(screen.getByText("0.72")).toBeDefined();
    expect(screen.getByText("0.45")).toBeDefined();
  });

  it("IDF-4: archived status triggers the status banner", () => {
    const resp = okResponse();
    resp.intent = { ...resp.intent!, status: "archived" };
    renderFeed(resp);
    expect(
      screen.getByText(/This TradeIntent has been archived/),
    ).toBeDefined();
  });
});
