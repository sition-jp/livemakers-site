/**
 * Logo Variant A: Pulse Lens
 *
 * Concept: A horizontal pulse wave enters a circular lens from the left,
 * passes through it, and emerges on the right as a focused, straight beam
 * with a sharp terminal point. The metaphor is "live market data → optical
 * focus → singular insight".
 *
 * Visual layers (left → right):
 *   1. Wave (left) — represents the chaotic, real-time market signal
 *   2. Lens (circle) — the SDE / SITION research apparatus
 *   3. Inner core dot — active scanning / processing happening inside
 *   4. Beam (right) — focused output, the editorial verdict
 *   5. Terminal dot — the moment of insight, where the brief lands
 *
 * Designed at 100×100 viewBox so it scales cleanly to favicon sizes
 * (16×16 / 32×32) as well as the 28×28 header rendering and any larger
 * marketing usage. All strokes use currentColor so the same component
 * adopts whatever Tailwind text-color is set on its parent.
 */
export function LogoVariantA({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Wave entering from left */}
      <path d="M 4 50 Q 13 36, 22 50 T 40 50" />

      {/* Lens (centered circle) */}
      <circle cx="50" cy="50" r="22" />

      {/* Inner core — active processing dot */}
      <circle cx="50" cy="50" r="4" fill="currentColor" stroke="none" />

      {/* Focused output beam */}
      <line x1="72" y1="50" x2="92" y2="50" />

      {/* Terminal insight point */}
      <circle cx="96" cy="50" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}
