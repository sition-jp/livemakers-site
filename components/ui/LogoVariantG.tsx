/**
 * Logo Variant G — Sonar Pulse
 *
 * A central diamond emits three concentric pulse rings outward, like a
 * sonar / radar broadcast. The metaphor inverts the usual data flow:
 * instead of external data flowing into a center (B's story), here the
 * SDE Brain *broadcasts insight outward* into the institutional reader
 * community. "We see, we publish, you receive."
 *
 * Visual layers (inside → outside):
 *   1. SITION diamond core — the editorial source
 *   2. Inner ring (loud) — first wave, the Brief itself
 *   3. Middle ring (medium) — discussion / X amplification
 *   4. Outer ring (faint) — secondary readership / quotation
 *
 * The decreasing opacity simulates a wave attenuating as it propagates,
 * which is what actually happens with research distribution.
 */
export function LogoVariantG({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Outer pulse ring (faint, longest reach) */}
      <circle cx="50" cy="50" r="42" strokeWidth="2" opacity="0.35" />

      {/* Middle pulse ring */}
      <circle cx="50" cy="50" r="30" strokeWidth="2.5" opacity="0.6" />

      {/* Inner pulse ring (loudest, just emitted) */}
      <circle cx="50" cy="50" r="18" strokeWidth="3" />

      {/* Central SITION diamond — the editorial source */}
      <polygon
        points="50,38 62,50 50,62 38,50"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
