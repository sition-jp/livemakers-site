import { describe, expect, it } from "vitest";

import {
  inheritProvenance,
  makeWindowProvenance,
  selectMostConservativeProvenance,
} from "@/lib/provenance/window-provenance";

describe("window provenance (D7)", () => {
  it("carries the four G34 fields verbatim", () => {
    expect(
      makeWindowProvenance({
        packetId: "mkt12_20260710_am",
        sourceMode: "fixture_only",
        reviewStatus: "reviewed_fixture",
        asOfJst: "07:58 JST",
      }),
    ).toEqual({
      packetId: "mkt12_20260710_am",
      sourceMode: "fixture_only",
      reviewStatus: "reviewed_fixture",
      asOfJst: "07:58 JST",
    });
  });

  it("allows inheritance only within the same packet", () => {
    const parent = makeWindowProvenance({
      packetId: "mkt12_20260710_am",
      sourceMode: "fixture_only",
      reviewStatus: "reviewed_fixture",
      asOfJst: "07:58 JST",
    });
    expect(inheritProvenance(parent, { asOfJst: "07:58 JST" }).packetId).toBe(
      "mkt12_20260710_am",
    );
    expect(() =>
      inheritProvenance(parent, { packetId: "sess_20260710_asia" }),
    ).toThrow(/cross-packet provenance inheritance is forbidden/);
  });

  it("accepts reviewed snapshots and rejects cross-paired provenance", () => {
    expect(
      makeWindowProvenance({
        packetId: "mkt12_20260712_am",
        sourceMode: "reviewed_live",
        reviewStatus: "reviewed_snapshot",
        asOfJst: "07:30 JST",
      }),
    ).toEqual({
      packetId: "mkt12_20260712_am",
      sourceMode: "reviewed_live",
      reviewStatus: "reviewed_snapshot",
      asOfJst: "07:30 JST",
    });

    expect(() =>
      makeWindowProvenance({
        packetId: "mkt12_20260712_am",
        sourceMode: "reviewed_live",
        reviewStatus: "reviewed_fixture",
        asOfJst: "07:30 JST",
      } as never),
    ).toThrow(/invalid provenance pair/);
  });

  it("selects a complete real tuple and uses input order for ties", () => {
    const reviewed = makeWindowProvenance({
      packetId: "mkt12_20260712_am",
      sourceMode: "reviewed_live",
      reviewStatus: "reviewed_snapshot",
      asOfJst: "07:30 JST",
    });
    const sessionFixture = makeWindowProvenance({
      packetId: "sess_20260712_asia",
      sourceMode: "fixture_only",
      reviewStatus: "reviewed_fixture",
      asOfJst: "05:03 JST",
    });
    const rwaFixture = makeWindowProvenance({
      packetId: "lmk_20260710_0758_fx01",
      sourceMode: "fixture_only",
      reviewStatus: "reviewed_fixture",
      asOfJst: "07:58 JST",
    });

    const mixed = [reviewed, rwaFixture];
    const selected = selectMostConservativeProvenance(mixed);
    expect(selected).toEqual(rwaFixture);
    expect(mixed).toContainEqual(selected);
    expect(
      selectMostConservativeProvenance([sessionFixture, rwaFixture]),
    ).toEqual(sessionFixture);
    expect(selectMostConservativeProvenance([reviewed])).toEqual(reviewed);
  });

  it("rejects an empty global provenance candidate list", () => {
    expect(() => selectMostConservativeProvenance([])).toThrow(
      /at least one visible window/,
    );
  });
});
