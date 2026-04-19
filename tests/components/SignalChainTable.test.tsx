/* @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { SignalChainTable } from "@/components/terminal/SignalChainTable";
import type { Signal } from "@/lib/signals";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

function mkSig(id: string, time: string, status: Signal["status"], conf: number): Signal {
  return {
    id,
    event_key: "e",
    root_trace_id: "r",
    status,
    confidence: conf,
    pillar: "x",
    direction: "positive",
    created_at: time,
    updated_at: time,
    headline_en: `H-${id}`,
    headline_ja: `H-${id}`,
    summary_en: "",
    summary_ja: "",
  } as unknown as Signal;
}

describe("SignalChainTable (spec §5.7)", () => {
  const chainAsc: Signal[] = [
    mkSig("a", "2026-04-19T10:00:00+00:00", "superseded", 0.6),
    mkSig("b", "2026-04-19T11:00:00+00:00", "superseded", 0.75),
    mkSig("c", "2026-04-19T12:00:00+00:00", "active", 0.9),
  ];

  it("renders 3 rows for a 3-entry chain", () => {
    const { container } = wrap(<SignalChainTable chain={chainAsc} currentId="c" locale="en" />);
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();
    // "c" is the current row — rendered with ⭐ marker, not a bare text node.
    const currentRow = container.querySelector('[data-current="true"]');
    expect(currentRow?.textContent).toContain("c");
  });

  it("renders rows newest-first (desktop reverse-chronological)", () => {
    wrap(<SignalChainTable chain={chainAsc} currentId="c" locale="en" />);
    const rows = screen.getAllByRole("row");
    // First data row (after header row) should be the NEWEST (c)
    const firstDataRow = rows[1]; // row 0 is <thead>
    expect(firstDataRow.textContent).toContain("c");
  });

  it("marks the current row and does NOT link it", () => {
    const { container } = wrap(<SignalChainTable chain={chainAsc} currentId="c" locale="en" />);
    const currentRowId = container.querySelector('[data-current="true"]');
    expect(currentRowId?.textContent).toContain("c");
    // The current row should not contain an anchor element
    expect(currentRowId?.querySelector("a")).toBeNull();
  });

  it("renders other rows as <a> links to /signals/<id>", () => {
    wrap(<SignalChainTable chain={chainAsc} currentId="c" locale="en" />);
    const linkA = screen.getByRole("link", { name: /a/ });
    const linkB = screen.getByRole("link", { name: /b/ });
    expect(linkA.getAttribute("href")).toContain("/signals/a");
    expect(linkB.getAttribute("href")).toContain("/signals/b");
  });

  it("renders table headers from i18n", () => {
    wrap(<SignalChainTable chain={chainAsc} currentId="c" locale="en" />);
    expect(screen.getByText("Time")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Conf")).toBeInTheDocument();
    expect(screen.getByText("ID")).toBeInTheDocument();
  });

  it("renders confidence as percentage", () => {
    wrap(<SignalChainTable chain={chainAsc} currentId="c" locale="en" />);
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
  });
});
