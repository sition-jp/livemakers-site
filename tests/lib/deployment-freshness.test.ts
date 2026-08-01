/**
 * deploymentFreshnessSec — deployment-stable freshness anchor.
 *
 * ISR cost doctrine (2026-08-01): Vercel only bills an ISR write when the
 * revalidated content CHANGED. Request-time Date.now() in server-rendered
 * pages made every regeneration byte-different, turning every revalidation
 * into a billed write. This helper anchors freshness to the build timestamp
 * (NEXT_PUBLIC_BUILD_TIME_MS, baked in next.config.ts) so regenerations of
 * unchanged data render identical output.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { deploymentFreshnessSec } from "@/lib/deployment-freshness";

describe("deploymentFreshnessSec", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("returns -1 for missing mtime (null / undefined / 0)", () => {
    expect(deploymentFreshnessSec(null)).toBe(-1);
    expect(deploymentFreshnessSec(undefined)).toBe(-1);
    expect(deploymentFreshnessSec(0)).toBe(-1);
  });

  it("anchors to NEXT_PUBLIC_BUILD_TIME_MS when set (deterministic per deployment)", () => {
    vi.stubEnv("NEXT_PUBLIC_BUILD_TIME_MS", "1000000");
    expect(deploymentFreshnessSec(400000)).toBe(600);
    // Same inputs → same output regardless of wall clock.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(99_999_999_999));
    expect(deploymentFreshnessSec(400000)).toBe(600);
  });

  it("clamps to 0 when the data file is newer than the build stamp", () => {
    vi.stubEnv("NEXT_PUBLIC_BUILD_TIME_MS", "1000000");
    expect(deploymentFreshnessSec(2_000_000)).toBe(0);
  });

  it("falls back to Date.now() when the build stamp is absent (next dev)", () => {
    vi.stubEnv("NEXT_PUBLIC_BUILD_TIME_MS", "");
    vi.useFakeTimers();
    vi.setSystemTime(new Date(500_000));
    expect(deploymentFreshnessSec(200_000)).toBe(300);
  });

  it("falls back to Date.now() when the build stamp is not numeric", () => {
    vi.stubEnv("NEXT_PUBLIC_BUILD_TIME_MS", "not-a-number");
    vi.useFakeTimers();
    vi.setSystemTime(new Date(500_000));
    expect(deploymentFreshnessSec(200_000)).toBe(300);
  });
});
