/* @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { SignalFieldGrid } from "@/components/terminal/SignalFieldGrid";
import type { Signal } from "@/lib/signals";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

function makeFullSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: "sig_grid_test",
    event_key: "evt",
    root_trace_id: "root_x",
    supersedes_signal_id: null,
    status: "active",
    confidence: 0.8,
    pillar: "governance",
    direction: "positive",
    primary_asset: "ADA",
    related_assets: ["NIGHT"],
    topics: ["cardano", "drep"],
    headline_en: "H_en",
    headline_ja: "H_ja",
    summary_en: "S_en",
    summary_ja: "S_ja",
    created_at: "2026-04-19T09:00:00+00:00",
    updated_at: "2026-04-19T09:30:00+00:00",
    evidence: [{ source_type: "news", title: "T1" }],
    ...overrides,
  } as unknown as Signal;
}

describe("SignalFieldGrid (spec §5.6.1)", () => {
  it("is collapsed by default (grid rows not shown)", () => {
    wrap(<SignalFieldGrid signal={makeFullSignal()} locale="en" />);
    expect(screen.queryByText(/Signal ID/)).not.toBeInTheDocument();
  });

  it("renders grid rows when defaultOpen=true", () => {
    wrap(<SignalFieldGrid signal={makeFullSignal()} locale="en" defaultOpen={true} />);
    expect(screen.getByText(/Signal ID/)).toBeInTheDocument();
    expect(screen.getByText("sig_grid_test")).toBeInTheDocument();
  });

  it("toggles open/closed when summary clicked", () => {
    wrap(<SignalFieldGrid signal={makeFullSignal()} locale="en" />);
    // Click the toggle button
    fireEvent.click(screen.getByText(/Show all fields/));
    expect(screen.getByText(/Signal ID/)).toBeInTheDocument();
  });

  it("renders all 7 section headings when open", () => {
    wrap(<SignalFieldGrid signal={makeFullSignal()} locale="en" defaultOpen={true} />);
    expect(screen.getByText("Identity")).toBeInTheDocument();
    expect(screen.getByText("Status & Timing")).toBeInTheDocument();
    expect(screen.getByText("Classification")).toBeInTheDocument();
    expect(screen.getByText("Assets & Topics")).toBeInTheDocument();
    expect(screen.getByText("Translation state")).toBeInTheDocument();
    expect(screen.getByText("Audit & Lock")).toBeInTheDocument();
    expect(screen.getByText("Evidence (full list)")).toBeInTheDocument();
  });

  it("handles null root_trace_id / supersedes_signal_id without crashing", () => {
    const legacy = makeFullSignal({ root_trace_id: null, supersedes_signal_id: null } as unknown as Partial<Signal>);
    wrap(<SignalFieldGrid signal={legacy} locale="en" defaultOpen={true} />);
    expect(screen.getAllByText(/—|null/).length).toBeGreaterThan(0);
  });
});
