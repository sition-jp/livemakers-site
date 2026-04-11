import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Pure intl middleware — no Accept-Language auto-redirect.
//
// Earlier versions of this file redirected first-time visitors with a "ja*"
// Accept-Language header to /ja. We removed it because:
//   1) It made the explicit URL "https://livemakers.com/" unreachable for
//      JA-locale browsers (every visit bounced to /ja, ignoring user intent).
//   2) Combined with next-intl's own cookie-based redirect, it created two
//      layers of automatic locale switching that fought each other and broke
//      the EN/日本語 toggle.
//
// Behavior now:
//   • "/" always serves EN
//   • "/ja" always serves JA
//   • The cookie next-intl sets on each visit is honored on subsequent visits
//     to non-prefixed routes (so once a visitor lands on /ja, /brief/foo will
//     redirect them to /ja/brief/foo via next-intl's own logic).
//   • Users switch languages via the explicit toggle in the header.
export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
