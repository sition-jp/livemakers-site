/* @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import jaMessages from "@/messages/ja.json";
import { SignalCard } from "@/components/terminal/SignalCard";
import type { Signal } from "@/lib/signals";

function baseSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: "sig_test",
    trace_id: "trace_test",
    root_trace_id: "trace_test",
    schema_version: "1.1-beta",
    created_at: "2026-04-18T10:00:00Z",
    type: "governance_event",
    subtype: "drep_vote",
    pillar: "governance_and_treasury",
    status: "active",
    idempotency_key: "idem_test",
    confidence: 0.82,
    impact: "high",
    urgency: 0.7,
    time_horizon: "1-2 weeks",
    direction: "positive",
    evidence: [
      {
        source_url: "https://x.com/a/status/1",
        source_type: "x_home_timeline",
        timestamp: "2026-04-18T09:00:00Z",
        snippet: "example",
        weight: 0.8,
      },
    ],
    similar_cases: [],
    related_assets: ["ADA"],
    related_protocols: [],
    primary_asset: "ADA",
    tradable: false,
    headline_en: "POSITIVE · Governance [ADA] · drep vote — proposal updates",
    headline_ja: "Cardano DRep 投票進行中：予算提案の可決見込み",
    summary_en: "Governance signal on ADA. EN translation pending.",
    summary_ja: "DRep 投票が進行中。過半数が賛成に傾いている。",
    source_ids: ["mid_test"],
    ...overrides,
  } as Signal;
}

function renderCard(props: {
  signal: Signal;
  locale: "en" | "ja";
  bucket: "actionable" | "active" | "resolved";
  compact?: boolean;
}) {
  const messages = props.locale === "ja" ? jaMessages : enMessages;
  return render(
    <NextIntlClientProvider locale={props.locale} messages={messages as any}>
      <SignalCard {...props} />
    </NextIntlClientProvider>
  );
}

describe("SignalCard", () => {
  it("UI-1: renders headline, pillar badge, confidence on a minimal active signal", () => {
    renderCard({ signal: baseSignal(), locale: "en", bucket: "active" });
    expect(
      screen.getByText(/POSITIVE · Governance/)
    ).toBeInTheDocument();
    // Pillar badge renders the uppercase pillar label (distinct from the
    // headline which uses title-case "Governance")
    expect(
      screen.getByText((_, el) => el?.textContent === "GOVERNANCE")
    ).toBeInTheDocument();
    // 82% confidence rounds to 82%
    expect(screen.getByText(/82%/)).toBeInTheDocument();
  });

  it("UI-2: locale=ja renders headline_ja and summary_ja, no pending banner", () => {
    renderCard({ signal: baseSignal(), locale: "ja", bucket: "active" });
    expect(
      screen.getByText("Cardano DRep 投票進行中：予算提案の可決見込み")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/DRep 投票が進行中/)
    ).toBeInTheDocument();
    // Should NOT show translation-pending aside
    expect(
      screen.queryByText(/translation pending/i)
    ).not.toBeInTheDocument();
  });

  it("UI-3: locale=en with 'EN translation pending.' marker — strips marker from body, shows footer aside", () => {
    renderCard({
      signal: baseSignal({
        summary_en:
          "Governance signal on ADA. Evidence: 2 sources. EN translation pending.",
      }),
      locale: "en",
      bucket: "active",
    });
    // The body summary should have the marker stripped out
    const summary = screen.getByTestId("signal-summary");
    expect(summary.textContent).not.toMatch(/EN translation pending\./);
    // Footer aside should be present
    expect(
      screen.getByText(/Phase 2/i)
    ).toBeInTheDocument();
  });

  it("UI-4: bucket=actionable — applies amber left border and shows alarm icon", () => {
    const { container } = renderCard({
      signal: baseSignal({ confidence: 0.9, impact: "critical" }),
      locale: "en",
      bucket: "actionable",
    });
    const article = container.querySelector("article");
    expect(article).not.toBeNull();
    expect(article!.className).toMatch(/amber/);
    // Alarm icon is data-testid-identified for stability
    expect(screen.getByTestId("actionable-icon")).toBeInTheDocument();
  });

  it("UI-5: bucket=resolved — dims via opacity and shows status badge", () => {
    const { container } = renderCard({
      signal: baseSignal({ status: "expired" }),
      locale: "en",
      bucket: "resolved",
    });
    const article = container.querySelector("article");
    expect(article).not.toBeNull();
    // Resolved bucket has lower opacity per spec §3.4
    expect(article!.className).toMatch(/opacity-75|opacity\[0\.75\]/);
    // Status badge surfaces the i18n-localized label
    expect(screen.getByTestId("resolved-status-badge").textContent).toMatch(
      /expired/i
    );
  });

  it("UI-6: position_hint absent — conviction line is not rendered", () => {
    renderCard({
      signal: baseSignal({ position_hint: undefined }),
      locale: "en",
      bucket: "active",
    });
    expect(screen.queryByText(/conviction/i)).not.toBeInTheDocument();
  });

  it("UI-6b: position_hint present — conviction line renders with value", () => {
    renderCard({
      signal: baseSignal({
        position_hint: { stance: "accumulate", conviction: 0.75 },
      }),
      locale: "en",
      bucket: "active",
    });
    expect(screen.getByText(/accumulate/i)).toBeInTheDocument();
    expect(screen.getByText(/0\.75/)).toBeInTheDocument();
  });

  it("UI-7: compact=true — summary and chips are hidden", () => {
    renderCard({
      signal: baseSignal(),
      locale: "en",
      bucket: "active",
      compact: true,
    });
    expect(screen.queryByTestId("signal-summary")).not.toBeInTheDocument();
    expect(screen.queryByTestId("signal-chips")).not.toBeInTheDocument();
  });

  it("UI-8: primary_asset=NIGHT — asset badge renders", () => {
    renderCard({
      signal: baseSignal({ primary_asset: "NIGHT", related_assets: ["NIGHT"] }),
      locale: "en",
      bucket: "active",
    });
    expect(screen.getByTestId("signal-asset-badge").textContent).toMatch(
      /NIGHT/
    );
  });

  it("UI-9: evidence count is shown — uses i18n plural form", () => {
    renderCard({
      signal: baseSignal({
        evidence: [
          {
            source_url: "https://x.com/a/1",
            source_type: "x",
            timestamp: "2026-04-18T00:00:00Z",
            snippet: "a",
            weight: 0.5,
          },
          {
            source_url: "https://x.com/b/2",
            source_type: "x",
            timestamp: "2026-04-18T00:00:00Z",
            snippet: "b",
            weight: 0.5,
          },
        ],
      }),
      locale: "en",
      bucket: "active",
    });
    expect(screen.getByText(/2 sources/i)).toBeInTheDocument();
  });
});
