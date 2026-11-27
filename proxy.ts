import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { RECORDED_FILES, buildBotVisit, sendBotVisit, type BotVisit } from "./lib/bot-visits";
import { FORECAST_LAB_PATH, checkForecastLab } from "./lib/forecast-lab/gate";

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
//
// AI bot visit recording (2026-11-15 田平氏 GO・spec
// 2026-11-15-lvm-ai-bot-policy-and-visit-metrics-design §7-4):
//   • The response is decided exactly as before (next-intl alone). Recording
//     only looks at the User-Agent afterwards; people are never recorded.
//   • /robots.txt, /llms.txt, /sitemap.xml and /sitemap-news.xml are matched
//     only so bot fetches can be counted. They are passed through untouched
//     (NextResponse.next()) — never sent through intl, which would redirect
//     them to /ja/robots.txt etc.
//   • Sending happens in event.waitUntil after the response, with a 2s
//     timeout, and every failure is swallowed (lib/bot-visits.ts). Nothing in
//     the recording path may throw out of the proxy or change the response.
const intl = createMiddleware(routing);

// Article detail pages carry no hreflang (2026-11-21 田平氏 GO・案 2).
//   • Articles have no English body: /en/articles/<slug> renders the Japanese
//     text as is. next-intl adds a Link header (hreflang ja / en / x-default)
//     to every page, which told Google the Japanese copy was the English
//     version. Only article detail pages drop it; every other page (top,
//     briefs, series lists…) keeps next-intl's header unchanged.
//   • The <head> side is in lib/articles/article-metadata.ts (no languages,
//     /en is noindex).
const ARTICLE_DETAIL = /^\/(ja|en)\/articles\/(?!series(\/|$))[^/]+\/?$/;

const RECORDED: ReadonlySet<string> = new Set(RECORDED_FILES);

function record(
  req: NextRequest,
  event: NextFetchEvent,
  kind: BotVisit["kind"],
): void {
  try {
    const visit = buildBotVisit(req, kind, process.env);
    if (visit) event.waitUntil(sendBotVisit(visit, process.env));
  } catch {
    // 記録の失敗はページに影響させない。
  }
}

export default async function proxy(
  req: NextRequest,
  event: NextFetchEvent,
): Promise<NextResponse> {
  if (RECORDED.has(req.nextUrl.pathname)) {
    record(req, event, "file");
    return NextResponse.next();
  }
  // 予測サービスの内部ページ (パスワード付き・lib/forecast-lab/gate.ts)。記録もしない
  if (FORECAST_LAB_PATH.test(req.nextUrl.pathname)) {
    const gate = checkForecastLab(req.headers.get("authorization"), process.env.FORECAST_APP_PASSWORD);
    if (!gate.ok) {
      const headers: Record<string, string> = { "x-robots-tag": "noindex, nofollow" };
      if (gate.status === 401) headers["www-authenticate"] = 'Basic realm="forecast-lab", charset="UTF-8"';
      return new NextResponse(gate.status === 401 ? "認証が必要です" : "Not Found", { status: gate.status, headers });
    }
    const inner = await intl(req);
    inner.headers.set("x-robots-tag", "noindex, nofollow");
    inner.headers.set("cache-control", "private, no-store");
    return inner;
  }
  const response = await intl(req);
  if (ARTICLE_DETAIL.test(req.nextUrl.pathname)) response.headers.delete("link");
  record(req, event, response.status >= 300 && response.status < 400 ? "redirect" : "page");
  return response;
}

// Next reads the matcher statically at build time — values must be literals
// (no spreading RECORDED_FILES). tests/proxy.test.ts checks they stay in sync.
export const config = {
  matcher: [
    "/((?!api|_next|_vercel|.*\\..*).*)",
    "/robots.txt",
    "/llms.txt",
    "/sitemap.xml",
    "/sitemap-news.xml",
  ],
};
