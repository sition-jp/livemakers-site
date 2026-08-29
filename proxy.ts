import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Pure intl proxy — no Accept-Language auto-redirect.
//
// Next.js 16 renamed the "middleware" file convention to "proxy"
// (middleware.ts → proxy.ts); next-intl's createMiddleware works unchanged
// under the new convention. Only the file name and this header changed.
//
// Behavior (2026-08-21 田平氏 GO: トップ=日本語固定):
//   • "/" redirects to /ja (defaultLocale) — the readership is Japanese.
//   • Every route carries an explicit /ja or /en prefix (localePrefix
//     "always"), so published /ja/articles/... canonical URLs are
//     unchanged. Legacy unprefixed URLs redirect to their /ja variant.
//   • No cookie / Accept-Language detection — the URL alone decides the
//     locale; users switch via the explicit header toggle.
//
// History: an earlier version auto-redirected by Accept-Language, which
// fought next-intl's cookie redirect and made explicit URLs unreachable
// (see i18n/routing.ts). Do not reintroduce detection layers.
export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
