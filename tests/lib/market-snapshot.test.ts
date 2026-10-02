import { describe, expect, it } from "vitest";
import { CHARTABLE_INSTRUMENTS } from "@/lib/home/instruments";
import { SnapshotSchema, loadMarketSnapshot } from "@/lib/home/market-snapshot";

describe("market snapshot fixture + schema", () => {
  it("loads the rebuilt all-null fixture (no stale numbers)", () => {
    const snapshot = loadMarketSnapshot();
    expect(snapshot.cells.map((cell) => cell.instrumentId)).toEqual([
      ...CHARTABLE_INSTRUMENTS,
      "rwa_tvl",
    ]);
    for (const cell of snapshot.cells) {
      expect(cell.value).toBeNull();
      expect(cell.changeLabel).toBeNull();
      expect(cell.direction).toBeNull();
    }
  });

  it("rejects a half-null cell", () => {
    const snapshot = loadMarketSnapshot();
    const broken = {
      ...snapshot,
      cells: snapshot.cells.map((cell, index) =>
        index === 0 ? { ...cell, value: "$1" } : cell,
      ),
    };
    expect(() => SnapshotSchema.parse(broken)).toThrow(/all-null or all-present/);
  });

  it("rejects a duplicate instrumentId", () => {
    const snapshot = loadMarketSnapshot();
    expect(() =>
      SnapshotSchema.parse({
        ...snapshot,
        cells: [...snapshot.cells, snapshot.cells[0]],
      }),
    ).toThrow(/duplicate instrumentId/);
  });

  it("rejects an asOfLabel that does not match asOfJst", () => {
    const snapshot = loadMarketSnapshot();
    expect(() => SnapshotSchema.parse({ ...snapshot, asOfLabel: "09:00 JST" })).toThrow(/asOfLabel must equal/);
    expect(() => SnapshotSchema.parse({ ...snapshot, asOfLabel: "07:58 invalid" })).toThrow(/asOfLabel must equal/);
  });

  it("rejects a snapshot missing a registry instrument", () => {
    const snapshot = loadMarketSnapshot();
    expect(() =>
      SnapshotSchema.parse({
        ...snapshot,
        cells: snapshot.cells.filter((cell) => cell.instrumentId !== "us10y"),
      }),
    ).toThrow(/missing cell for instrument: us10y/);
  });
});
