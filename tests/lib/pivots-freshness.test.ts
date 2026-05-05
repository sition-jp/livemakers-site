import { describe, expect, test } from "vitest";

import { classifyFreshness, FRESHNESS_THRESHOLDS_MS } from "@/lib/pivots/freshness";

const NOW = new Date("2026-05-05T00:00:00Z");

function hoursAgoIso(hours: number): string {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString();
}

describe("classifyFreshness", () => {
  test("just-generated → fresh", () => {
    expect(classifyFreshness(hoursAgoIso(0), NOW)).toBe("fresh");
  });

  test("36h boundary inclusive → fresh", () => {
    expect(classifyFreshness(hoursAgoIso(36), NOW)).toBe("fresh");
  });

  test("36h + 1ms → stale", () => {
    const generated = new Date(NOW.getTime() - 36 * 3_600_000 - 1).toISOString();
    expect(classifyFreshness(generated, NOW)).toBe("stale");
  });

  test("72h boundary inclusive → stale", () => {
    expect(classifyFreshness(hoursAgoIso(72), NOW)).toBe("stale");
  });

  test("72h + 1ms → very_stale", () => {
    const generated = new Date(NOW.getTime() - 72 * 3_600_000 - 1).toISOString();
    expect(classifyFreshness(generated, NOW)).toBe("very_stale");
  });

  test("future timestamp (clock skew) → fresh (clamped to 0 age)", () => {
    expect(classifyFreshness(hoursAgoIso(-2), NOW)).toBe("fresh");
  });

  test("invalid ISO string → unknown", () => {
    expect(classifyFreshness("not-a-date", NOW)).toBe("unknown");
  });

  test("empty string → unknown", () => {
    expect(classifyFreshness("", NOW)).toBe("unknown");
  });

  test("threshold constants are exported and match handoff (36h, 72h)", () => {
    expect(FRESHNESS_THRESHOLDS_MS.fresh).toBe(36 * 3_600_000);
    expect(FRESHNESS_THRESHOLDS_MS.stale).toBe(72 * 3_600_000);
  });
});
