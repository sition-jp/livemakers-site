/**
 * LiveMakers Logo — Neural Crystal with Active Pulse
 *
 * Six distributed source nodes (X feeds, Koios, CoinGecko, DefiLlama,
 * GitHub, Catalyst / Midnight / regulatory feeds) converge into a
 * hexagonal crystal core. A faint pulse halo around the crystal signals
 * "actively processing" — the visual signature of a running SDE Brain
 * rather than a dormant data feed.
 *
 * Story: distributed real-time intelligence → hardened editorial verdict.
 * The hexagon nods to consensus geometry, the radial wires to fan-in,
 * the perimeter web to cross-source correlation, and the pulse halo to
 * the dynamic / live nature of the underlying market data.
 *
 * Design notes:
 *   - viewBox 0 0 100 100 so the same component scales cleanly from
 *     favicon (16×16) through marketing (128×128 and beyond)
 *   - All strokes use currentColor so it adopts whatever Tailwind
 *     text-color is set on the parent (typically text-pillar-overview
 *     in the LIVEMAKERS brand context)
 *   - The pulse halo is intentionally non-load-bearing — at favicon
 *     resolution it disappears gracefully and the mark falls back to
 *     a clean six-node + crystal silhouette
 *
 * Selected from a 11-candidate exploration on 2026-04-12. The lab
 * preview that compared B-original / B-Diamond / B-Octagon / B-Pulse
 * along with A / C / E / G / H / J variants is removed in the same
 * commit that promoted this file.
 */
export function LogoSvg({ className = "h-6 w-6" }: { className?: string }) {
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
      {/* Six outer nodes — distributed data sources */}
      <circle cx="50" cy="14" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="84" cy="32" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="84" cy="68" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="50" cy="86" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="68" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="32" r="3.5" fill="currentColor" stroke="none" />

      {/* Faint perimeter web — cross-source correlation */}
      <g opacity="0.35">
        <line x1="50" y1="14" x2="84" y2="32" />
        <line x1="84" y1="32" x2="84" y2="68" />
        <line x1="84" y1="68" x2="50" y2="86" />
        <line x1="50" y1="86" x2="16" y2="68" />
        <line x1="16" y1="68" x2="16" y2="32" />
        <line x1="16" y1="32" x2="50" y2="14" />
      </g>

      {/* Strong radial connections — each node feeding the crystal */}
      <line x1="50" y1="17" x2="50" y2="35" />
      <line x1="81" y1="34" x2="65" y2="42" />
      <line x1="81" y1="66" x2="65" y2="58" />
      <line x1="50" y1="83" x2="50" y2="65" />
      <line x1="19" y1="66" x2="35" y2="58" />
      <line x1="19" y1="34" x2="35" y2="42" />

      {/* Active pulse halo around the crystal — "running" signal */}
      <circle cx="50" cy="50" r="22" strokeWidth="1.5" opacity="0.5" />

      {/* Central hexagonal crystal — the editorial verdict */}
      <polygon
        points="50,32 67,42 67,58 50,68 33,58 33,42"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
