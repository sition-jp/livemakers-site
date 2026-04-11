import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation primitives.
 *
 * Use these instead of `next/link` and `next/navigation` everywhere except
 * the explicit language toggle in Header / BriefLanguageSwitch (which
 * intentionally crosses locales and uses window.location.assign for the
 * cookie + hard-navigate trick).
 *
 * With localePrefix: "as-needed", these prefix the path with /ja
 * automatically when the user is on the JA locale, so a single
 * `<Link href="/brief">` Just Works on both /ja/brief and /brief.
 *
 * Required because we set `localeDetection: false` on the routing config —
 * without that flag, the cookie would silently rewrite mismatched URLs
 * back to the user's locale; with it disabled, internal links must
 * carry the locale themselves.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
