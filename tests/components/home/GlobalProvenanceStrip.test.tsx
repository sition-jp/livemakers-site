/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GlobalProvenanceStrip } from "@/components/home/GlobalProvenanceStrip";

describe("GlobalProvenanceStrip", () => {
  it("renders four fields and keeps chrome and packet attributes on one root", () => {
    const { container } = render(
      <GlobalProvenanceStrip
        provenance={{
          packetId: "lmk_20260710_0758_fx01",
          sourceMode: "fixture_only",
          reviewStatus: "reviewed_fixture",
          asOfJst: "07:58 JST",
        }}
        labels={{
          review: "審査状態",
          source: "ソース",
          asOf: "as-of",
          packet: "パケットID",
        }}
        note="数値は取得時点のスナップショットです"
      />,
    );
    expect(screen.getByText("reviewed_fixture")).toBeInTheDocument();
    expect(screen.getByText("fixture_only")).toBeInTheDocument();
    expect(screen.getByText("lmk_20260710_0758_fx01")).toBeInTheDocument();
    expect(
      screen.getByText("数値は取得時点のスナップショットです"),
    ).toBeInTheDocument();
    const root = container.querySelector('[data-chrome="provenance-strip"]');
    expect(root?.getAttribute("data-packet-id")).toBe(
      "lmk_20260710_0758_fx01",
    );
  });

  it("centers its fields in the shared max-w-[1920px] chrome container", () => {
    // Header / TickerBar / Footer all center their content inside an
    // mx-auto max-w-[1920px] container. The strip must use the same inner
    // container so its left/right edges align with the header on wide
    // viewports instead of spreading edge-to-edge.
    const { container } = render(
      <GlobalProvenanceStrip
        provenance={{
          packetId: "lmk_20260710_0758_fx01",
          sourceMode: "fixture_only",
          reviewStatus: "reviewed_fixture",
          asOfJst: "07:58 JST",
        }}
        labels={{
          review: "審査状態",
          source: "ソース",
          asOf: "as-of",
          packet: "パケットID",
        }}
        note="数値は取得時点のスナップショットです"
      />,
    );
    const root = container.querySelector('[data-chrome="provenance-strip"]');
    const inner = root?.firstElementChild as HTMLElement | null;
    expect(inner?.className).toContain("mx-auto");
    expect(inner?.className).toContain("max-w-[1920px]");
    expect(inner?.contains(screen.getByText("lmk_20260710_0758_fx01"))).toBe(
      true,
    );
  });
});
