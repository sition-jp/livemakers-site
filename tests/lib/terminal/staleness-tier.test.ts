import { describe, it, expect } from "vitest";
import {
  stalenessTier,
  stalenessTextClass,
  stalenessDotClass,
  type StalenessTier,
} from "@/lib/terminal/staleness-tier";

describe("stalenessTier — boundary cases", () => {
  it("0s → live", () => {
    expect(stalenessTier(0)).toBe("live");
  });

  it("59s → live (just below 60s threshold)", () => {
    expect(stalenessTier(59)).toBe("live");
  });

  it("60s → slightly_stale (boundary, left-inclusive)", () => {
    expect(stalenessTier(60)).toBe("slightly_stale");
  });

  it("179s → slightly_stale (just below 180s threshold)", () => {
    expect(stalenessTier(179)).toBe("slightly_stale");
  });

  it("180s → stale (boundary, left-inclusive)", () => {
    expect(stalenessTier(180)).toBe("stale");
  });

  it("359s → stale (just below 360s threshold)", () => {
    expect(stalenessTier(359)).toBe("stale");
  });

  it("360s → stale_hard (boundary, left-inclusive)", () => {
    expect(stalenessTier(360)).toBe("stale_hard");
  });

  it("3600s (1h) → stale_hard", () => {
    expect(stalenessTier(3600)).toBe("stale_hard");
  });
});

describe("stalenessTier — null / undefined / NaN", () => {
  it("null → unavailable", () => {
    expect(stalenessTier(null)).toBe("unavailable");
  });

  it("undefined → unavailable", () => {
    expect(stalenessTier(undefined)).toBe("unavailable");
  });

  it("NaN → unavailable", () => {
    expect(stalenessTier(Number.NaN)).toBe("unavailable");
  });
});

describe("stalenessTier — clock skew (negative input)", () => {
  it("negative seconds clamp to live (future-dated updated_at)", () => {
    expect(stalenessTier(-5)).toBe("live");
    expect(stalenessTier(-1000)).toBe("live");
  });
});

describe("stalenessTextClass / stalenessDotClass", () => {
  const cases: Array<[StalenessTier, string]> = [
    ["live", "text-staleness-live"],
    ["slightly_stale", "text-staleness-warn"],
    ["stale", "text-staleness-stale"],
    ["stale_hard", "text-staleness-hard"],
    ["unavailable", "text-text-tertiary"],
  ];

  it.each(cases)("text class for %s tier → %s", (tier, expected) => {
    expect(stalenessTextClass(tier)).toBe(expected);
  });

  it.each(cases)("dot class matches text class for %s tier", (tier, expected) => {
    expect(stalenessDotClass(tier)).toBe(expected);
  });
});
