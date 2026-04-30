/**
 * Staleness tier classification — Day 5 visual layer.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-30-sde-terminal-live-snapshot-v0.1.md §4.3
 *
 * Maps a staleness value (seconds since the live snapshot was produced) to
 * one of five tiers. The tier names are stable contract surface (i18n keys
 * + tailwind classes hang off them), so future tier additions should not
 * rename existing tiers.
 *
 * Tier boundaries (left-inclusive, right-exclusive):
 *   [0, 60)        → "live"            (green, just-fetched)
 *   [60, 180)      → "slightly_stale"  (yellow, 1 tick passed)
 *   [180, 360)     → "stale"           (orange, 2-3 ticks passed)
 *   [360, ∞)       → "stale_hard"      (red, 6+ ticks — producer issue likely)
 *   null / NaN     → "unavailable"     (grey — updated_at absent or invalid)
 *
 * Negative input (clock skew, future-dated updated_at) clamps to "live".
 */

export type StalenessTier =
  | "live"
  | "slightly_stale"
  | "stale"
  | "stale_hard"
  | "unavailable";

const SLIGHTLY_STALE_THRESHOLD_SEC = 60;
const STALE_THRESHOLD_SEC = 180;
const STALE_HARD_THRESHOLD_SEC = 360;

export function stalenessTier(seconds: number | null | undefined): StalenessTier {
  if (seconds == null || Number.isNaN(seconds)) return "unavailable";
  if (seconds < SLIGHTLY_STALE_THRESHOLD_SEC) return "live";
  if (seconds < STALE_THRESHOLD_SEC) return "slightly_stale";
  if (seconds < STALE_HARD_THRESHOLD_SEC) return "stale";
  return "stale_hard";
}

/**
 * Tailwind class for the badge text (and the dot indicator) per tier.
 * Tokens defined in `app/globals.css` `@theme` block.
 */
export function stalenessTextClass(tier: StalenessTier): string {
  switch (tier) {
    case "live":
      return "text-staleness-live";
    case "slightly_stale":
      return "text-staleness-warn";
    case "stale":
      return "text-staleness-stale";
    case "stale_hard":
      return "text-staleness-hard";
    case "unavailable":
      return "text-text-tertiary";
  }
}

/**
 * Tailwind class for the small leading bullet `●` per tier. Same colour
 * as the text — separated so callers can style the bullet independently
 * (e.g. blink it on the live tier in a future revision).
 */
export function stalenessDotClass(tier: StalenessTier): string {
  return stalenessTextClass(tier);
}
