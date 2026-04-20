/* @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { IntentFeed } from "@/components/terminal/IntentFeed";
import type { IntentListResponse } from "@/lib/intents-reader";

function stubList(): IntentListResponse {
  return {
    intents: [
      {
        intent_id: "int_0000000000000001",
        trace_id: "00000000-0000-4000-8000-000000000001",
        schema_version: "0.1-alpha",
        status: "approved",
        side: "accumulate",
        target_assets: ["ADA"],
        preferred_horizon: "swing",
        priority: 0.5,
        thesis_conviction: 0.7,
        execution_confidence: 0.5,
        created_at: "2026-04-20T09:00:00Z",
        updated_at: "2026-04-20T09:00:00Z",
        display: {
          headline_en: "First intent",
          headline_ja: "第一の意図",
          summary_en: "Summary of the first intent sufficiently long.",
          summary_ja: "十分長い最初の意図の要約。",
        },
        source_signal_ids: ["sig_001"],
      },
    ],
    meta: { count: 1, source_freshness_sec: 0 },
  };
}

describe("IntentFeed", () => {
  it("IF-1: renders IntentCard list from initialData without network", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages as any}>
        <IntentFeed locale="en" initialData={stubList()} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("First intent")).toBeDefined();
  });

  it("IF-2: renders empty state when initialData has zero intents", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages as any}>
        <IntentFeed
          locale="en"
          initialData={{ intents: [], meta: { count: 0, source_freshness_sec: -1 } }}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/No TradeIntents published yet/)).toBeDefined();
  });

  it("IF-3: renders IntentDisclaimer above the list", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages as any}>
        <IntentFeed locale="en" initialData={stubList()} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("note").textContent).toContain(
      "LiveMakers Terminal",
    );
  });
});
