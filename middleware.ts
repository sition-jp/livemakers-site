import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // Only bootstrap locale for first-time visitors (no NEXT_LOCALE cookie yet).
  const hasCookie = request.cookies.has("NEXT_LOCALE");
  const pathname = request.nextUrl.pathname;
  const isLocalePrefixed = pathname === "/ja" || pathname.startsWith("/ja/");

  if (!hasCookie && !isLocalePrefixed) {
    const acceptLanguage = request.headers.get("accept-language") ?? "";
    // Prefer /ja only when the first language tag is ja*.
    const firstTag = acceptLanguage.split(",")[0]?.trim().toLowerCase() ?? "";
    if (firstTag.startsWith("ja")) {
      const url = request.nextUrl.clone();
      url.pathname = `/ja${pathname === "/" ? "" : pathname}`;
      const response = NextResponse.redirect(url, 302);
      response.cookies.set("NEXT_LOCALE", "ja", { path: "/", maxAge: 60 * 60 * 24 * 365 });
      return response;
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
