/**
 * Logo Variant B-Diamond — Neural Crystal with rhombus center
 *
 * Same six-node convergence story as the original B (Neural Crystal),
 * but the central crystal is rendered as a rhombus (diamond) instead
 * of a hexagon. This pulls the mark visually back into the SITION
 * family, where the parent group already uses a diamond as its primary
 * geometry.
 *
 * Trade-off vs. original B: less "honeycomb / consensus" connotation,
 * more "this is part of SITION group" lineage. The diamond also reads
 * slightly cleaner at favicon sizes than the hexagon.
 */
export function LogoVariantBDiamond({ className }: { className?: string }) {
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
      {/* Six outer nodes (distributed sources) — same arrangement as B */}
      <circle cx="50" cy="14" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="84" cy="32" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="84" cy="68" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="50" cy="86" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="68" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="32" r="3.5" fill="currentColor" stroke="none" />

      {/* Faint perimeter web */}
      <g opacity="0.4">
        <line x1="50" y1="14" x2="84" y2="32" />
        <line x1="84" y1="32" x2="84" y2="68" />
        <line x1="84" y1="68" x2="50" y2="86" />
        <line x1="50" y1="86" x2="16" y2="68" />
        <line x1="16" y1="68" x2="16" y2="32" />
        <line x1="16" y1="32" x2="50" y2="14" />
      </g>

      {/* Strong radial connections into the diamond */}
      <line x1="50" y1="17" x2="50" y2="32" />
      <line x1="81" y1="34" x2="65" y2="50" />
      <line x1="81" y1="66" x2="65" y2="50" />
      <line x1="50" y1="83" x2="50" y2="68" />
      <line x1="19" y1="66" x2="35" y2="50" />
      <line x1="19" y1="34" x2="35" y2="50" />

      {/* Central rhombus crystal (SITION family geometry) */}
      <polygon
        points="50,30 68,50 50,70 32,50"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
