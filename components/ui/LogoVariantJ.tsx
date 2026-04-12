/**
 * Logo Variant J — Stratified Tower
 *
 * Four horizontal bars stacked vertically, with a thin vertical beam
 * piercing all four. The bars represent the SITION Tier 1 → 4 layered
 * intelligence stack (Live Markets / Practice / Discovery / Institutional
 * Research). The beam is the unified data spine that connects them — the
 * SDE Brain.
 *
 * The top bar is the widest (= broadest readership, Tier 1 live markets)
 * and bars taper inward as they descend toward the institutional Tier 4.
 * The beam terminates in a small dot at the bottom = the editorial
 * crystal.
 *
 * Visually distinct from B / G / H because it's *vertical and
 * architectural* rather than radial. Reads as "structured, layered,
 * institutional" — closer to a Bloomberg terminal aesthetic than the
 * organic / network metaphors of the other variants.
 */
export function LogoVariantJ({ className }: { className?: string }) {
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
      {/* Tier 1 — broadest, top */}
      <line x1="14" y1="22" x2="86" y2="22" strokeWidth="4" />

      {/* Tier 2 */}
      <line x1="22" y1="38" x2="78" y2="38" strokeWidth="4" />

      {/* Tier 3 */}
      <line x1="30" y1="54" x2="70" y2="54" strokeWidth="4" />

      {/* Tier 4 — narrowest, institutional */}
      <line x1="38" y1="70" x2="62" y2="70" strokeWidth="4" />

      {/* Vertical SDE spine connecting all tiers */}
      <line x1="50" y1="14" x2="50" y2="84" strokeWidth="2" opacity="0.6" />

      {/* Editorial crystal at the base */}
      <polygon
        points="50,80 56,86 50,92 44,86"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
