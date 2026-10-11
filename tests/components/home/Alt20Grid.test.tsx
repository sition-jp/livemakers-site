/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Alt20Grid } from "@/components/home/Alt20Grid";

const alt20 = {
  asOfJst: "2026-10-12T05:03:00+09:00",
  listVersion: "2026-10-11",
  items: [
    { rank: 1, symbol: "BNB", changeLabel: "+0.10%", direction: "up" as const },
    { rank: 2, symbol: "XRP", changeLabel: "-0.20%", direction: "down" as const },
  ],
  summary: { count: 2, up: 1, down: 1, flat: 0, medianChangeLabel: "-0.05%" },
};
const copy = {
  summary: (s: typeof alt20.summary) => `${s.count}銘柄中 ${s.up}上昇・中央値 ${s.medianChangeLabel}`,
  unavailable: "—",
};

describe("Alt20Grid", () => {
  it("renders one tile per item in order with direction colours", () => {
    render(<Alt20Grid alt20={alt20} copy={copy} />);
    const tiles = screen.getAllByTestId("alt20-tile");
    expect(tiles.map((t) => t.textContent)).toEqual(["BNB+0.10%", "XRP-0.20%"]);
    expect(tiles[0].className).toContain("status-up");
    expect(tiles[1].className).toContain("status-down");
    expect(screen.getByText("2銘柄中 1上昇・中央値 -0.05%")).toBeTruthy();
  });

  it("shows the unavailable mark when alt20 is null", () => {
    render(<Alt20Grid alt20={null} copy={copy} />);
    expect(screen.queryAllByTestId("alt20-tile")).toHaveLength(0);
    expect(screen.getByText("—")).toBeTruthy();
  });
});
