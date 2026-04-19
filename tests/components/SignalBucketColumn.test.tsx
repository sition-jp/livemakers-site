/* @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { SignalBucketColumn } from "@/components/terminal/SignalBucketColumn";
import { SignalsEmptyState } from "@/components/terminal/SignalsEmptyState";
import type { Signal } from "@/lib/signals";

function makeSignal(id: string, overrides: Partial<Signal> = {}): Signal {
  return {
    id,
    trace_id: `trace_${id}`,
    root_trace_id: `trace_${id}`,
    schema_version: "1.1-beta",
    created_at: "2026-04-18T10:00:00Z",
    type: "market_event",
    subtype: "price_movement",
    pillar: "market_and_capital_flows",
    status: "active",
    idempotency_key: `idem_${id}`,
    confidence: 0.75,
    impact: "medium",
    urgency: 0.5,
    time_horizon: "days",
    direction: "neutral",
    evidence: [],
    similar_cases: [],
    related_assets: [],
    related_protocols: [],
    tradable: false,
    headline_en: `Headline ${id}`,
    headline_ja: `見出し ${id}`,
    summary_en: "",
    summary_ja: "",
    source_ids: [],
    ...overrides,
  } as Signal;
}

function wrap(children: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages as any}>
      {children}
    </NextIntlClientProvider>
  );
}

describe("SignalBucketColumn", () => {
  it("renders the bucket header with count and all signal cards", () => {
    render(
      wrap(
        <SignalBucketColumn
          bucket="active"
          locale="en"
          signals={[makeSignal("a"), makeSignal("b")]}
        />
      )
    );
    expect(screen.getByTestId("signal-bucket-active")).toBeInTheDocument();
    expect(screen.getByText("(2)")).toBeInTheDocument();
    expect(screen.getByText("Headline a")).toBeInTheDocument();
    expect(screen.getByText("Headline b")).toBeInTheDocument();
    // Empty state should NOT be shown when list has items
    expect(screen.queryByTestId("signals-empty-active")).not.toBeInTheDocument();
  });

  it("renders bucket-specific empty state when signals is []", () => {
    render(
      wrap(
        <SignalBucketColumn bucket="resolved" locale="en" signals={[]} />
      )
    );
    expect(screen.getByTestId("signals-empty-resolved")).toBeInTheDocument();
    expect(screen.getByText("(0)")).toBeInTheDocument();
  });
});

describe("SignalsEmptyState", () => {
  it("renders the i18n-resolved message for 'all' bucket (pre-launch case)", () => {
    render(wrap(<SignalsEmptyState bucket="all" />));
    expect(screen.getByTestId("signals-empty-all")).toBeInTheDocument();
    expect(screen.getByText(/SITION Discovery Engine/)).toBeInTheDocument();
  });

  it("renders the actionable-specific message", () => {
    render(wrap(<SignalsEmptyState bucket="actionable" />));
    expect(screen.getByText(/No actionable signals/i)).toBeInTheDocument();
  });
});
