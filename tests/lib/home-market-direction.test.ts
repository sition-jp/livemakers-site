import { describe, expect, it } from "vitest";

import { MarketSnapshotCellSchema } from "@/lib/home/market-snapshot";

const baseCell = {
  instrumentId: "btc_usd" as const,
  nameJa: "BTC/USD",
  value: "$63,299",
};

describe("reviewed-home market direction contract", () => {
  it("accepts exact zero only as a neutral flat cell", () => {
    const cell = MarketSnapshotCellSchema.parse({
      ...baseCell,
      changeLabel: "0.00%",
      direction: "flat",
    });

    expect(cell.direction).toBe("flat");
  });

  it("rejects partial-null cells", () => {
    expect(() =>
      MarketSnapshotCellSchema.parse({
        ...baseCell,
        changeLabel: "+1.00%",
        direction: null,
      }),
    ).toThrow(/all-null or all-present/);
  });

  it.each([
    ["+1.00%", "down"],
    ["-1.00%", "up"],
    ["+0%", "up"],
    ["+0.00%", "up"],
    ["-0%", "down"],
    ["-0.00%", "down"],
  ] as const)("rejects %s with direction %s", (changeLabel, direction) => {
    expect(() =>
      MarketSnapshotCellSchema.parse({
        ...baseCell,
        changeLabel,
        direction,
      }),
    ).toThrow();
  });
});
