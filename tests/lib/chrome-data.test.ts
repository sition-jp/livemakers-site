import { describe, expect, it } from "vitest";

import { isChromeData } from "@/lib/layout/chrome-data";

const valid = {
  tickerItems: [{ id: "btc", label: "BTC", value: "$97,000", deltaPct: 1.2, badge: "SNAPSHOT" }],
  pageProvenance: {
    packetId: "lmk_20261120_0758",
    sourceMode: "live",
    reviewStatus: "reviewed",
    asOfJst: "07:58 JST",
  },
  chromeMeta: { dateLabel: "2026-11-20（木）", asOfLabel: "07:58 JST" },
};

describe("isChromeData (/api/chrome の中身の検査)", () => {
  it("accepts the chrome payload", () => {
    expect(isChromeData(valid)).toBe(true);
    expect(isChromeData({ ...valid, tickerItems: [] })).toBe(true);
  });

  it("rejects broken payloads so the strip stays in its placeholder", () => {
    expect(isChromeData(null)).toBe(false);
    expect(isChromeData({ ...valid, tickerItems: [{ id: "btc" }] })).toBe(false);
    expect(isChromeData({ ...valid, pageProvenance: undefined })).toBe(false);
    expect(isChromeData({ ...valid, chromeMeta: { dateLabel: "x" } })).toBe(false);
  });
});
