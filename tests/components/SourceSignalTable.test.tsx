/* @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import jaMessages from "@/messages/ja.json";
import { SourceSignalTable } from "@/components/terminal/SourceSignalTable";
import type { Signal } from "@/lib/signals";

function stubSignal(id: string, overrides: Partial<Signal> = {}): Signal {
  return {
    id,
    trace_id: "trace_" + id,
    root_trace_id: "trace_" + id,
    schema_version: "1.1-beta",
    created_at: "2026-04-18T10:00:00Z",
    updated_at: "2026-04-18T10:00:00Z",
    type: "governance_event",
    subtype: "drep_vote",
    pillar: "governance_and_treasury",
    status: "active",
    idempotency_key: "idem_" + id,
    confidence: 0.8,
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
    headline_en: "hl en " + id,
    headline_ja: "hl ja " + id,
    summary_en: "sum en",
    summary_ja: "sum ja",
    source_ids: [],
    ...overrides,
  } as Signal;
}

function renderTable(props: {
  signals: Signal[];
  missing: string[];
  locale: "en" | "ja";
}) {
  const messages = props.locale === "ja" ? jaMessages : enMessages;
  return render(
    <NextIntlClientProvider locale={props.locale} messages={messages as any}>
      <SourceSignalTable
        signals={props.signals}
        missing={props.missing}
        locale={props.locale}
      />
    </NextIntlClientProvider>,
  );
}

describe("SourceSignalTable", () => {
  it("ST-1: renders a table with rows for each signal", () => {
    renderTable({
      signals: [stubSignal("sig_001"), stubSignal("sig_002")],
      missing: [],
      locale: "en",
    });
    const rows = screen.getAllByRole("row");
    // 1 header + 2 body
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  it("ST-2: each signal row is a link to /{locale}/signals/{id}", () => {
    renderTable({
      signals: [stubSignal("sig_001")],
      missing: [],
      locale: "en",
    });
    const link = screen.getByRole("link", { name: /sig_001/ });
    expect(link.getAttribute("href")).toBe("/en/signals/sig_001");
  });

  it("ST-3: renders headline + status + confidence in row", () => {
    renderTable({
      signals: [stubSignal("sig_001", { status: "superseded" })],
      missing: [],
      locale: "en",
    });
    expect(screen.getByText("hl en sig_001")).toBeDefined();
    expect(screen.getByText("superseded")).toBeDefined();
    expect(screen.getByText(/0\.80/)).toBeDefined();
  });

  it("ST-4: empty state renders zero rows gracefully (no throw)", () => {
    renderTable({ signals: [], missing: [], locale: "en" });
    // header row only
    expect(screen.queryAllByRole("row").length).toBe(1);
  });

  it("ST-5: missing source_signal_ids shown in a footer notice", () => {
    renderTable({
      signals: [],
      missing: ["sig_ghost1", "sig_ghost2"],
      locale: "en",
    });
    expect(screen.getByText(/2 referenced signals are missing/)).toBeDefined();
  });
});
