/**
 * Logo Variant H — Aperture
 *
 * A six-blade camera aperture closing into a central focal point. The
 * metaphor is mechanical precision — the SDE as an *instrument* with
 * adjustable focus, not just a passive feed. Aperture also nods to
 * "lens" / "exposure" / "depth of field", which map directly onto
 * SITION's editorial positioning of "deep, accurate insight on a
 * specific narrow subject".
 *
 * Visual layers:
 *   1. Outer ring — the camera body / institutional housing
 *   2. Six aperture blades — the closing mechanism, made of straight
 *      lines that nearly meet at the center
 *   3. Central focus dot — the singular point of editorial verdict
 *
 * The blade angles are not perfectly symmetric on purpose — real
 * aperture mechanisms have slight rotation, and the asymmetry gives
 * the mark a sense of motion (= dynamic) without literal animation.
 */
export function LogoVariantH({ className }: { className?: string }) {
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
      {/* Outer ring — camera body */}
      <circle cx="50" cy="50" r="40" strokeWidth="3.5" />

      {/*
        Six aperture blades, each a chord of the outer ring just missing
        the center to leave a small focal hole. Slight CCW rotation
        (every blade offset 60° + a small twist) gives motion.
      */}
      <g strokeWidth="3">
        <line x1="50" y1="14" x2="78" y2="60" />
        <line x1="78" y1="22" x2="44" y2="78" />
        <line x1="86" y1="50" x2="22" y2="60" />
        <line x1="78" y1="78" x2="22" y2="40" />
        <line x1="50" y1="86" x2="56" y2="22" />
        <line x1="22" y1="78" x2="78" y2="40" />
      </g>

      {/* Central focus dot */}
      <circle cx="50" cy="50" r="3.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
