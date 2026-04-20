/* @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { SignalDetailFeed } from "@/components/terminal/SignalDetailFeed";
import type { SignalDetailResponse } from "@/lib/signals-reader";

function baseResponse(
  overrides: Partial<SignalDetailResponse> = {},
): SignalDetailResponse {
  // Use minimal shape consistent with current SignalDetailResponse.
  // referencing_intent_ids is the new optional-looking field we are testing.
  return {
    signal: {
      id: "sig_001",
      trace_id: "trace_sig_001",
      root_trace_id: "trace_sig_001",
      schema_version: "1.1-beta",
      created_at: "2026-04-18T10:00:00Z",
      updated_at: "2026-04-18T10:00:00Z",
      type: "governance_event",
      subtype: "drep_vote",
      pillar: "governance_and_treasury",
      status: "active",
      idempotency_key: "idem_sig_001",
      confidence: 0.82,
      impact: "high",
      urgency: 0.7,
      time_horizon: "1-2 weeks",
      direction: "positive",
      evidence: [],
      similar_cases: [],
      related_assets: ["ADA"],
      related_protocols: [],
      primary_asset: "ADA",
      tradable: false,
      headline_en: "Signal hl",
      headline_ja: "シグナル見出し",
      summary_en: "Signal summary.",
      summary_ja: "シグナル要約。",
      source_ids: [],
    },
    chain: [],
    chain_status: "singleton_fallback",
    chain_integrity_warnings: [],
    meta: {
      found: true,
      source_freshness_sec: 0,
      chain_length: 1,
      root_trace_id: "trace_sig_001",
    },
    referencing_intent_ids: [],
    ...overrides,
  } as SignalDetailResponse;
}

describe("SignalDetailFeed — referencing_intent_ids backlink UI", () => {
  it("BK-UI-1: does NOT render the backlink section when list is empty", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages as any}>
        <SignalDetailFeed
          id="sig_001"
          locale="en"
          initialData={baseResponse({ referencing_intent_ids: [] })}
        />
      </NextIntlClientProvider>,
    );
    expect(
      screen.queryByText(/Referenced by TradeIntents/),
    ).toBeNull();
  });

  it("BK-UI-2: renders backlink links when one or more Intent references the Signal", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages as any}>
        <SignalDetailFeed
          id="sig_001"
          locale="en"
          initialData={baseResponse({
            referencing_intent_ids: [
              "int_0000000000000001",
              "int_0000000000000002",
            ],
          })}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/Referenced by TradeIntents/)).toBeDefined();
    const link1 = screen.getByRole("link", {
      name: /int_0000000000000001/,
    });
    expect(link1.getAttribute("href")).toBe(
      "/en/intents/int_0000000000000001",
    );
  });
});
