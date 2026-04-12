/**
 * Logo Variant B-Octagon — Neural Crystal, denser network
 *
 * The original B uses 6 nodes around a hexagon. This variant pushes
 * the density up: 8 nodes (cardinal + intercardinal) feeding an
 * octagonal crystal. Reads as "more sources, more correlation, more
 * surface area" — closer to the actual SDE which pulls from > 8
 * data sources (Koios, CoinGecko, DefiLlama, GitHub, X, Catalyst,
 * Midnight, regulatory feeds).
 *
 * Trade-off vs. original B: more visual information, slightly busier
 * at favicon size, but a more honest representation of the SDE's
 * actual fan-in. Still maintains the "convergence to a hard center"
 * silhouette.
 */
export function LogoVariantBOctagon({ className }: { className?: string }) {
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
      {/* Eight outer nodes — cardinal + intercardinal */}
      <g fill="currentColor" stroke="none">
        <circle cx="50" cy="10" r="3" />
        <circle cx="78" cy="22" r="3" />
        <circle cx="90" cy="50" r="3" />
        <circle cx="78" cy="78" r="3" />
        <circle cx="50" cy="90" r="3" />
        <circle cx="22" cy="78" r="3" />
        <circle cx="10" cy="50" r="3" />
        <circle cx="22" cy="22" r="3" />
      </g>

      {/* Faint perimeter web (octagon) */}
      <g opacity="0.35">
        <line x1="50" y1="10" x2="78" y2="22" />
        <line x1="78" y1="22" x2="90" y2="50" />
        <line x1="90" y1="50" x2="78" y2="78" />
        <line x1="78" y1="78" x2="50" y2="90" />
        <line x1="50" y1="90" x2="22" y2="78" />
        <line x1="22" y1="78" x2="10" y2="50" />
        <line x1="10" y1="50" x2="22" y2="22" />
        <line x1="22" y1="22" x2="50" y2="10" />
      </g>

      {/* Radial connections into octagonal crystal */}
      <line x1="50" y1="13" x2="50" y2="35" />
      <line x1="76" y1="24" x2="61" y2="39" />
      <line x1="87" y1="50" x2="65" y2="50" />
      <line x1="76" y1="76" x2="61" y2="61" />
      <line x1="50" y1="87" x2="50" y2="65" />
      <line x1="24" y1="76" x2="39" y2="61" />
      <line x1="13" y1="50" x2="35" y2="50" />
      <line x1="24" y1="24" x2="39" y2="39" />

      {/* Central octagonal crystal */}
      <polygon
        points="50,35 61,39 65,50 61,61 50,65 39,61 35,50 39,39"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
