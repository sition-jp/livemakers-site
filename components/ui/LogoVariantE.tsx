/**
 * Logo Variant E: Eye of Network
 *
 * Concept: An almond eye shape framing an iris that is itself made of a
 * network of nodes, with the central pupil rendered as a small SITION
 * diamond. The metaphor is "the all-seeing observer of the Cardano +
 * Midnight ecosystem", with the SITION diamond as the literal pupil to
 * preserve family identity with the rest of the SITION group.
 *
 * Visual layers (outside → inside):
 *   1. Almond eye outline — the institutional gaze, the research lens
 *   2. Iris ring — the focal aperture
 *   3. Network nodes around the iris — distributed observation points
 *   4. Faint connection lines — the SDE wiring everything together
 *   5. Central diamond pupil — SITION group identity, the source of
 *      authorial voice
 *
 * Of the four drafted variants this is the most ornate, which makes it
 * the strongest standalone mark but also the most demanding at small
 * sizes. The diamond pupil keeps a recognizable silhouette even when
 * the surrounding network blurs at favicon resolution.
 */
export function LogoVariantE({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Almond eye outline (top + bottom arcs joined) */}
      <path d="M 8 50 Q 50 14, 92 50 Q 50 86, 8 50 Z" />

      {/* Iris ring */}
      <circle cx="50" cy="50" r="18" strokeWidth="2.5" />

      {/* Network nodes around the iris (8 cardinal + intercardinal) */}
      <g fill="currentColor" stroke="none">
        <circle cx="50" cy="29" r="2" />
        <circle cx="65" cy="35" r="2" />
        <circle cx="71" cy="50" r="2" />
        <circle cx="65" cy="65" r="2" />
        <circle cx="50" cy="71" r="2" />
        <circle cx="35" cy="65" r="2" />
        <circle cx="29" cy="50" r="2" />
        <circle cx="35" cy="35" r="2" />
      </g>

      {/* Faint inter-node connections (SDE wiring) */}
      <g opacity="0.45" strokeWidth="1.5">
        <line x1="50" y1="29" x2="71" y2="50" />
        <line x1="71" y1="50" x2="50" y2="71" />
        <line x1="50" y1="71" x2="29" y2="50" />
        <line x1="29" y1="50" x2="50" y2="29" />
      </g>

      {/* Central SITION diamond pupil */}
      <polygon
        points="50,42 58,50 50,58 42,50"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
