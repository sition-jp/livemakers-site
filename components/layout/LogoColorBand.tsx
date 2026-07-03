/**
 * Logo-color band pinned to the very top of the header (doctrine:
 * livemakers-interface-light-first-macro-crypto-rwa, 2026-07-03). The color
 * comes from the --lmk-logo-color token, which is a neutral placeholder until
 * the LiveMakers logo mark is finalized — swapping the token recolors the
 * band with no component change.
 */
export function LogoColorBand() {
  return <div aria-hidden="true" data-testid="logo-color-band" className="h-1 bg-logo" />;
}
