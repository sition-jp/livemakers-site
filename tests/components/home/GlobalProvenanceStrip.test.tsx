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
});
