/* @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TickerBar } from "@/components/terminal/TickerBar";
import {
  marketLanesFixture,
  marketTickerFixture,
} from "@/lib/terminal/market-lanes";

describe("TickerBar (G39-A2 market lanes)", () => {
  it("renders the lane fixture items with an explicit FIXTURE marker", () => {
    const { container } = render(<TickerBar />);

    expect(screen.getByText("Fixture")).toBeInTheDocument();
    expect(screen.getByText("BTC")).toBeInTheDocument();
    expect(screen.getByText("DXY")).toBeInTheDocument();
    expect(screen.getByText("RWA")).toBeInTheDocument();
    // The retired Cardano network strip must not come back
    expect(screen.queryByText("EPOCH")).toBeNull();
    expect(screen.queryByText("NAKA")).toBeNull();
    // Ticker is informational — never a link
    expect(container.querySelector("a")).toBeNull();
  });
});

describe("market lanes fixture (doctrine §4 ledger)", () => {
  it("keeps the lane order macro → crypto → rwa", () => {
    expect(marketLanesFixture.map((lane) => lane.key)).toEqual([
      "macro",
      "crypto",
      "rwa",
    ]);
  });

  it("keeps Cardano as a crypto lane member, not a standalone lane", () => {
    const laneKeys = marketLanesFixture.map((lane) => lane.key);
    expect(laneKeys).not.toContain("cardano");
    const crypto = marketLanesFixture.find((lane) => lane.key === "crypto");
    expect(crypto?.tiles.some((tile) => tile.id === "crypto.ada")).toBe(true);
  });

  it("provides only string-or-null values (unavailable ≠ 0)", () => {
    for (const lane of marketLanesFixture) {
      for (const tile of lane.tiles) {
        expect(tile.value === null || typeof tile.value === "string").toBe(
          true,
        );
        expect(tile.value).not.toBe("0");
      }
    }
    for (const item of marketTickerFixture) {
      expect(typeof item.value).toBe("string");
    }
  });
});
