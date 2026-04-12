/**
 * Logo Variant C: Wave-to-Compass
 *
 * Concept: A horizontal market wave on the bottom half flows into a
 * vertical compass needle on the top half, both anchored at the same
 * central pivot point. The metaphor is "live market motion → directional
 * conviction" — the chaotic horizontal flow transforming into a single
 * vertical decision vector.
 *
 * Visual layers:
 *   1. Outer compass ring — institutional framing, the research universe
 *   2. Horizontal wave (lower half) — the live ADA / TVL / governance flow
 *   3. Vertical needle (upper half) — the editorial direction / call
 *   4. Central pivot dot — the SDE Brain where flow becomes verdict
 *   5. Cardinal tick marks (N/E/S/W) — implicit reference frame
 *
 * The compass metaphor reinforces SITION's positioning as an "orienting
 * authority" rather than a passive data feed.
 */
export function LogoVariantC({ className }: { className?: string }) {
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
      {/* Outer compass ring */}
      <circle cx="50" cy="50" r="42" />

      {/* Cardinal tick marks (N / E / S / W) */}
      <line x1="50" y1="8" x2="50" y2="14" strokeWidth="3" />
      <line x1="92" y1="50" x2="86" y2="50" strokeWidth="3" />
      <line x1="50" y1="92" x2="50" y2="86" strokeWidth="3" />
      <line x1="8" y1="50" x2="14" y2="50" strokeWidth="3" />

      {/* Horizontal wave (lower half — market flow) */}
      <path d="M 14 62 Q 23 54, 32 62 T 50 62 T 68 62 T 86 62" strokeWidth="2.5" />

      {/* Vertical compass needle (upper half — direction) */}
      <line x1="50" y1="50" x2="50" y2="20" strokeWidth="4" />

      {/* Needle arrowhead (north-pointing triangle) */}
      <polygon
        points="50,12 56,24 44,24"
        fill="currentColor"
        stroke="none"
      />

      {/* Central pivot dot (SDE Brain) */}
      <circle cx="50" cy="50" r="4" fill="currentColor" stroke="none" />
    </svg>
  );
}
