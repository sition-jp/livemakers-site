import { describe, expect, it } from "vitest";

import {
  inheritProvenance,
  makeWindowProvenance,
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
});
