/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WindowProvenanceRow } from "@/components/home/WindowProvenanceRow";

describe("WindowProvenanceRow", () => {
  it("renders all provenance labels and values verbatim", () => {
    const { container } = render(
      <WindowProvenanceRow
        provenance={{
          packetId: "sess_20260710_asia",
          sourceMode: "fixture_only",
          reviewStatus: "reviewed_fixture",
          asOfJst: "05:03 JST",
        }}
        labels={{
          review: "審査状態",
          source: "ソース",
          asOf: "as-of",
          packet: "パケットID",
        }}
      />,
    );
    expect(screen.getByText("審査状態:")).toBeInTheDocument();
    expect(screen.getByText("reviewed_fixture")).toBeInTheDocument();
    expect(screen.getByText("fixture_only")).toBeInTheDocument();
    expect(screen.getByText("パケットID:")).toBeInTheDocument();
    expect(screen.getByText("sess_20260710_asia")).toBeInTheDocument();
    expect(container.firstElementChild?.getAttribute("data-packet-id")).toBe(
      "sess_20260710_asia",
    );
  });
});
