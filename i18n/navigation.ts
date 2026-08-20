import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation primitives.
 *
 * Use these instead of `next/link` and `next/navigation` everywhere except
 * the explicit language toggles (Header LanguageToggle /
 * BriefLanguageSwitch), which intentionally cross locales with plain
 * explicit-URL anchors.
 *
 * With localePrefix: "always", these prefix the path with the current
 * locale (/ja or /en) automatically, so a single `<Link href="/brief">`
 * Just Works in both locales.
 *
 * Required because we set `localeDetection: false` on the routing config —
 * the URL alone decides the locale, so internal links must carry the
 * locale themselves.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
