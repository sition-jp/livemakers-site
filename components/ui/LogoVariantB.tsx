/**
 * Logo Variant B: Neural Crystal
 *
 * Concept: A distributed neural network of six outer nodes converges into
 * a central hexagonal crystal. The metaphor is "distributed intelligence
 * (SDE crawlers, X feeds, on-chain data) → crystallized into a single,
 * sharp-edged research output".
 *
 * Visual layers:
 *   1. Six outer nodes — distributed data sources (X, Koios, Catalyst,
 *      Midnight, GitHub, regulatory feeds)
 *   2. Strong radial connections — every node feeding the central crystal
 *   3. Faint perimeter web — inter-node correlation, the SDE finding
 *      cross-source patterns
 *   4. Central hexagonal crystal — the editorial verdict, hardened
 *
 * The hexagon is intentionally aligned with Cardano's stake pool color
 * conventions (six-sided = consensus geometry) and gives the logo a
 * recognizable silhouette even at favicon sizes.
 */
export function LogoVariantB({ className }: { className?: string }) {
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

      {/* Faint perimeter web — cross-source correlation */}
      <g opacity="0.4">
        <line x1="50" y1="14" x2="84" y2="32" />
        <line x1="84" y1="32" x2="84" y2="68" />
        <line x1="84" y1="68" x2="50" y2="86" />
        <line x1="50" y1="86" x2="16" y2="68" />
        <line x1="16" y1="68" x2="16" y2="32" />
        <line x1="16" y1="32" x2="50" y2="14" />
      </g>

      {/* Strong radial connections from each node into the crystal */}
      <line x1="50" y1="17" x2="50" y2="35" />
      <line x1="81" y1="34" x2="65" y2="42" />
      <line x1="81" y1="66" x2="65" y2="58" />
      <line x1="50" y1="83" x2="50" y2="65" />
      <line x1="19" y1="66" x2="35" y2="58" />
      <line x1="19" y1="34" x2="35" y2="42" />

      {/* Central hexagonal crystal (filled) */}
      <polygon
        points="50,32 67,42 67,58 50,68 33,58 33,42"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
