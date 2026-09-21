/**
 * Logo-color band pinned to the very top of the header (doctrine:
 * livemakers-interface-light-first-macro-crypto-rwa, 2026-07-03). The color
 * comes from the --lmk-logo-color token (#8AE617 lime since 2026-09-21, matching
 * the X avatar and favicon) — swapping the token recolors the
 * band with no component change.
 */
export function LogoColorBand() {
  return <div aria-hidden="true" data-testid="logo-color-band" className="h-1 bg-logo" />;
}
