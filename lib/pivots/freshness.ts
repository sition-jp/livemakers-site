/**
 * Freshness classifier — handoff §C thresholds.
 *
 * fresh:      age <= 36h
 * stale:      36h < age <= 72h
 * very_stale: age > 72h
 * unknown:    generated_at is missing / unparseable
 *
 * Pure function — testable without mocking Date. Pages pass `new Date()`
 * at render time; tests pass a fixed `now` for determinism.
 */
export type FreshnessTier = "fresh" | "stale" | "very_stale" | "unknown";

const HOUR_MS = 3_600_000;

export const FRESHNESS_THRESHOLDS_MS = {
  fresh: 36 * HOUR_MS,
  stale: 72 * HOUR_MS,
} as const;

export function classifyFreshness(
  generatedAt: string | null | undefined,
  now: Date = new Date(),
): FreshnessTier {
  if (!generatedAt) return "unknown";
  const generatedMs = Date.parse(generatedAt);
  if (Number.isNaN(generatedMs)) return "unknown";
  // Clamp negative ages (clock-skew futures) to 0.
  const ageMs = Math.max(0, now.getTime() - generatedMs);
  if (ageMs <= FRESHNESS_THRESHOLDS_MS.fresh) return "fresh";
  if (ageMs <= FRESHNESS_THRESHOLDS_MS.stale) return "stale";
  return "very_stale";
}
