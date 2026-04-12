/**
 * Logo Variant B-Pulse — Neural Crystal with active pulse halo
 *
 * Same six-node + hexagonal crystal as the original B, but the central
 * crystal is wrapped in a thin concentric ring that suggests an active
 * pulse / "live processing now" state. Adds a layer of dynamism to
 * what is otherwise a static convergence diagram.
 *
 * The halo is faint and intentionally non-load-bearing — at favicon
 * size it disappears gracefully and the mark falls back to the same
 * silhouette as the original B. At larger sizes (64px and up) it
 * reads as the visual signature of a *running* SDE rather than a
 * dormant one.
 *
 * Trade-off vs. original B: marginally more complex, but the extra
 * stroke is what carries the "real-time market" leg of the brief
 * (dynamic + insight + brain) more explicitly.
 */
export function LogoVariantBPulse({ className }: { className?: string }) {
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
      {/* Six outer nodes (distributed sources) */}
      <circle cx="50" cy="14" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="84" cy="32" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="84" cy="68" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="50" cy="86" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="68" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="32" r="3.5" fill="currentColor" stroke="none" />

      {/* Faint perimeter web */}
      <g opacity="0.35">
        <line x1="50" y1="14" x2="84" y2="32" />
        <line x1="84" y1="32" x2="84" y2="68" />
        <line x1="84" y1="68" x2="50" y2="86" />
        <line x1="50" y1="86" x2="16" y2="68" />
        <line x1="16" y1="68" x2="16" y2="32" />
        <line x1="16" y1="32" x2="50" y2="14" />
      </g>

      {/* Strong radial connections into the crystal */}
      <line x1="50" y1="17" x2="50" y2="35" />
      <line x1="81" y1="34" x2="65" y2="42" />
      <line x1="81" y1="66" x2="65" y2="58" />
      <line x1="50" y1="83" x2="50" y2="65" />
      <line x1="19" y1="66" x2="35" y2="58" />
      <line x1="19" y1="34" x2="35" y2="42" />

      {/* Active pulse halo around the crystal */}
      <circle cx="50" cy="50" r="22" strokeWidth="1.5" opacity="0.5" />

      {/* Central hexagonal crystal */}
      <polygon
        points="50,32 67,42 67,58 50,68 33,58 33,42"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
